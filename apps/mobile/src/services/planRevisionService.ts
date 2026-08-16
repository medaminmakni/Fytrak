import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type {
  AdjustablePlanKind,
  AdjustmentContext,
  PlanRevision,
  PlanRevisionKind,
} from "../features/plans/adjustmentRules";
import { validateAdjustment } from "../features/plans/adjustmentRules";
import type { PrescribedMeal, PrescribedWorkout } from "../types/domain";

const usersCollection = "users";

/**
 * A dated, reasoned change to a client's plan — and the prescription it wrote.
 *
 * WHAT WAS WRONG
 *
 * This module used to expose `createPlanRevision`, which wrote a single
 * `planRevisions` document and nothing else. AdjustPlanScreen called it and
 * then showed "Change recorded". No workout, meal plan or program was altered
 * anywhere. The coach believed they had changed the client's plan; the client
 * saw exactly what they saw before. A button that reports success without
 * doing anything is worse than a missing feature, because nobody goes looking
 * for the bug.
 *
 * WHAT IT DOES NOW
 *
 * A revision cannot exist without the prescription it describes. `saveAdjustment`
 * writes both in ONE `writeBatch`: the dated prescription, and the append-only
 * revision that points at it by id. If either is rejected, neither exists.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM
 *
 * `scheduledDateKey` addresses exactly ONE client-local day. An adjustment
 * replaces the plan for that day and no other. It is not "from this date
 * onward", it does not recur, and it does not touch any later day the coach has
 * already scheduled. The copy throughout says "for this day" for that reason.
 */

/*
 * The pure rules live in `features/plans/adjustmentRules.ts` so they can be
 * tested without Firebase. Re-exported here so callers keep one import.
 */
export type {
  PlanRevisionKind,
  AdjustablePlanKind,
  PlanRevision,
  AdjustmentContext,
} from "../features/plans/adjustmentRules";
export {
  MAX_REASON_LENGTH,
  MAX_SUMMARY_LENGTH,
  validateEffectiveDate,
  validateAdjustment,
} from "../features/plans/adjustmentRules";

export type AdjustmentPayload =
  | { kind: "workout"; workout: Omit<PrescribedWorkout, "id" | "assignedAt"> }
  | { kind: "nutrition"; meal: Omit<PrescribedMeal, "id" | "assignedAt"> };

const COLLECTION_FOR: Record<AdjustablePlanKind, string> = {
  workout: "prescribedWorkouts",
  nutrition: "prescribed_meals",
};

/**
 * Writes the replacement prescription and its revision record atomically.
 *
 * ORDER MATTERS AND IS ENFORCED BY THE BATCH. The revision carries
 * `prescriptionId`, so it cannot be written first — there would be no id to
 * point at, and a revision pointing at nothing is precisely the state this
 * whole phase exists to remove. Both `set` calls join one batch and commit
 * together or not at all.
 *
 * No `planVersion` is written. The field is optional, is not consistently
 * present on existing documents, and computing "current max + 1" from the
 * client would require a read that two coaches could interleave. The resolver
 * already breaks ties deterministically on `publishedAt` then document id, and
 * a fabricated version number would be worse than none.
 */
export const saveAdjustment = async (
  context: AdjustmentContext,
  payload: AdjustmentPayload,
): Promise<{ prescriptionId: string; revisionId: string; effectiveFromDateKey: string }> => {
  const coachId = auth.currentUser?.uid;
  if (!coachId) throw new Error("You must be signed in.");

  if (payload.kind !== context.kind) {
    throw new Error("The replacement does not match the kind of plan being adjusted.");
  }

  // Re-checked here rather than trusting the screen: a form left open across
  // the client's midnight has a stale idea of which days are still future.
  const check = validateAdjustment(context, context.effectiveFromDateKey);
  if (!check.ok) throw new Error(check.message);

  const batch = writeBatch(db);

  const prescriptionRef = doc(
    collection(db, usersCollection, context.traineeId, COLLECTION_FOR[context.kind]),
  );

  const scheduleFields = {
    scheduledDateKey: context.effectiveFromDateKey,
    status: "published",
    publishedAt: serverTimestamp(),
    ...(context.traineeTimezone ? { scheduleTimezone: context.traineeTimezone } : {}),
    assignedAt: serverTimestamp(),
  };

  if (payload.kind === "workout") {
    batch.set(prescriptionRef, {
      ...payload.workout,
      isCompleted: false,
      ...scheduleFields,
    });
  } else {
    batch.set(prescriptionRef, {
      ...payload.meal,
      isApplied: false,
      ...scheduleFields,
    });
  }

  const revisionRef = doc(collection(db, usersCollection, context.traineeId, "planRevisions"));
  batch.set(revisionRef, {
    traineeId: context.traineeId,
    coachId,
    kind: context.kind,
    effectiveFromDateKey: context.effectiveFromDateKey,
    prescriptionId: prescriptionRef.id,
    reason: context.reason.trim(),
    summary: context.summary.trim(),
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    prescriptionId: prescriptionRef.id,
    revisionId: revisionRef.id,
    effectiveFromDateKey: context.effectiveFromDateKey,
  };
};

export const subscribeToPlanRevisions = (
  traineeId: string,
  onData: (revisions: PlanRevision[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  if (!traineeId) {
    onData([]);
    return () => {};
  }

  /*
   * Bounded. Revision history grows for the life of the coaching
   * relationship and every screen reading it only ever shows the recent end,
   * so an unbounded listener would quietly grow the read cost of opening a
   * long-standing client for no visible benefit.
   */
  const revisionsQuery = query(
    collection(db, usersCollection, traineeId, "planRevisions"),
    orderBy("effectiveFromDateKey", "desc"),
    limit(50),
  );

  return onSnapshot(
    revisionsQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            traineeId,
            coachId: typeof data.coachId === "string" ? data.coachId : "",
            kind: (data.kind as PlanRevisionKind) || "workout",
            effectiveFromDateKey:
              typeof data.effectiveFromDateKey === "string" ? data.effectiveFromDateKey : "",
            // Absent on revisions written before this phase — those genuinely
            // changed nothing, and the UI says so rather than implying a link.
            prescriptionId: typeof data.prescriptionId === "string" ? data.prescriptionId : "",
            reason: typeof data.reason === "string" ? data.reason : "",
            summary: typeof data.summary === "string" ? data.summary : "",
            createdAt: data.createdAt ?? null,
          };
        }),
      );
    },
    (error) => {
      console.error("[PlanRevisions] Subscription failed:", error);
      onError?.(error);
    },
  );
};
