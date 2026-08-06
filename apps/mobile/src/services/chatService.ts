import {
  collection,
  doc,
  getDoc,
  runTransaction,
  getDocs,
  increment,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { ChatImage, ChatMessage, ChatMessageType } from "../types/chat";

const chatsCollection = "chats";
const chatThreadsCollection = "chatThreads";

/**
 * Assignment is the relationship source of truth. Legacy pair-derived thread
 * ids are resolved once by the backfill and persisted as assignment.threadId.
 */
const assignmentsCollection = "assignments";

export const fetchActiveAssignmentThreadId = async (assignmentId: string): Promise<string | null> => {
  const snapshot = await getDoc(doc(db, assignmentsCollection, assignmentId));
  const data = snapshot.data();
  return data?.status === "active" && typeof data.threadId === "string"
    ? data.threadId
    : null;
};

export const subscribeToAssignmentThreadId = (
  assignmentId: string,
  onChange: (threadId: string | null) => void,
  onError?: (error: Error) => void
) => onSnapshot(
  doc(db, assignmentsCollection, assignmentId),
  (snapshot) => {
    const data = snapshot.data();
    onChange(
      data?.status === "active" && typeof data.threadId === "string"
        ? data.threadId
        : null
    );
  },
  (error) => {
    onChange(null);
    onError?.(error);
  }
);

const toIsoString = (value: unknown): string => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
};

const parseChatMessage = (id: string, data: Record<string, unknown>): ChatMessage => {
  const type = data.type === "image" ? "image" : "text";
  const image = data.image && typeof data.image === "object" ? data.image as ChatImage : undefined;

  return {
    id,
    threadId: typeof data.threadId === "string" ? data.threadId : "",
    senderId: typeof data.senderId === "string" ? data.senderId : "",
    receiverId: typeof data.receiverId === "string" ? data.receiverId : "",
    type,
    text: typeof data.text === "string" ? data.text : "",
    image,
    status: data.status === "read" ? "read" : "sent",
    createdAt: toIsoString(data.createdAt),
    readAt: data.readAt ? toIsoString(data.readAt) : null,
  };
};

export type ChatThreadSummary = {
  threadId: string;
  lastMessageText: string;
  lastMessageType: ChatMessageType;
  lastMessageAt: string | null;
  lastSenderId: string | null;
};

export type CoachThreadSummary = ChatThreadSummary & {
  traineeId: string;
  coachId: string;
  unreadByCoach: number;
};

export const subscribeToChatMessages = (
  threadId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
) => {
  const messagesQuery = query(
    collection(db, chatsCollection, threadId, "messages"),
    orderBy("createdAt", "asc"),
    limitToLast(100)
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onChange(snapshot.docs.map((doc) => parseChatMessage(doc.id, doc.data())));
    },
    (error) => {
      onError?.(error);
    }
  );
};

export const subscribeToLatestMessage = (
  threadId: string,
  onChange: (summary: ChatThreadSummary | null) => void
) => {
  return onSnapshot(
    doc(db, chatThreadsCollection, threadId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data();
      onChange({
        threadId,
        lastMessageText: typeof data.lastMessageText === "string" ? data.lastMessageText : "",
        lastMessageType: data.lastMessageType === "image" ? "image" : "text",
        lastMessageAt: data.lastMessageAt ? toIsoString(data.lastMessageAt) : null,
        lastSenderId: typeof data.lastSenderId === "string" ? data.lastSenderId : null,
      });
    },
    (error) => {
      console.error("[ChatService] Latest message subscription failed:", error);
      onChange(null);
    }
  );
};

export const subscribeToCoachThreadSummaries = (
  coachId: string,
  onChange: (summaries: CoachThreadSummary[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, chatThreadsCollection),
    where("participants", "array-contains", coachId),
    // Ended relationships are not the coach's to read, and the security rules
    // enforce that per document — so an unfiltered query containing even one
    // ended thread would be denied in full. Every thread must therefore carry
    // `status`: run scripts/backfillAssignments.cjs before shipping this.
    where("status", "==", "active"),
    // Most recent conversations first. Safe to order on: the thread is created
    // with an explicit `lastMessageAt: null` (functions/src/index.ts:314) and
    // Firestore indexes nulls, so threads with no messages are still returned.
    // The participants/status/lastMessageAt composite index is defined in
    // firestore.indexes.json and must be READY before this client ships.
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onChange(snapshot.docs.map((threadDoc) => {
        const data = threadDoc.data();
        return {
          threadId: typeof data.threadId === "string" ? data.threadId : threadDoc.id,
          traineeId: typeof data.traineeId === "string" ? data.traineeId : "",
          coachId: typeof data.coachId === "string" ? data.coachId : "",
          lastMessageText: typeof data.lastMessageText === "string" ? data.lastMessageText : "",
          lastMessageType: data.lastMessageType === "image" ? "image" : "text",
          lastMessageAt: data.lastMessageAt ? toIsoString(data.lastMessageAt) : null,
          lastSenderId: typeof data.lastSenderId === "string" ? data.lastSenderId : null,
          unreadByCoach: Number(data.unreadByCoach) || 0,
        };
      }));
    },
    (error) => {
      console.error("[ChatService] Coach thread summaries subscription failed:", error);
      onChange([]);
      onError?.(error);
    }
  );
};

type SendChatMessageInput = {
  threadId: string;
  traineeId: string;
  coachId: string;
  type: ChatMessageType;
  text?: string;
  image?: ChatImage;
};

export const sendChatMessage = async ({
  threadId,
  traineeId,
  coachId,
  type,
  text = "",
  image,
}: SendChatMessageInput): Promise<void> => {
  const senderId = auth.currentUser?.uid;
  if (!senderId) throw new Error("You must be signed in to send messages.");

  const receiverId = senderId === traineeId ? coachId : traineeId;
  const messageRef = doc(collection(db, chatsCollection, threadId, "messages"));
  const threadRef = doc(db, chatThreadsCollection, threadId);
  const previewText = type === "image" ? "Image" : text.slice(0, 500);
  const batch = writeBatch(db);

  batch.set(messageRef, {
    threadId,
    senderId,
    receiverId,
    participants: [traineeId, coachId],
    type,
    text,
    image: image ?? null,
    status: "sent",
    createdAt: serverTimestamp(),
    readAt: null,
  });
  batch.update(threadRef, {
    lastMessageText: previewText,
    lastMessageType: type,
    lastSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    ...(senderId === traineeId
      ? { unreadByCoach: increment(1) }
      : { unreadByTrainee: increment(1) }),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

/**
 * Resets the caller's unread counter on a thread.
 *
 * Runs in a transaction, not read-then-write. A message arriving between a
 * separate read and update would have its increment overwritten by the zero —
 * and because the counter is absolute rather than event-sourced, the next
 * message would not restore the lost unread. Firestore retries the transaction
 * when the thread changes before commit, so the increment is never swallowed.
 *
 * The active-participant check is unchanged and still mirrored in the rules;
 * this guard is for a useful error message, not for security.
 */
export const markThreadRead = async (threadId: string): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in.");
  const threadRef = doc(db, chatThreadsCollection, threadId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(threadRef);
    if (!snapshot.exists()) throw new Error("Conversation is unavailable.");

    const thread = snapshot.data();
    if (
      thread.status !== "active"
      || !Array.isArray(thread.participants)
      || !thread.participants.includes(uid)
    ) {
      throw new Error("You cannot update this conversation.");
    }

    const field = uid === thread.coachId ? "unreadByCoach" : "unreadByTrainee";
    // Nothing to do — skip the write so an idle chat screen does not churn the
    // document (and cannot race with an incoming message for no reason).
    if (Number(thread[field] || 0) === 0) return;

    transaction.update(threadRef, {
      [field]: 0,
      updatedAt: serverTimestamp(),
    });
  });
};

export const fetchLatestThreadMessage = async (threadId: string): Promise<ChatThreadSummary | null> => {
  const threadSnapshot = await getDoc(doc(db, chatThreadsCollection, threadId));
  if (threadSnapshot.exists()) {
    const data = threadSnapshot.data();
    return {
      threadId,
      lastMessageText: typeof data.lastMessageText === "string" ? data.lastMessageText : "",
      lastMessageType: data.lastMessageType === "image" ? "image" : "text",
      lastMessageAt: data.lastMessageAt ? toIsoString(data.lastMessageAt) : null,
      lastSenderId: typeof data.lastSenderId === "string" ? data.lastSenderId : null,
    };
  }

  const messagesQuery = query(
    collection(db, chatsCollection, threadId, "messages"),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(messagesQuery);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  const message = parseChatMessage(docSnap.id, docSnap.data());
  return {
    threadId,
    lastMessageText: message.type === "image" ? "Image" : message.text,
    lastMessageType: message.type,
    lastMessageAt: message.createdAt,
    lastSenderId: message.senderId,
  };
};
