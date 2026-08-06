/**
 * Validation for the schedule fields a coach types into the existing
 * prescription and program forms.
 *
 * A blank field is VALID and means "unscheduled" — coaches must keep being able
 * to hand out a standing plan with no date, exactly as they could before, and
 * every prescription written before Phase D is in that state. Only a non-blank
 * value that is not a real calendar date is an error.
 */
import { isValidDateKey } from "../../utils/dateKeys";

export type ScheduleInputResult =
  | { ok: true; scheduledDateKey: string | null }
  | { ok: false; message: string };

/**
 * Normalises a coach-entered date.
 *
 * The value is treated as a literal client-local date key and is never parsed
 * through the device clock — typing 2026-08-05 must mean the client's
 * 5 August wherever the coach happens to be.
 */
export const parseScheduleDateInput = (raw: string | null | undefined): ScheduleInputResult => {
  const value = (raw ?? "").trim();
  if (value.length === 0) return { ok: true, scheduledDateKey: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, message: "Use the format YYYY-MM-DD, or leave it blank for an unscheduled plan." };
  }
  if (!isValidDateKey(value)) {
    return { ok: false, message: `${value} is not a real date.` };
  }
  return { ok: true, scheduledDateKey: value };
};

/**
 * The additive fields written alongside a dated plan.
 *
 * Returns an empty object when unscheduled, so an undated save produces exactly
 * the document it produced before Phase D — no empty strings, no nulls that
 * would make a document look scheduled-but-blank.
 */
export const scheduleFieldsFor = (
  scheduledDateKey: string | null,
  scheduleTimezone?: string | null
): Record<string, unknown> => {
  if (!scheduledDateKey) return {};
  return {
    scheduledDateKey,
    status: "published",
    publishedAt: null, // replaced with serverTimestamp() by the caller
    ...(scheduleTimezone ? { scheduleTimezone } : {}),
  };
};

/** Parses an explicit per-session day offset. Blank means unscheduled. */
export const parseDayOffsetInput = (
  raw: string | null | undefined
): { ok: true; dayOffset: number | null } | { ok: false; message: string } => {
  const value = (raw ?? "").trim();
  if (value.length === 0) return { ok: true, dayOffset: null };

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, message: "Day must be a whole number of days from the start date (0 = start day)." };
  }
  return { ok: true, dayOffset: parsed };
};
