import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { CheckInTask, CheckInTaskStatus, CoachNote } from "../../../../packages/shared/src";
export type { CheckInTask, CheckInTaskStatus, CoachNote } from "../../../../packages/shared/src";

const usersCollection = "users";

export type SaveCoachNoteInput = {
  traineeId: string;
  text: string;
};

export type CreateCheckInTaskInput = {
  traineeId: string;
  title: string;
  description?: string;
  dueDate?: string;
};

export const subscribeToCoachNotes = (
  traineeId: string,
  callback: (notes: CoachNote[]) => void
) => {
  const q = query(
    collection(db, usersCollection, traineeId, "coachNotes"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((noteDoc) => ({
        id: noteDoc.id,
        ...noteDoc.data(),
      } as CoachNote)));
    },
    (error) => {
      console.error("[CoachOperationsService] Coach notes subscription failed:", error);
      callback([]);
    }
  );
};

export const saveCoachNote = async ({ traineeId, text }: SaveCoachNoteInput): Promise<void> => {
  const coachId = auth.currentUser?.uid;
  if (!coachId) throw new Error("You must be signed in to save a note.");
  const cleanText = text.trim();
  if (!cleanText) throw new Error("Note text is required.");

  await addDoc(collection(db, usersCollection, traineeId, "coachNotes"), {
    traineeId,
    coachId,
    text: cleanText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToOpenCheckInTasks = (
  traineeId: string,
  callback: (tasks: CheckInTask[]) => void
) => {
  const q = query(
    collection(db, usersCollection, traineeId, "checkInTasks"),
    where("status", "==", "open"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((taskDoc) => ({
        id: taskDoc.id,
        ...taskDoc.data(),
      } as CheckInTask)));
    },
    (error) => {
      console.error("[CoachOperationsService] Check-in tasks subscription failed:", error);
      callback([]);
    }
  );
};

export const createCheckInTask = async ({
  traineeId,
  title,
  description,
  dueDate,
}: CreateCheckInTaskInput): Promise<void> => {
  const coachId = auth.currentUser?.uid;
  if (!coachId) throw new Error("You must be signed in to create a check-in task.");
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("Task title is required.");

  await addDoc(collection(db, usersCollection, traineeId, "checkInTasks"), {
    traineeId,
    coachId,
    title: cleanTitle,
    description: description?.trim() || "",
    dueDate: dueDate || null,
    status: "open" satisfies CheckInTaskStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateCheckInTaskStatus = async (
  traineeId: string,
  taskId: string,
  status: CheckInTaskStatus
): Promise<void> => {
  const update: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "completed") update.completedAt = serverTimestamp();

  await setDoc(doc(db, usersCollection, traineeId, "checkInTasks", taskId), update, { merge: true });
};
