import { timingSafeEqual } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  DEFAULT_REPORT_TIMEZONE,
  isResolvableTimeZone,
  reviewAvailableAtDate,
} from "./dateBoundaries";

initializeApp();

const db = getFirestore();

const usersCollection = "users";
const coachRequestsCollection = "coachRequests";
const assignmentsCollection = "assignments";
const chatThreadsCollection = "chatThreads";
const auditEventsCollection = "auditEvents";

type AssignmentResolution = {
  traineeId?: unknown;
  accept?: unknown;
};

type CoachRequestInput = {
  coachId?: unknown;
  coachName?: unknown;
};

type MarkReadInput = {
  threadId?: unknown;
};

type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "EXPIRATION"
  | "SUBSCRIBER_ALIAS"
  | "TRANSFER";

function requireAuth(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return uid;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value.trim();
}

function coachRequestId(traineeId: string, coachId: string): string {
  return `${traineeId}_${coachId}`;
}

function chatThreadId(traineeId: string, coachId: string): string {
  return [traineeId, coachId].sort().join("_");
}

function assignmentThreadId(
  assignmentId: string,
  assignment: FirebaseFirestore.DocumentData
): string {
  if (typeof assignment.threadId === "string" && assignment.threadId.length > 0) {
    return assignment.threadId;
  }

  const traineeId = String(assignment.traineeId || "");
  const coachId = String(assignment.coachId || "");
  // Legacy assignments used trainee_coach while their thread used the sorted
  // pair. New assignment ids and thread ids are identical.
  return assignmentId === coachRequestId(traineeId, coachId)
    ? chatThreadId(traineeId, coachId)
    : assignmentId;
}

function toDateKey(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

/** The instant the client's day ends — when their report becomes reviewable. */
function reviewAvailableAtFor(dateKey: string, timeZone: string): Timestamp {
  return Timestamp.fromDate(reviewAvailableAtDate(dateKey, timeZone));
}

async function logAuditEvent(input: {
  actorId: string;
  eventName: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await db.collection(auditEventsCollection).add({
    ...input,
    metadata: input.metadata ?? {},
    trusted: true,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function assertRole(userData: FirebaseFirestore.DocumentData | undefined, role: string) {
  if (!userData || userData.role !== role) {
    throw new HttpsError("permission-denied", `Expected ${role} account.`);
  }
}

async function recomputeClientSummary(traineeId: string) {
  const since = Timestamp.fromMillis(Date.now() - 7 * 86400000);
  const dateSince = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const userRef = db.collection(usersCollection).doc(traineeId);

  const [workouts, meals] = await Promise.all([
    userRef.collection("workouts").where("createdAt", ">=", since).get(),
    userRef.collection("meals").where("date", ">=", dateSince).get(),
  ]);

  const totalProtein = meals.docs.reduce((sum, meal) => {
    return sum + (Number(meal.data().protein) || 0);
  }, 0);
  const lastWorkoutAt = workouts.docs.reduce<Timestamp | null>((latest, workout) => {
    const value = workout.data().createdAt;
    if (!(value instanceof Timestamp)) return latest;
    if (!latest || value.toMillis() > latest.toMillis()) return value;
    return latest;
  }, null);
  const lastMealDate = meals.docs.reduce<string | null>((latest, meal) => {
    const value = meal.data().date;
    if (typeof value !== "string") return latest;
    if (!latest || value > latest) return value;
    return latest;
  }, null);

  const summary = {
    workoutsLast7Days: workouts.size,
    mealsLast7Days: meals.size,
    avgDailyProtein: Math.round(totalProtein / 7),
    lastWorkoutAt,
    lastMealAt: lastMealDate,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await Promise.all([
    userRef.set({ clientSummary: summary, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    userRef.collection("summaries").doc("client").set(summary, { merge: true }),
  ]);
}

// --- DAILY REPORT METADATA -------------------------------------------------
//
// A daily report is OPERATIONAL STATE, not a copy of the client's logs. The raw
// workout / meal / water / metric / photo documents remain the source of truth
// and the report screen reads them directly; this document exists so a coach
// can triage which days still need looking at.
//
// It therefore stores presence booleans, not counts. A count means scanning
// every log on every write, and a capped count silently lies once the cap is
// hit — "5 of 5 meals" when there were nine.
//
// IDEMPOTENCY. Firestore triggers are at-least-once, so nothing here may use
// FieldValue.increment: a replayed event would inflate the value. Presence is
// recomputed from existence probes, and the one real counter (reopenCount) is
// guarded by the event id that caused it.

const DAILY_REPORT_SCHEMA_VERSION = 1;

type ReportPresence = {
  hasWorkout: boolean;
  hasMeals: boolean;
  hasWater: boolean;
  hasMetrics: boolean;
  hasPhoto: boolean;
};

/**
 * Which log types exist for this client-day.
 *
 * Five bounded `limit(1)` reads. Deliberately not a count — see above. Run
 * outside the transaction: presence is derived data that converges on the next
 * trigger, and holding five queries open inside a transaction would create
 * contention on a document written by every log the client makes.
 */
async function probeDailyPresence(traineeId: string, dateKey: string): Promise<ReportPresence> {
  const userRef = db.collection(usersCollection).doc(traineeId);
  const probe = async (sub: string) => {
    const snap = await userRef.collection(sub).where("date", "==", dateKey).limit(1).get();
    return !snap.empty;
  };

  const [hasWorkout, hasMeals, hasWater, hasMetrics, hasPhoto] = await Promise.all([
    probe("workouts"),
    probe("meals"),
    probe("water"),
    probe("metrics"),
    probe("photos"),
  ]);

  return { hasWorkout, hasMeals, hasWater, hasMetrics, hasPhoto };
}

/**
 * Creates or refreshes one client-day's report metadata.
 *
 * State machine:
 *
 *   ∅ ──first log──> LIVE ──day ends──> PENDING_REVIEW ──coach──> REVIEWED
 *                      │                      ^                       │
 *                      └── first log arrives  │      late log         │
 *                          after day end ─────┘ <─────────────────────┘
 *
 * A first log for a day that has already ended is created directly as
 * PENDING_REVIEW — it is never briefly LIVE. A log landing on an already
 * REVIEWED day reopens it, because the coach reviewed something incomplete.
 */
async function upsertDailyReport(input: {
  traineeId: string;
  dateKey: string;
  eventId: string;
  activityAt?: Timestamp | null;
}): Promise<void> {
  const { traineeId, dateKey, eventId } = input;
  if (!traineeId || !dateKey) return;

  const userSnap = await db.collection(usersCollection).doc(traineeId).get();
  const user = userSnap.data();
  if (!user) return;

  const timezone = isResolvableTimeZone(user.timezone)
    ? String(user.timezone)
    : DEFAULT_REPORT_TIMEZONE;
  const coachId = typeof user.selectedCoachId === "string" ? user.selectedCoachId : null;
  const assignmentId = typeof user.activeAssignmentId === "string" ? user.activeAssignmentId : null;

  const presence = await probeDailyPresence(traineeId, dateKey);
  const hasActivity = presence.hasWorkout || presence.hasMeals || presence.hasWater
    || presence.hasMetrics || presence.hasPhoto;

  const reportRef = db.collection(usersCollection).doc(traineeId)
    .collection("dailyReports").doc(dateKey);
  const reviewAvailableAt = reviewAvailableAtFor(dateKey, timezone);
  const activityAt = input.activityAt ?? Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reportRef);
    const existing = snapshot.data();
    const dayHasEnded = Timestamp.now().toMillis() >= reviewAvailableAt.toMillis();

    // A day with nothing logged is not a report. If the last log for this date
    // was deleted and one was never reviewed, drop the document rather than
    // leave an empty shell in the coach's queue.
    if (!hasActivity && (!existing || existing.reviewStatus !== "reviewed")) {
      if (snapshot.exists) transaction.delete(reportRef);
      return;
    }

    const base = {
      clientDateKey: dateKey,
      timezone,
      traineeId,
      coachId,
      assignmentId,
      reviewAvailableAt,
      ...presence,
      hasActivity,
      lastActivityAt: activityAt,
      schemaVersion: DAILY_REPORT_SCHEMA_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!snapshot.exists || !existing) {
      transaction.set(reportRef, {
        ...base,
        firstActivityAt: activityAt,
        reviewStatus: dayHasEnded ? "pending_review" : "live",
        reviewedAt: null,
        reviewedByCoachId: null,
        reopenedAt: null,
        reopenCount: 0,
        lastReopenReason: null,
        lastLogEventId: eventId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const previousStatus = String(existing.reviewStatus || "live");
    const alreadySeenEvent = existing.lastLogEventId === eventId;

    let reviewStatus = previousStatus;
    const reopen: Record<string, unknown> = {};

    if (previousStatus === "reviewed" && !alreadySeenEvent) {
      // Late log on a reviewed day. `reopenCount` is read-then-written rather
      // than incremented so a replayed event cannot inflate it, and the event
      // id makes the replay itself a no-op.
      reviewStatus = "pending_review";
      reopen.reopenedAt = FieldValue.serverTimestamp();
      reopen.reopenCount = Number(existing.reopenCount || 0) + 1;
      reopen.lastReopenReason = "late_log";
      reopen.reviewedAt = null;
      reopen.reviewedByCoachId = null;
    } else if (previousStatus === "live" && dayHasEnded) {
      reviewStatus = "pending_review";
    }

    // lastActivityAt only ever moves forward.
    const existingLast = existing.lastActivityAt instanceof Timestamp ? existing.lastActivityAt : null;
    const lastActivityAt = existingLast && existingLast.toMillis() > activityAt.toMillis()
      ? existingLast
      : activityAt;

    transaction.set(reportRef, {
      ...base,
      lastActivityAt,
      reviewStatus,
      lastLogEventId: eventId,
      ...reopen,
    }, { merge: true });
  });
}

/**
 * Shared handler for every dated client log.
 *
 * Handles the three cases a naive trigger gets wrong:
 *   - DELETE — recompute the date the document used to be on.
 *   - DATE CHANGE — recompute BOTH the old and the new date.
 *   - MIGRATION WRITE — skip entirely, so a backfill cannot mass-reopen
 *     reviewed reports for every client at once.
 */
async function handleDatedLogWritten(event: {
  id: string;
  params: Record<string, string>;
  data?: { before?: FirebaseFirestore.DocumentSnapshot; after?: FirebaseFirestore.DocumentSnapshot };
}): Promise<void> {
  const traineeId = String(event.params.userId || "");
  if (!traineeId) return;

  const before = event.data?.before;
  const after = event.data?.after;
  const afterData = after?.exists ? after.data() : undefined;

  if (afterData?.migrationWrite === true) return;

  const beforeDate = before?.exists ? toDateKey(before.data()?.date) : null;
  const afterDate = afterData ? toDateKey(afterData.date) : null;

  const activityAt = afterData?.createdAt instanceof Timestamp ? afterData.createdAt : null;

  const dates = new Set<string>();
  if (beforeDate) dates.add(beforeDate);
  if (afterDate) dates.add(afterDate);

  for (const dateKey of dates) {
    await upsertDailyReport({
      traineeId,
      dateKey,
      eventId: event.id,
      activityAt: dateKey === afterDate ? activityAt : null,
    });
  }
}

export const requestCoachAssignment = onCall(async (request) => {
  const traineeId = requireAuth(request.auth?.uid);
  const input = request.data as CoachRequestInput;
  const coachId = requireString(input.coachId, "coachId");
  const coachName = requireString(input.coachName, "coachName");
  const requestRef = db.collection(coachRequestsCollection).doc(coachRequestId(traineeId, coachId));
  const traineeRef = db.collection(usersCollection).doc(traineeId);
  const coachRef = db.collection(usersCollection).doc(coachId);

  await db.runTransaction(async (transaction) => {
    const pendingRequestsQuery = db.collection(coachRequestsCollection)
      .where("traineeId", "==", traineeId)
      .where("status", "==", "pending");

    const [traineeSnapshot, coachSnapshot, pendingRequestsSnapshot] = await Promise.all([
      transaction.get(traineeRef),
      transaction.get(coachRef),
      transaction.get(pendingRequestsQuery),
    ]);
    const trainee = traineeSnapshot.data();
    const coach = coachSnapshot.data();
    assertRole(trainee, "trainee");
    assertRole(coach, "coach");

    if (trainee?.profileCompleted !== true) {
      throw new HttpsError("failed-precondition", "Complete your profile before requesting a coach.");
    }

    if (trainee?.assignmentStatus === "assigned") {
      throw new HttpsError("failed-precondition", "You already have an assigned coach.");
    }

    const profile = trainee?.profile ?? {};
    const basic = profile.basic ?? profile;

    pendingRequestsSnapshot.docs.forEach((pendingDoc) => {
      if (pendingDoc.id === requestRef.id) return;
      transaction.set(pendingDoc.ref, {
        status: "cancelled",
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        cancellationReason: "superseded_by_new_request",
      }, { merge: true });
    });

    transaction.set(traineeRef, {
      assignmentStatus: "pending",
      selectedCoachId: coachId,
      selectedCoachName: coachName,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(requestRef, {
      traineeId,
      coachId,
      coachName,
      traineeName: trainee?.name || "Anonymous",
      traineeGoal: basic.goal || trainee?.goal || "General Fitness",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await logAuditEvent({
    actorId: traineeId,
    eventName: "assignment_requested",
    entityType: "coachRequest",
    entityId: requestRef.id,
    metadata: { traineeId, coachId },
  });

  return { requestId: requestRef.id };
});

export const cancelCoachAssignmentRequest = onCall(async (request) => {
  const traineeId = requireAuth(request.auth?.uid);
  const traineeRef = db.collection(usersCollection).doc(traineeId);
  const pendingRequests = await db.collection(coachRequestsCollection)
    .where("traineeId", "==", traineeId)
    .where("status", "==", "pending")
    .get();

  const batch = db.batch();
  batch.set(traineeRef, {
    assignmentStatus: "unassigned",
    selectedCoachId: null,
    selectedCoachName: null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  pendingRequests.docs.forEach((requestDoc) => {
    batch.set(requestDoc.ref, {
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  await logAuditEvent({
    actorId: traineeId,
    eventName: "assignment_cancelled",
    entityType: "coachRequest",
    entityId: traineeId,
    metadata: { traineeId, cancelledCount: pendingRequests.size },
  });

  return { cancelledCount: pendingRequests.size };
});

export const resolveCoachRequest = onCall(async (request) => {
  const coachId = requireAuth(request.auth?.uid);
  const input = request.data as AssignmentResolution;
  const traineeId = requireString(input.traineeId, "traineeId");
  const accept = input.accept === true;
  const requestId = coachRequestId(traineeId, coachId);
  const requestRef = db.collection(coachRequestsCollection).doc(requestId);
  const traineeRef = db.collection(usersCollection).doc(traineeId);

  // A relationship instance gets its own identity. The id is NOT derived from
  // the pair: a coach and client who reconnect must get a distinct assignment,
  // otherwise the second relationship silently overwrites the first and a
  // returning coach inherits access to the earlier one's data and chat history.
  const assignmentRef = db.collection(assignmentsCollection).doc();
  // The chat thread is scoped to the assignment for the same reason.
  const threadId = assignmentRef.id;
  const threadRef = db.collection(chatThreadsCollection).doc(threadId);

  await db.runTransaction(async (transaction) => {
    const [requestSnapshot, traineeSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(traineeRef),
    ]);
    const coachSnapshot = await transaction.get(db.collection(usersCollection).doc(coachId));
    assertRole(coachSnapshot.data(), "coach");

    // Read every still-active assignment for this trainee before any write —
    // Firestore transactions require all reads first. At most one may survive.
    const priorActive = await transaction.get(
      db.collection(assignmentsCollection)
        .where("traineeId", "==", traineeId)
        .where("status", "==", "active")
    );

    const requestData = requestSnapshot.data();
    const traineeData = traineeSnapshot.data();
    if (!requestSnapshot.exists || requestData?.status !== "pending") {
      throw new HttpsError("failed-precondition", "This coach request is no longer pending.");
    }
    if (requestData.coachId !== coachId || requestData.traineeId !== traineeId) {
      throw new HttpsError("permission-denied", "You cannot resolve this request.");
    }
    if (!traineeSnapshot.exists || traineeData?.assignmentStatus !== "pending") {
      throw new HttpsError("failed-precondition", "Trainee assignment state is invalid.");
    }
    if (traineeData.selectedCoachId !== coachId) {
      throw new HttpsError("permission-denied", "This trainee requested another coach.");
    }

    transaction.set(requestRef, {
      status: accept ? "accepted" : "rejected",
      respondedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(traineeRef, {
      assignmentStatus: accept ? "assigned" : "rejected",
      selectedCoachId: accept ? coachId : null,
      selectedCoachName: accept ? requestData.coachName || null : null,
      activeAssignmentId: accept ? assignmentRef.id : null,
      ...(accept ? {
        // Message summary belongs to the current relationship. Do not carry a
        // previous assignment's preview or unread count into the new one.
        clientSummary: {
          lastMessageAt: null,
          lastMessageText: "",
          lastMessageSenderId: null,
          unreadCoachCount: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
      } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!accept) return;

    // Close out any prior relationship in the same transaction, so a trainee
    // can never hold two active assignments and the previous coach's thread
    // access is revoked at the instant the new one begins.
    priorActive.docs.forEach((priorDoc) => {
      transaction.set(priorDoc.ref, {
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        endedBy: coachId,
        endReason: "replaced",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const priorThreadId = assignmentThreadId(priorDoc.id, priorDoc.data());
      transaction.set(db.collection(chatThreadsCollection).doc(priorThreadId), {
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    transaction.set(assignmentRef, {
      traineeId,
      coachId,
      threadId,
      status: "active",
      sourceRequestId: requestId,
      startedAt: FieldValue.serverTimestamp(),
      endedAt: null,
      endedBy: null,
      endReason: null,
      schemaVersion: 2,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(threadRef, {
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(traineeRef.collection("summaries").doc("client"), {
      lastMessageAt: null,
      lastMessageText: "",
      lastMessageSenderId: null,
      unreadCoachCount: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await logAuditEvent({
    actorId: coachId,
    eventName: accept ? "assignment_approved" : "assignment_rejected",
    entityType: "coachRequest",
    entityId: requestId,
    metadata: { traineeId, coachId, accepted: accept },
  });

  return { requestId, threadId: accept ? threadId : null };
});

/**
 * Ends the caller's active coaching relationship.
 *
 * Either party may end it — the client is not locked into a coach, and a coach
 * must be able to release a client they no longer work with.
 *
 * Ending is what revokes the coach's access: the assignment flips to "ended",
 * the chat thread flips to "ended" (rules then deny the coach both the thread
 * and its messages, while the client keeps their own history), and the
 * trainee's activeAssignmentId is cleared. Nothing is deleted — historical
 * records stay intact and stay stamped with this assignmentId.
 *
 * Idempotent: ending an already-ended assignment is a no-op, not an error.
 */
export const endCoachAssignment = onCall(async (request) => {
  const callerId = requireAuth(request.auth?.uid);
  const assignmentId = requireString(
    (request.data as { assignmentId?: unknown })?.assignmentId,
    "assignmentId"
  );
  const reasonInput = (request.data as { reason?: unknown })?.reason;

  const assignmentRef = db.collection(assignmentsCollection).doc(assignmentId);

  const result = await db.runTransaction(async (transaction) => {
    const assignmentSnapshot = await transaction.get(assignmentRef);
    if (!assignmentSnapshot.exists) {
      throw new HttpsError("not-found", "This assignment does not exist.");
    }

    const assignment = assignmentSnapshot.data() || {};
    const traineeId = String(assignment.traineeId || "");
    const coachId = String(assignment.coachId || "");

    if (callerId !== traineeId && callerId !== coachId) {
      throw new HttpsError("permission-denied", "You are not part of this assignment.");
    }

    const traineeRef = db.collection(usersCollection).doc(traineeId);
    const threadId = assignmentThreadId(assignmentId, assignment);
    const threadRef = db.collection(chatThreadsCollection).doc(threadId);
    const [traineeSnapshot, threadSnapshot] = await Promise.all([
      transaction.get(traineeRef),
      transaction.get(threadRef),
    ]);
    const alreadyEnded = assignment.status === "ended";

    if (!alreadyEnded) {
      transaction.set(assignmentRef, {
        threadId,
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        endedBy: callerId,
        endReason: callerId === coachId ? "coach_ended" : "client_ended",
        endNote: typeof reasonInput === "string" ? reasonInput.slice(0, 500) : null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Do not create a phantom thread when repairing an old partial assignment.
    if (threadSnapshot.exists && threadSnapshot.data()?.status !== "ended") {
      transaction.set(threadRef, {
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Only detach the trainee if this is still the assignment they point at.
    // Guards against a stale call clearing a newer relationship.
    if (traineeSnapshot.exists && traineeSnapshot.data()?.activeAssignmentId === assignmentId) {
      transaction.set(traineeRef, {
        assignmentStatus: "unassigned",
        selectedCoachId: null,
        selectedCoachName: null,
        activeAssignmentId: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { assignmentId, alreadyEnded, traineeId, coachId };
  });

  if (!result.alreadyEnded) {
    await logAuditEvent({
      actorId: callerId,
      eventName: "assignment_ended",
      entityType: "assignment",
      entityId: assignmentId,
      metadata: { traineeId: result.traineeId, coachId: result.coachId, endedBy: callerId },
    });
  }

  return { assignmentId, alreadyEnded: result.alreadyEnded };
});

export const markCoachThreadRead = onCall(async (request) => {
  const coachId = requireAuth(request.auth?.uid);
  const threadId = requireString((request.data as MarkReadInput).threadId, "threadId");
  const threadRef = db.collection(chatThreadsCollection).doc(threadId);
  await db.runTransaction(async (transaction) => {
    const threadSnapshot = await transaction.get(threadRef);
    const thread = threadSnapshot.data();
    if (!threadSnapshot.exists || thread?.coachId !== coachId || thread?.status !== "active") {
      throw new HttpsError("permission-denied", "You cannot update this thread.");
    }

    const traineeId = requireString(thread.traineeId, "traineeId");
    const assignmentId = requireString(thread.assignmentId, "assignmentId");
    const traineeRef = db.collection(usersCollection).doc(traineeId);
    const traineeSnapshot = await transaction.get(traineeRef);
    if (!traineeSnapshot.exists || traineeSnapshot.data()?.activeAssignmentId !== assignmentId) {
      throw new HttpsError("failed-precondition", "This thread is not the trainee's active relationship.");
    }

    transaction.set(threadRef, {
      unreadByCoach: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(traineeRef, {
      clientSummary: {
        unreadCoachCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(traineeRef.collection("summaries").doc("client"), {
      unreadCoachCount: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { threadId };
});

export const rebuildClientSummary = onCall(async (request) => {
  const actorId = requireAuth(request.auth?.uid);
  const traineeId = requireString((request.data as { traineeId?: unknown }).traineeId, "traineeId");
  const traineeSnapshot = await db.collection(usersCollection).doc(traineeId).get();
  const trainee = traineeSnapshot.data();
  if (actorId !== traineeId && trainee?.selectedCoachId !== actorId) {
    throw new HttpsError("permission-denied", "You cannot rebuild this summary.");
  }

  await recomputeClientSummary(traineeId);
  await logAuditEvent({
    actorId,
    eventName: "client_summary_rebuilt",
    entityType: "clientSummary",
    entityId: traineeId,
  });
  return { traineeId };
});

export const onChatMessageCreated = onDocumentCreated("chats/{threadId}/messages/{messageId}", async (event) => {
  const message = event.data?.data();
  if (!message) return;

  const threadId = String(event.params.threadId);
  const senderId = String(message.senderId || "");
  const traineeId = String((message.participants || []).find((id: string) => id !== message.receiverId) || message.traineeId || "");
  const threadSnapshot = await db.collection(chatThreadsCollection).doc(threadId).get();
  const thread = threadSnapshot.data();
  if (!threadSnapshot.exists || !thread) {
    logger.error("Chat message has no parent thread", { threadId, messageId: event.params.messageId });
    return;
  }
  const canonicalTraineeId = thread?.traineeId || traineeId;
  const coachId = thread?.coachId || message.receiverId;
  const isTraineeSender = senderId === canonicalTraineeId;
  const summaryText = message.type === "image" ? "Image" : String(message.text || "");
  const traineeRef = db.collection(usersCollection).doc(canonicalTraineeId);
  const traineeSnapshot = await traineeRef.get();
  const isCurrentRelationship = thread.status === "active"
    && typeof thread.assignmentId === "string"
    && traineeSnapshot.data()?.activeAssignmentId === thread.assignmentId;

  const writes: Promise<unknown>[] = [
    db.collection(chatThreadsCollection).doc(threadId).set({
      lastMessageText: summaryText,
      lastMessageType: message.type === "image" ? "image" : "text",
      lastSenderId: senderId,
      lastMessageAt: message.createdAt || FieldValue.serverTimestamp(),
      ...(isCurrentRelationship ? {
        unreadByCoach: isTraineeSender ? FieldValue.increment(1) : FieldValue.increment(0),
        unreadByTrainee: !isTraineeSender ? FieldValue.increment(1) : FieldValue.increment(0),
      } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
    logAuditEvent({
      actorId: senderId,
      eventName: "coach_message_sent",
      entityType: "chatThread",
      entityId: threadId,
      metadata: { coachId, traineeId: canonicalTraineeId, type: message.type || "text" },
    }),
  ];

  if (isCurrentRelationship) {
    writes.push(
      traineeRef.set({
        clientSummary: {
          lastMessageAt: message.createdAt || FieldValue.serverTimestamp(),
          lastMessageText: summaryText,
          lastMessageSenderId: senderId,
          unreadCoachCount: isTraineeSender ? FieldValue.increment(1) : FieldValue.increment(0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
      traineeRef.collection("summaries").doc("client").set({
        lastMessageAt: message.createdAt || FieldValue.serverTimestamp(),
        lastMessageText: summaryText,
        lastMessageSenderId: senderId,
        unreadCoachCount: isTraineeSender ? FieldValue.increment(1) : FieldValue.increment(0),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    );
  } else {
    logger.warn("Skipped stale chat summary update", { threadId, assignmentId: thread.assignmentId });
  }

  await Promise.all(writes);
});

export const onWorkoutWritten = onDocumentWritten("users/{userId}/workouts/{workoutId}", async (event) => {
  const userId = String(event.params.userId);
  const after = event.data?.after;
  if (after?.exists) {
    const data = after.data();
    if (data && !data.date) {
      const date = toDateKey(data.createdAt) || new Date().toISOString().slice(0, 10);
      await after.ref.set({ date, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  // clientSummary and dailyReports write disjoint fields on different
  // documents, so neither can clobber the other and no ordering is assumed.
  await recomputeClientSummary(userId);
  await handleDatedLogWritten(event);
});

export const onMealWritten = onDocumentWritten("users/{userId}/meals/{mealId}", async (event) => {
  await recomputeClientSummary(String(event.params.userId));
  await handleDatedLogWritten(event);
});

export const onWaterWritten = onDocumentWritten("users/{userId}/water/{waterId}", async (event) => {
  await handleDatedLogWritten(event);
});

export const onMetricWritten = onDocumentWritten("users/{userId}/metrics/{metricId}", async (event) => {
  await handleDatedLogWritten(event);
});

export const onProgressPhotoWritten = onDocumentWritten("users/{userId}/photos/{photoId}", async (event) => {
  await handleDatedLogWritten(event);
});

/**
 * Moves reports from `live` to `pending_review` once the client's day has ended.
 *
 * Runs hourly rather than nightly because "the day has ended" is a different
 * instant for every timezone — a single nightly job would finalise the wrong
 * day for anyone outside the server's zone.
 *
 * This is also the only mechanism that can detect ABSENCE. A write trigger
 * fires when something happens; nothing fires when a client simply stops
 * logging, so without this sweep a day would sit in `live` forever.
 *
 * Ordered, limited and paginated: an unbounded collection-group read would
 * eventually time out and silently stop finalising anyone.
 */
export const sweepDailyReportsToPending = onSchedule("every 60 minutes", async () => {
  const PAGE = 200;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let promoted = 0;

  for (;;) {
    let query = db.collectionGroup("dailyReports")
      .where("reviewStatus", "==", "live")
      .where("reviewAvailableAt", "<=", Timestamp.now())
      .orderBy("reviewAvailableAt")
      .limit(PAGE);
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      // Re-checked per document: the status may have moved since the query.
      if (doc.data().reviewStatus !== "live") return;
      batch.set(doc.ref, {
        reviewStatus: "pending_review",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      promoted += 1;
    });
    await batch.commit();

    if (snapshot.size < PAGE) break;
    cursor = snapshot.docs[snapshot.size - 1];
  }

  logger.info("sweepDailyReportsToPending", { promoted });
});

/**
 * Marks one client-day reviewed.
 *
 * "Reviewed" means only that the coach looked at it. It is NOT a judgement on
 * the client's performance, and nothing in the system infers one from it.
 *
 * Only the coach on the client's CURRENT assignment may review, so a former
 * coach cannot act on a client they no longer work with. Idempotent: reviewing
 * an already-reviewed report succeeds without rewriting the timestamp.
 */
export const markDailyReportReviewed = onCall(async (request) => {
  const coachId = requireAuth(request.auth?.uid);
  const input = request.data as { traineeId?: unknown; clientDateKey?: unknown };
  const traineeId = requireString(input?.traineeId, "traineeId");
  const clientDateKey = requireString(input?.clientDateKey, "clientDateKey");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(clientDateKey)) {
    throw new HttpsError("invalid-argument", "clientDateKey must be YYYY-MM-DD.");
  }

  const reportRef = db.collection(usersCollection).doc(traineeId)
    .collection("dailyReports").doc(clientDateKey);

  const result = await db.runTransaction(async (transaction) => {
    const [reportSnapshot, traineeSnapshot] = await Promise.all([
      transaction.get(reportRef),
      transaction.get(db.collection(usersCollection).doc(traineeId)),
    ]);

    const trainee = traineeSnapshot.data();
    if (!trainee) throw new HttpsError("not-found", "This client does not exist.");
    if (trainee.selectedCoachId !== coachId || trainee.assignmentStatus !== "assigned") {
      throw new HttpsError("permission-denied", "You are not this client's current coach.");
    }
    if (!reportSnapshot.exists) {
      throw new HttpsError("not-found", "There is no report for this day.");
    }

    if (reportSnapshot.data()?.reviewStatus === "reviewed") {
      return { alreadyReviewed: true };
    }

    transaction.set(reportRef, {
      reviewStatus: "reviewed",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedByCoachId: coachId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { alreadyReviewed: false };
  });

  if (!result.alreadyReviewed) {
    await logAuditEvent({
      actorId: coachId,
      eventName: "daily_report_reviewed",
      entityType: "dailyReport",
      entityId: `${traineeId}/${clientDateKey}`,
      metadata: { traineeId, clientDateKey },
    });
  }

  return { traineeId, clientDateKey, alreadyReviewed: result.alreadyReviewed };
});

export const revenueCatWebhook = onRequest(async (request, response) => {
  // FAIL CLOSED. Previously the secret check was skipped entirely when
  // REVENUECAT_WEBHOOK_SECRET was unset, so a misconfigured deploy exposed an
  // unauthenticated endpoint that could grant or revoke premium for ANY
  // app_user_id. An unconfigured webhook must reject, not accept.
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expectedSecret) {
    logger.error(
      "revenueCatWebhook called but REVENUECAT_WEBHOOK_SECRET is not configured; rejecting."
    );
    response.status(503).send("Webhook not configured.");
    return;
  }

  const provided = request.header("authorization") || "";
  const expected = `Bearer ${expectedSecret}`;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  // Constant-time compare to avoid leaking the secret via response timing.
  const authorized =
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
  if (!authorized) {
    response.status(401).send("Unauthorized");
    return;
  }

  const event = request.body?.event ?? request.body;
  const userId = event?.app_user_id || event?.appUserId || event?.userId;
  const eventType = event?.type as RevenueCatEventType | undefined;
  if (!userId || !eventType) {
    response.status(400).send("Missing RevenueCat user or event type.");
    return;
  }

  const grantsPremium = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"].includes(eventType);
  const revokesPremium = ["EXPIRATION", "BILLING_ISSUE"].includes(eventType);
  const userRef = db.collection(usersCollection).doc(String(userId));

  await Promise.all([
    userRef.collection("subscriptionEvents").add({
      userId,
      eventType,
      productId: event.product_id || null,
      environment: event.environment || null,
      store: event.store || null,
      purchasedAt: event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null,
      expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
      rawPayload: request.body,
      createdAt: FieldValue.serverTimestamp(),
    }),
    (grantsPremium || revokesPremium)
      ? userRef.set({
        isPremium: grantsPremium,
        subscription: {
          plan: event.product_id || null,
          expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
          store: event.store || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      : Promise.resolve(),
    logAuditEvent({
      actorId: "revenuecat",
      eventName: "subscription_event_received",
      entityType: "subscription",
      entityId: String(userId),
      metadata: { eventType, grantsPremium, revokesPremium },
    }),
  ]);

  logger.info("RevenueCat webhook processed", { userId, eventType });
  response.status(200).json({ ok: true });
});
