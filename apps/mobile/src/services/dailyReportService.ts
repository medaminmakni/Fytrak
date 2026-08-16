import {
  collection,
  doc,
  documentId,
  endAt,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { type ClientDateContext } from "../utils/dateKeys";
import { deriveReviewStatus, type DailyReportReviewStatus } from "../features/coaching/reviewStatus";
import { shouldAcknowledgePainOnReview } from "../features/coaching/painQueue";

const usersCollection = "users";

/**
 * Operational state for one client-day.
 *
 * This is metadata ONLY — the raw workouts, meals, water, metrics and photos
 * remain the source of truth and are read directly by the report screen. The
 * booleans below say which kinds of log exist, deliberately not how many: a
 * count would mean scanning every log on every write, and a capped count would
 * silently understate a busy day.
 *
 * `reviewStatus` records that the coach LOOKED at the day. It is not a verdict
 * on the client's performance, and nothing derives one from it.
 */
/*
 * `DailyReportReviewStatus` and `deriveReviewStatus` now live in
 * `features/coaching/reviewStatus.ts` — pure, and therefore testable, which
 * this file is not: it imports `config/firebase` and initialises an app on
 * require. Re-exported here so every existing importer keeps working.
 */
export type { DailyReportReviewStatus };

export type DailyReport = {
  clientDateKey: string;
  timezone: string | null;
  traineeId: string;
  coachId: string | null;
  assignmentId: string | null;
  hasActivity: boolean;
  hasWorkout: boolean;
  hasMeals: boolean;
  hasWater: boolean;
  hasMetrics: boolean;
  hasPhoto: boolean;
  firstActivityAt?: unknown;
  lastActivityAt?: unknown;
  reviewStatus: DailyReportReviewStatus;
  reviewAvailableAt?: unknown;
  reviewedAt?: unknown;
  reviewedByCoachId?: string | null;
  reopenedAt?: unknown;
  reopenCount: number;
  lastReopenReason?: string | null;
};

type DailyReportDimension = "Workout" | "Meals" | "Water" | "Metrics" | "Photo";

export const dailyReportRef = (traineeId: string, clientDateKey: string) =>
  doc(db, usersCollection, traineeId, "dailyReports", clientDateKey);

export const dailyReportActivityPatch = (
  traineeId: string,
  context: ClientDateContext,
  dimension: DailyReportDimension
) => ({
  clientDateKey: context.dateKey,
  timezone: context.timezone || null,
  traineeId,
  hasActivity: true,
  [`has${dimension}`]: true,
  lastActivityAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  schemaVersion: 1,
});

/**
 * The patch that clears one presence flag after the last item of that kind is
 * deleted for a day.
 *
 * Deliberately does NOT touch `reviewedAt` / `reviewedByCoachId` / `reviewStatus`.
 * Review history survives deletion — a coach did look at that day, and erasing
 * the record of it because the client removed a meal would be a lie. What the
 * flag change does do is bump `lastActivityAt`, which pushes the derived status
 * back to pending: the day changed after it was reviewed, so it needs another look.
 *
 * `hasActivity` is recomputed from the remaining flags rather than assumed, so a
 * day whose last log of any kind is removed correctly reports no activity.
 */
export const dailyReportPresenceClearPatch = (
  dimension: DailyReportDimension,
  remainingFlags: {
    hasWorkout: boolean;
    hasMeals: boolean;
    hasWater: boolean;
    hasMetrics: boolean;
    hasPhoto: boolean;
  }
) => {
  const next = { ...remainingFlags, [`has${dimension}`]: false } as typeof remainingFlags;
  return {
    hasWorkout: next.hasWorkout,
    hasMeals: next.hasMeals,
    hasWater: next.hasWater,
    hasMetrics: next.hasMetrics,
    hasPhoto: next.hasPhoto,
    hasActivity: next.hasWorkout || next.hasMeals || next.hasWater || next.hasMetrics || next.hasPhoto,
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

/**
 * Reads the current presence flags for a client-day.
 * Returns null when no report exists — nothing to reconcile.
 */
export const readDailyReportFlags = async (
  traineeId: string,
  clientDateKey: string
): Promise<{
  hasWorkout: boolean;
  hasMeals: boolean;
  hasWater: boolean;
  hasMetrics: boolean;
  hasPhoto: boolean;
} | null> => {
  const snapshot = await getDoc(dailyReportRef(traineeId, clientDateKey));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    hasWorkout: data.hasWorkout === true,
    hasMeals: data.hasMeals === true,
    hasWater: data.hasWater === true,
    hasMetrics: data.hasMetrics === true,
    hasPhoto: data.hasPhoto === true,
  };
};



/**
 * Subscribes to one client-day's report.
 *
 * Emits `null` when no report exists — which is a real and meaningful state,
 * not an error: a report is only created once the client logs something, so
 * "no report" means "nothing recorded for this day", never "we failed to look".
 * `onError` is separate for exactly that reason.
 */
export const subscribeToDailyReport = (
  traineeId: string,
  clientDateKey: string,
  callback: (report: DailyReport | null) => void,
  onError?: (error: Error) => void
) => {
  const ref = doc(db, usersCollection, traineeId, "dailyReports", clientDateKey);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data();
      const timezone = typeof data.timezone === "string" ? data.timezone : null;
      const resolvedDateKey = typeof data.clientDateKey === "string" ? data.clientDateKey : clientDateKey;
      callback({
        clientDateKey: resolvedDateKey,
        timezone,
        traineeId,
        coachId: typeof data.coachId === "string" ? data.coachId : null,
        assignmentId: typeof data.assignmentId === "string" ? data.assignmentId : null,
        hasActivity: data.hasActivity === true,
        hasWorkout: data.hasWorkout === true,
        hasMeals: data.hasMeals === true,
        hasWater: data.hasWater === true,
        hasMetrics: data.hasMetrics === true,
        hasPhoto: data.hasPhoto === true,
        firstActivityAt: data.firstActivityAt ?? null,
        lastActivityAt: data.lastActivityAt ?? null,
        reviewStatus: deriveReviewStatus(resolvedDateKey, timezone, data.reviewedAt, data.lastActivityAt),
        reviewAvailableAt: data.reviewAvailableAt ?? null,
        reviewedAt: data.reviewedAt ?? null,
        reviewedByCoachId: typeof data.reviewedByCoachId === "string" ? data.reviewedByCoachId : null,
        reopenedAt: data.reopenedAt ?? null,
        reopenCount: Number(data.reopenCount || 0),
        lastReopenReason: typeof data.lastReopenReason === "string" ? data.lastReopenReason : null,
      });
    },
    (error) => {
      console.error("[DailyReportService] Report subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback(null);
    }
  );
};

/**
 * Which days in a range carry a logged workout.
 *
 * Reads the report documents by id. `clientDateKey` IS the document id and is
 * zero-padded `YYYY-MM-DD`, so lexical order is chronological and a range over
 * `documentId()` needs no composite index and no extra stored field.
 *
 * Bounded by construction: the caller passes a start and end that span at most
 * a fortnight, and the `limit` is a hard ceiling on top of that. This is one
 * bounded read per client-detail open, not a listener per day.
 *
 * Days with no document simply do not appear. The caller treats an absent day
 * as "nothing logged", which is correct — a report is only created once the
 * client logs something.
 */
export const subscribeToDailyReportRange = (
  traineeId: string,
  startDateKey: string,
  endDateKey: string,
  callback: (loggedWorkoutDateKeys: string[]) => void,
  onError?: (error: Error) => void,
  maxDays = 31,
) => {
  if (!traineeId || !startDateKey || !endDateKey) {
    callback([]);
    return () => {};
  }

  const rangeQuery = query(
    collection(db, usersCollection, traineeId, "dailyReports"),
    orderBy(documentId()),
    startAt(startDateKey),
    endAt(endDateKey),
    limit(maxDays),
  );

  return onSnapshot(
    rangeQuery,
    (snapshot) => {
      callback(
        snapshot.docs
          .filter((docSnapshot) => docSnapshot.data()?.hasWorkout === true)
          .map((docSnapshot) => docSnapshot.id),
      );
    },
    (error) => {
      console.error("[DailyReportService] Range subscription failed:", error);
      onError?.(error);
    },
  );
};

/**
 * Marks a client-day reviewed.
 *
 * V0 uses a narrow direct update. Firestore rules allow only the client's
 * currently assigned coach to change the three review fields.
 */
export const markDailyReportReviewed = async (
  traineeId: string,
  clientDateKey: string
): Promise<{ alreadyReviewed: boolean; acknowledgedPain: boolean }> => {
  if (!traineeId) throw new Error("A client id is required.");
  if (!clientDateKey) throw new Error("A date is required.");
  const coachId = auth.currentUser?.uid;
  if (!coachId) throw new Error("You must be signed in.");
  const ref = dailyReportRef(traineeId, clientDateKey);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("There is no activity report for this day.");
  const data = snapshot.data();
  const alreadyReviewed = deriveReviewStatus(
    clientDateKey,
    typeof data.timezone === "string" ? data.timezone : null,
    data.reviewedAt,
    data.lastActivityAt
  ) === "reviewed";
  /*
   * Acknowledging pain is a WRITE the coach makes, not a side effect of having
   * opened a screen. Reading about an injury is not the same as deciding what
   * to do about it, so the queue only clears when the coach closes the day the
   * pain was reported on.
   *
   * The match on `lastPainDateKey` is deliberately narrow: reviewing an
   * unrelated Tuesday must never dismiss a Thursday injury nobody has read.
   */
  const traineeRef = doc(db, usersCollection, traineeId);
  const traineeSnapshot = await getDoc(traineeRef);
  const summary = traineeSnapshot.exists()
    ? (traineeSnapshot.data().clientSummary as Record<string, unknown> | undefined)
    : undefined;
  const acknowledgesPain = shouldAcknowledgePainOnReview(summary, clientDateKey);

  if (!alreadyReviewed || acknowledgesPain) {
    /*
     * One batch, so the review and the acknowledgement cannot diverge. A
     * partial write would either leave a reviewed day with pain still at the
     * top of the queue, or clear a warning for a day the coach never closed.
     */
    const batch = writeBatch(db);

    if (!alreadyReviewed) {
      batch.update(ref, {
        reviewStatus: "reviewed",
        reviewedAt: serverTimestamp(),
        reviewedByCoachId: coachId,
      });
    }

    if (acknowledgesPain) {
      batch.update(traineeRef, {
        "clientSummary.lastPainAcknowledgedAt": serverTimestamp(),
        "clientSummary.lastPainAcknowledgedByCoachId": coachId,
        "clientSummary.lastPainAcknowledgedDateKey": clientDateKey,
      });
    }

    await batch.commit();
  }

  return { alreadyReviewed, acknowledgedPain: acknowledgesPain };
};
