import { addDaysToDateKey, getForeignClientTodayDateKey, isValidDateKey } from "../../utils/dateKeys";

/**
 * The rules an adjustment must satisfy, with no Firestore in sight.
 *
 * Extracted from `planRevisionService` for the same reason `reviewStatus.ts`
 * was extracted from `dailyReportService`: that module imports
 * `config/firebase`, which initialises an app on require, so nothing in it can
 * be reached from the pure-logic harness. These are precisely the rules that
 * need testing — they are the only thing standing between a coach and the
 * silent-success flow this phase removed.
 */

/** Read shape. `program` appears only in legacy documents; none are written. */
export type PlanRevisionKind = "workout" | "nutrition" | "program";

/**
 * The kinds an adjustment may create.
 *
 * `program` is absent, and its absence is enforced by the type rather than a
 * runtime check alone. A program is a single document holding a session tree
 * addressed by `dayOffset` from `startDateKey`; changing it from a date would
 * mean moving that start (re-dating every session, including finished ones) or
 * splicing the tree. Both rewrite days the client already trained.
 */
export type AdjustablePlanKind = "workout" | "nutrition";

export type PlanRevision = {
  id: string;
  traineeId: string;
  coachId: string;
  kind: PlanRevisionKind;
  /** The single client-local day this revision's prescription applies to. */
  effectiveFromDateKey: string;
  /** The prescription written in the same batch. Empty on legacy revisions. */
  prescriptionId: string;
  /** Free text, required. Stored with the change, not alongside it. */
  reason: string;
  /** Optional human-readable summary of what changed. */
  summary: string;
  createdAt: unknown;
};

export const MAX_REASON_LENGTH = 500;
export const MAX_SUMMARY_LENGTH = 500;

/**
 * Rejects any revision date that is not strictly in the client's future.
 *
 * TODAY IS REJECTED, and that is the substantive change. A coach must not
 * replace the plan for a day the client may already have opened, read, or
 * started training. By the time it is the client's today, the plan for it is
 * theirs. The earliest a change may land is tomorrow, in their calendar.
 *
 * Pure and exported so the screen disables the control for exactly the reason
 * the service would refuse the write, rather than letting a coach fill in a
 * form and only then be told no.
 */
export const validateEffectiveDate = (
  effectiveFromDateKey: string,
  traineeTimezone: string | null,
): { ok: true } | { ok: false; message: string } => {
  if (!isValidDateKey(effectiveFromDateKey)) {
    return { ok: false, message: "Choose a real date for this replacement." };
  }

  /*
   * Runs on the COACH's device, so the strict variant: an unknown client zone
   * must block the write rather than silently borrow the coach's calendar. A
   * coach in Auckland would otherwise be a day ahead of a client in Tunis and
   * could schedule onto a day that has not started for either of them.
   */
  const clientToday = getForeignClientTodayDateKey(traineeTimezone);
  if (!clientToday) {
    return {
      ok: false,
      message: "This client's timezone is unknown, so we cannot tell which day is theirs.",
    };
  }

  const earliest = addDaysToDateKey(clientToday, 1);
  if (effectiveFromDateKey < earliest) {
    return {
      ok: false,
      message: effectiveFromDateKey === clientToday
        ? "Today is already your client's day. The earliest replacement is tomorrow."
        : "That day has finished. A replacement can only be scheduled for a future day.",
    };
  }

  return { ok: true };
};
export type AdjustmentContext = {
  traineeId: string;
  kind: AdjustablePlanKind;
  /** The one client-local day being replaced. */
  effectiveFromDateKey: string;
  reason: string;
  summary: string;
  traineeTimezone: string | null;
};

/**
 * Everything that must hold before either document is written.
 *
 * Pure, so the exact conditions the batch enforces can be asserted without
 * Firestore — including the one that only becomes obvious when the two writes
 * are considered together: the revision's date and the prescription's
 * `scheduledDateKey` must be the same day. They are written from the same
 * value here, and this is the assertion that keeps them that way.
 */
export const validateAdjustment = (
  context: AdjustmentContext,
  prescriptionScheduledDateKey: string | null,
): { ok: true } | { ok: false; message: string } => {
  if (!context.traineeId) return { ok: false, message: "A client is required." };

  // `program` cannot reach here through the types, but a route parameter is
  // untyped at runtime and this is the last gate before a write.
  if (context.kind !== "workout" && context.kind !== "nutrition") {
    return {
      ok: false,
      message: "Program changes require assigning a new program. Existing program days are not rewritten.",
    };
  }

  if (!context.reason.trim()) {
    return { ok: false, message: "Say why this is changing — it is stored with the change." };
  }
  if (context.reason.trim().length > MAX_REASON_LENGTH) {
    return { ok: false, message: "That reason is too long." };
  }
  if (context.summary.trim().length > MAX_SUMMARY_LENGTH) {
    return { ok: false, message: "That summary is too long." };
  }

  const dateCheck = validateEffectiveDate(context.effectiveFromDateKey, context.traineeTimezone);
  if (!dateCheck.ok) return dateCheck;

  /*
   * The two documents must describe the same day. A revision claiming to
   * replace Tuesday while its prescription is scheduled for Wednesday is a
   * record that lies about itself, and nothing downstream could detect it.
   */
  if (prescriptionScheduledDateKey !== context.effectiveFromDateKey) {
    return {
      ok: false,
      message: "The replacement's date must match the day being adjusted.",
    };
  }

  return { ok: true };
};
