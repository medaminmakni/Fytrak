import { addDaysToDateKey, isValidDateKey } from "../../utils/dateKeys";

/**
 * Stepping through a client's days, in the CLIENT's calendar.
 *
 * The screen previously did this:
 *
 *   const parsed = new Date(`${selectedDate}T12:00:00`);
 *   parsed.setDate(parsed.getDate() + deltaDays);
 *   const next = toLocalDateKey(parsed);
 *
 * Three separate device-timezone dependencies in four lines. `new Date(...)`
 * with no zone suffix parses in the DEVICE zone, `setDate` rolls over according
 * to the device calendar, and `toLocalDateKey` formats back in the device zone.
 * The noon anchor hid the damage for most coaches, which is worse than an
 * obvious bug: it worked until it did not.
 *
 * `addDaysToDateKey` is string arithmetic in UTC with no local calendar
 * involved, so a coach in Auckland and a coach in Los Angeles step the same
 * client through the same days.
 */

/*
 * `isValidDateKey` is imported rather than redefined. An identical local copy
 * was the first thing written here, which is how two validators drift.
 */

/**
 * The day `deltaDays` from `selectedDateKey`, or `null` when the step is not
 * allowed.
 *
 * Returns `null` — rather than clamping — in three cases, because each means
 * "there is nothing to navigate to" and the caller should leave the day where
 * it is:
 *
 * - `clientTodayDateKey` is empty. The trainee has no captured timezone, so we
 *   do not know which day is theirs. Bounding the step against the COACH's
 *   today would be the exact device-zone fallback this phase removes.
 * - the result would be after the client's today. A future day has no report.
 * - either key is malformed.
 */
export const stepClientDay = (
  selectedDateKey: string,
  deltaDays: number,
  clientTodayDateKey: string
): string | null => {
  if (!isValidDateKey(selectedDateKey)) return null;
  // No client calendar means no bound to step against.
  if (!isValidDateKey(clientTodayDateKey)) return null;
  if (!Number.isInteger(deltaDays) || deltaDays === 0) return null;

  const next = addDaysToDateKey(selectedDateKey, deltaDays);

  // String comparison is correct for zero-padded ISO keys and involves no
  // clock, which is the whole point.
  if (next > clientTodayDateKey) return null;

  return next;
};

/**
 * Whether the forward control should be enabled.
 *
 * Kept separate from `stepClientDay` so the button's disabled state and the
 * step itself cannot disagree — they were two independent conditions before,
 * and the button stayed enabled on a day it refused to leave.
 */
export const canStepForward = (selectedDateKey: string, clientTodayDateKey: string): boolean =>
  stepClientDay(selectedDateKey, 1, clientTodayDateKey) !== null;

/** Whether the back control should be enabled. Only invalid input blocks it. */
export const canStepBack = (selectedDateKey: string, clientTodayDateKey: string): boolean =>
  stepClientDay(selectedDateKey, -1, clientTodayDateKey) !== null;
