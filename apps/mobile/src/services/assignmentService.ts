import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { CoachRequest } from "../../../../packages/shared/src";

const coachRequestsCollection = "coachRequests";
const usersCollection = "users";
const assignmentsCollection = "assignments";
const chatThreadsCollection = "chatThreads";

export type CoachRequestWithTrainee = CoachRequest & {
  traineeName: string;
  traineeGoal?: string;
};

export const getCoachRequestId = (traineeId: string, coachId: string): string => {
  return `${traineeId}_${coachId}`;
};

export const requestCoachAssignment = async (
  traineeId: string,
  coach: { id: string; name: string }
): Promise<void> => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== traineeId) {
    throw new Error("You must be signed in as the trainee requesting a coach.");
  }
  if (!coach.id || !coach.name?.trim()) throw new Error("A valid coach is required.");

  const traineeRef = doc(db, usersCollection, traineeId);
  const coachRef = doc(db, usersCollection, coach.id);
  const requestRef = doc(db, coachRequestsCollection, getCoachRequestId(traineeId, coach.id));
  const pendingQuery = query(
    collection(db, coachRequestsCollection),
    where("traineeId", "==", traineeId),
    where("status", "==", "pending"),
    limit(20)
  );

  const [traineeSnapshot, coachSnapshot, pendingSnapshot] = await Promise.all([
    getDoc(traineeRef),
    getDoc(coachRef),
    getDocs(pendingQuery),
  ]);
  const trainee = traineeSnapshot.data();
  const coachProfile = coachSnapshot.data();
  if (!traineeSnapshot.exists() || trainee?.role !== "trainee") throw new Error("Trainee profile is unavailable.");
  if (trainee.profileCompleted !== true) throw new Error("Complete your profile before requesting a coach.");
  if (trainee.assignmentStatus === "assigned") throw new Error("You already have an assigned coach.");
  if (!coachSnapshot.exists() || coachProfile?.role !== "coach") throw new Error("This coach is unavailable.");

  const profile = trainee.profile ?? {};
  const basic = profile.basic ?? profile;
  const batch = writeBatch(db);
  pendingSnapshot.docs.forEach((pendingDoc) => {
    if (pendingDoc.id === requestRef.id) return;
    batch.update(pendingDoc.ref, {
      status: "cancelled",
      cancellationReason: "superseded_by_new_request",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  batch.set(traineeRef, {
    assignmentStatus: "pending",
    selectedCoachId: coach.id,
    selectedCoachName: coach.name.trim(),
    activeAssignmentId: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(requestRef, {
    traineeId,
    coachId: coach.id,
    coachName: coach.name.trim(),
    traineeName: trainee.name || "Anonymous",
    traineeGoal: basic.goal || trainee.goal || "General Fitness",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    respondedAt: null,
    cancelledAt: null,
  });
  await batch.commit();
};

export const cancelCoachAssignmentRequest = async (traineeId: string): Promise<void> => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== traineeId) throw new Error("You cannot cancel this request.");

  const traineeRef = doc(db, usersCollection, traineeId);
  const pendingQuery = query(
    collection(db, coachRequestsCollection),
    where("traineeId", "==", traineeId),
    where("status", "==", "pending"),
    limit(20)
  );
  const pendingSnapshot = await getDocs(pendingQuery);
  const batch = writeBatch(db);
  batch.set(traineeRef, {
    assignmentStatus: "unassigned",
    selectedCoachId: null,
    selectedCoachName: null,
    activeAssignmentId: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  pendingSnapshot.docs.forEach((pendingDoc) => {
    batch.update(pendingDoc.ref, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
};

export const resolveCoachRequest = async (traineeId: string, accept: boolean): Promise<void> => {
  const coachId = auth.currentUser?.uid;
  if (!coachId) throw new Error("You must be signed in to review this request.");

  const requestId = getCoachRequestId(traineeId, coachId);
  const requestRef = doc(db, coachRequestsCollection, requestId);
  const traineeRef = doc(db, usersCollection, traineeId);
  // A pending coach may read the request, but must not receive the trainee's
  // full user/profile document before an assignment exists. The atomic batch
  // below is the authority for the trainee-side preconditions: Firestore rules
  // require the user to still be pending for this coach in the same commit.
  const requestSnapshot = await getDoc(requestRef);
  const requestData = requestSnapshot.data();
  if (!requestSnapshot.exists() || requestData?.status !== "pending") {
    throw new Error("This coach request is no longer pending.");
  }
  if (requestData.coachId !== coachId || requestData.traineeId !== traineeId) {
    throw new Error("You cannot review this request.");
  }

  const batch = writeBatch(db);
  batch.update(requestRef, {
    status: accept ? "accepted" : "rejected",
    respondedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (!accept) {
    batch.set(traineeRef, {
      assignmentStatus: "rejected",
      selectedCoachId: null,
      selectedCoachName: null,
      activeAssignmentId: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return;
  }

  const assignmentRef = doc(collection(db, assignmentsCollection));
  const threadId = assignmentRef.id;
  const threadRef = doc(db, chatThreadsCollection, threadId);
  batch.set(assignmentRef, {
    traineeId,
    coachId,
    threadId,
    status: "active",
    sourceRequestId: requestId,
    startedAt: serverTimestamp(),
    endedAt: null,
    endedBy: null,
    endReason: null,
    schemaVersion: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(threadRef, {
    threadId,
    assignmentId: assignmentRef.id,
    status: "active",
    traineeId,
    coachId,
    participants: [traineeId, coachId],
    lastMessageText: "",
    lastMessageType: "text",
    lastSenderId: null,
    lastMessageAt: null,
    unreadByCoach: 0,
    unreadByTrainee: 0,
    schemaVersion: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(traineeRef, {
    assignmentStatus: "assigned",
    selectedCoachId: coachId,
    selectedCoachName: requestData.coachName || null,
    activeAssignmentId: assignmentRef.id,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
};

/**
 * Ends an active coaching relationship.
 *
 * Note this is distinct from cancelCoachAssignmentRequest, which only cancels
 * a *pending* request. Once a coach has accepted, this is the path that closes
 * the relationship and revokes their access.
 */
export const endCoachAssignment = async (
  assignmentId: string,
  reason?: string
): Promise<{ assignmentId: string; alreadyEnded: boolean }> => {
  if (!assignmentId) throw new Error("An assignment id is required.");
  const callerId = auth.currentUser?.uid;
  if (!callerId) throw new Error("You must be signed in.");
  const assignmentRef = doc(db, assignmentsCollection, assignmentId);
  const assignmentSnapshot = await getDoc(assignmentRef);
  if (!assignmentSnapshot.exists()) throw new Error("This assignment does not exist.");
  const assignment = assignmentSnapshot.data();
  if (callerId !== assignment.traineeId && callerId !== assignment.coachId) {
    throw new Error("You cannot end this assignment.");
  }
  if (assignment.status === "ended") return { assignmentId, alreadyEnded: true };

  const threadId = typeof assignment.threadId === "string" ? assignment.threadId : assignmentId;
  const traineeRef = doc(db, usersCollection, assignment.traineeId);
  const threadRef = doc(db, chatThreadsCollection, threadId);
  const batch = writeBatch(db);
  batch.update(assignmentRef, {
    status: "ended",
    endedAt: serverTimestamp(),
    endedBy: callerId,
    endReason: callerId === assignment.coachId ? "coach_ended" : "client_ended",
    endNote: reason?.slice(0, 500) || null,
    updatedAt: serverTimestamp(),
  });
  batch.update(threadRef, {
    status: "ended",
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(traineeRef, {
    assignmentStatus: "unassigned",
    selectedCoachId: null,
    selectedCoachName: null,
    activeAssignmentId: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { assignmentId, alreadyEnded: false };
};

export const subscribeToPendingCoachRequests = (
  coachId: string,
  callback: (requests: CoachRequestWithTrainee[]) => void
) => {
  const q = query(
    collection(db, coachRequestsCollection),
    where("coachId", "==", coachId),
    where("status", "==", "pending"),
    // Newest requests first. Without this, the limit truncates by document ID
    // (`${traineeId}_${coachId}`, effectively random), so a coach at the cap
    // would silently never see some pending requests. `createdAt` is always
    // written by requestCoachAssignment, and the composite index already
    // exists in firestore.indexes.json.
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map((requestDoc) => {
        const data = requestDoc.data() as Omit<CoachRequest, "id">;

        return {
          id: requestDoc.id,
          ...data,
          traineeName: data.traineeName || "Anonymous",
          traineeGoal: data.traineeGoal || "General Fitness",
        };
      });

      callback(requests);
    },
    (error) => {
      console.error("[AssignmentService] Pending coach requests subscription failed:", error);
      callback([]);
    }
  );
};
