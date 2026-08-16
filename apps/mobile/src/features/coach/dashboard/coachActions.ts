/**
 * Identity and counting for the coach's action queue.
 *
 * Extracted because both were wrong in ways a screen test would not have
 * caught:
 *
 * - Every pain action carried `count: pendingPain.length`, and the priority
 *   card summed `count` across all actions. Three clients in pain therefore
 *   read "9 waiting" — each of the three reports claimed all three.
 * - Every pain action used `id: action.type`, which is the literal string
 *   "pain" for all of them, so React saw duplicate keys in the queue list and
 *   could reuse the wrong row for the wrong client.
 *
 * These are pure so the arithmetic can be tested without a renderer.
 */

/** The shape the queue needs for identity and totals. Nothing else. */
export type CountableAction = {
  id: string;
  count: number;
};

/**
 * A stable, unique id for one client's pain report.
 *
 * Keyed on the report rather than the client so that acknowledging one report
 * and receiving a new one produces a different id — React then remounts the row
 * instead of animating the old one into the new content.
 *
 * `dateKey` is preferred over the timestamp because it is the value the coach
 * and client agree on; the millis fallback covers legacy summaries written
 * before `lastPainDateKey` existed.
 */
export const buildPainActionId = (
  traineeId: string,
  dateKey: string | null | undefined,
  reportedAtMillis: number,
): string => `pain:${traineeId}:${dateKey ?? reportedAtMillis}`;

/**
 * How many things are waiting on the coach, across the whole queue.
 *
 * Individual actions each contribute their own `count`: one per pain report,
 * but the aggregate actions (requests, unread messages) legitimately carry a
 * count above one because they stand for several items behind a single row.
 */
export const totalWaitingCount = (actions: CountableAction[]): number =>
  actions.reduce((sum, action) => sum + action.count, 0);

/**
 * True when every action in the queue has a distinct id.
 *
 * Exported so the invariant can be asserted in tests rather than discovered as
 * a React key warning in a console nobody is reading.
 */
export const hasUniqueActionIds = (actions: CountableAction[]): boolean =>
  new Set(actions.map((action) => action.id)).size === actions.length;
