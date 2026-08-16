/**
 * Which clients have an unacknowledged pain report, newest first.
 *
 * The first version of this was `assigned.find(c => c.clientSummary?.lastPainAt)`
 * on the dashboard, which was wrong in five ways at once: it took an arbitrary
 * client rather than the most recent, always counted 1, hid every other pain
 * report, never sorted, and — worst — never cleared, so one old report could
 * occupy the top action forever.
 *
 * The rule here is that pain is PENDING until a coach explicitly acknowledges
 * it, and acknowledgement is a write, not a side effect of opening a screen.
 * Reading about an injury is not the same as deciding what to do about it.
 */

export type PainSummaryFields = {
  lastPainAt?: unknown;
  lastPainNote?: string;
  lastPainDateKey?: string;
  lastPainAcknowledgedAt?: unknown;
  lastPainAcknowledgedByCoachId?: string;
  lastPainAcknowledgedDateKey?: string;
};

export type PainQueueClient = {
  id: string;
  name?: string;
  clientSummary?: PainSummaryFields | null;
};

export type PendingPainReport = {
  traineeId: string;
  traineeName: string;
  /** Epoch millis of the report. Used only for ordering. */
  reportedAtMillis: number;
  /** The client-local day the pain was reported on. */
  dateKey: string | null;
  note: string | null;
};

/**
 * Firestore timestamps arrive as `Timestamp`, as `{seconds}` from the cache, or
 * as `null` while a serverTimestamp is pending. Anything unreadable is 0, which
 * makes it sort last and — for an acknowledgement — count as "not acknowledged"
 * rather than silently clearing a report.
 */
export const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const candidate = value as { toMillis?: () => number; seconds?: number };
  if (typeof candidate.toMillis === "function") {
    try {
      return candidate.toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof candidate.seconds === "number") return candidate.seconds * 1000;
  return 0;
};

/**
 * A pain report is pending until an acknowledgement STRICTLY newer than it.
 *
 * Comparing timestamps rather than storing a boolean is what makes a later
 * report re-open by itself: a client who reports pain again after the coach
 * acknowledged the last one produces `lastPainAt > lastPainAcknowledgedAt`,
 * and the item returns to the queue with no extra bookkeeping.
 */
export const isPainPending = (summary: PainSummaryFields | null | undefined): boolean => {
  const reportedAt = toMillis(summary?.lastPainAt);
  if (reportedAt === 0) return false;
  return reportedAt > toMillis(summary?.lastPainAcknowledgedAt);
};

/**
 * Every assigned client with pending pain, newest report first.
 *
 * Pure and total: no clock, no Firestore, no device timezone. The dashboard
 * uses `[0]` for the raised card and the remainder for the queue, so both come
 * from one ordering and cannot disagree.
 */
export const selectPendingPainReports = (
  clients: PainQueueClient[],
): PendingPainReport[] =>
  clients
    .filter((client) => isPainPending(client.clientSummary))
    .map((client) => ({
      traineeId: client.id,
      traineeName: client.name || "A client",
      reportedAtMillis: toMillis(client.clientSummary?.lastPainAt),
      dateKey: client.clientSummary?.lastPainDateKey ?? null,
      note: client.clientSummary?.lastPainNote || null,
    }))
    .sort(
      (a, b) =>
        b.reportedAtMillis - a.reportedAtMillis ||
        // Stable across snapshots when two reports share a millisecond.
        a.traineeId.localeCompare(b.traineeId),
    );

/**
 * Whether marking `reviewedDateKey` reviewed should also acknowledge pain.
 *
 * Deliberately narrow: only the day the pain was actually reported on clears
 * it. Reviewing an unrelated Tuesday must not silently dismiss a Thursday
 * injury the coach has not read.
 */
export const shouldAcknowledgePainOnReview = (
  summary: PainSummaryFields | null | undefined,
  reviewedDateKey: string,
): boolean => {
  if (!isPainPending(summary)) return false;
  const painDateKey = summary?.lastPainDateKey;
  return typeof painDateKey === "string" && painDateKey === reviewedDateKey;
};
