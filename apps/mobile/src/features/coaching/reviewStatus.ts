import { getForeignClientTodayDateKey } from "../../utils/dateKeys";
import { toMillis } from "./painQueue";

/**
 * Where a client-day sits in the coach's workflow.
 *
 * Extracted from `dailyReportService` so it can be tested without Firebase. The
 * service imports `config/firebase`, which initialises an app on require, so
 * anything living in that file is unreachable from the pure-logic harness — and
 * this rule is precisely the kind that needs testing across timezones.
 */
export type DailyReportReviewStatus =
  | "live"
  | "pending_review"
  | "reviewed"
  | "reopened"
  /**
   * The trainee's own calendar day cannot be resolved, so we cannot say whether
   * their day has closed.
   *
   * This is a fifth state rather than a default because the alternative was
   * worse than useless. The derivation used `getClientTodayDateKey`, which falls
   * back to the DEVICE timezone when the trainee's is missing or invalid — and
   * on this screen that device is the COACH's phone. The failure is silent and
   * runs in both directions: a coach in Sydney reading a client in Los Angeles
   * saw the client's still-running day as `pending_review`, an unfinished day
   * presented as ready to close; a coach west of their client saw a finished day
   * as `live` and was never offered the action at all.
   *
   * "Unknown" is the honest answer. It is not an error, and it is not "nothing
   * logged" — it means the one fact needed to time the review is absent.
   */
  | "unknown";

/**
 * Derives the review state of one client-day.
 *
 * Pure, and takes its clock as an argument, so the timezone behaviour is
 * testable without mocking time.
 *
 * The ORDER matters. `reviewed` and `reopened` are established by TIMESTAMPS
 * alone — two server times compared against each other — so they need no
 * calendar and are decided before any timezone is consulted. A missing trainee
 * timezone must not be able to un-review a day the coach demonstrably reviewed.
 *
 * Only the unreviewed case has to know whether the client's day has closed, and
 * that question is meaningless without the client's own zone.
 */
export const deriveReviewStatus = (
  clientDateKey: string,
  timezone: string | null,
  reviewedAt: unknown,
  lastActivityAt: unknown,
  now: Date = new Date()
): DailyReportReviewStatus => {
  const reviewedMillis = toMillis(reviewedAt);
  const activityMillis = toMillis(lastActivityAt);

  if (reviewedMillis > 0) {
    // Reviewed, and nothing has landed since.
    if (reviewedMillis >= activityMillis) return "reviewed";
    // Reviewed, then the client logged again. The coach's conclusion is stale.
    return "reopened";
  }

  /*
   * `getForeignClientTodayDateKey`, never `getClientTodayDateKey`.
   *
   * The latter falls back to the device zone, which here is the COACH's. That
   * answered "has the client's day ended?" with the wrong person's clock. The
   * foreign variant returns "" rather than guessing, and "" becomes `unknown`.
   */
  const clientTodayDateKey = getForeignClientTodayDateKey(timezone, now);
  if (!clientTodayDateKey) return "unknown";

  // Strictly before the client's today: their day has closed and nobody has
  // read it. The current day, and any future one, is still running.
  return clientDateKey < clientTodayDateKey ? "pending_review" : "live";
};
