import type { DataStatus } from "../../hooks/useTraineeDetailData";

/**
 * One retry lifecycle across every source on the client-day report.
 *
 * The report is loaded by two independent mechanisms: `useTraineeDetailData`
 * owns six listeners, and the daily-report/review listener lives on the screen.
 * Retry state was owned entirely by the hook, which produced two failures:
 *
 * - For a REPORT-ONLY failure, `retry()` set `isRetrying = true` while all six
 *   hook dimensions were already `loaded`, so the hook's settling effect saw
 *   nothing in flight and immediately set it back to false. The button stopped
 *   showing progress and re-enabled itself while the report was still fetching.
 * - Retrying an unrelated failed dimension re-subscribed the report listener,
 *   which reset a perfectly good `loaded` report to `loading` and blanked the
 *   review bar and the photo card — the opposite of preserving loaded content.
 *
 * The fix is to decide, at the moment of the tap, exactly which sources are
 * being retried, and then track only those. A source that is already `loaded`
 * is not a target: it is not re-fetched, it is not reset, and it cannot keep
 * the button spinning.
 */

/** Every source that can load independently, keyed by id. */
export type RetryStatusMap = Record<string, DataStatus>;

/**
 * The sources a retry should actually re-run: everything not `loaded`.
 *
 * `error` is the obvious case. `loading` is included because a source stuck
 * mid-flight is exactly what the coach is trying to unstick — the 12s timeout
 * turns a stall into an error, but a coach who taps Retry at ten seconds should
 * not have that listener excluded for still technically being in progress.
 *
 * Sorted so the returned list is stable, which keeps it usable as a React
 * dependency and makes the tests order-independent.
 */
export const selectRetryTargets = (statuses: RetryStatusMap): string[] =>
  Object.keys(statuses)
    .filter((id) => statuses[id] !== "loaded")
    .sort();

/**
 * True once every source that was actually retried has reached a terminal
 * state.
 *
 * `error` counts as settled: a retry that failed again is finished, and the
 * coach must be able to tap once more. Only `loading` is unsettled.
 *
 * Sources absent from `statuses` are treated as settled rather than pending, so
 * a source that disappears mid-retry cannot strand the button forever.
 */
export const isRetrySettled = (targets: string[], statuses: RetryStatusMap): boolean =>
  targets.every((id) => statuses[id] !== "loading");

/**
 * Whether the Retry control should show progress and stay disabled.
 *
 * Depends only on the recorded TARGETS, never on the full status map. That is
 * what stops an unrelated dimension — one the coach did not retry, or one that
 * started loading for its own reasons — from holding the button busy, and what
 * stops a fully-loaded set of hook dimensions from ending a report-only retry
 * before the report has answered.
 */
export const isRetryBusy = (targets: string[], statuses: RetryStatusMap): boolean =>
  targets.length > 0 && !isRetrySettled(targets, statuses);
