/**
 * Dated plan resolution.
 *
 * Answers one question: **what was this client supposed to do on date D?**
 *
 * Pure by construction — no Firestore, no clock, no device timezone. Every
 * input is already-fetched data and a `YYYY-MM-DD` client date key, so the
 * answer is identical whether it is computed on the client's phone in Tunis or
 * the coach's in Paris. That is the whole point: a coach reviewing a day must
 * see the client's day.
 *
 * WHAT THIS IS NOT
 *
 * This is not a trusted snapshot of what the client was shown. V0 has no
 * backend, so Fytrak cannot prove what a client first viewed, cannot lock a
 * past plan against edits, and must not pretend otherwise. Raw prescriptions
 * and programs remain the source of truth and a coach can still edit them
 * after the fact. First-view snapshots and historical locking are deferred to
 * the future custom backend — see V0_RUNTIME_ARCHITECTURE.md.
 */
import { daysBetweenDateKeys, isValidDateKey } from "../../utils/dateKeys";

export type PlanSourceType = "daily" | "program" | "none";

export type ResolvedPlanDimension<T> =
  | { sourceType: "daily"; sourceId: string; dateKey: string; payload: T }
  | { sourceType: "program"; sourceId: string; sessionId?: string; dateKey: string; payload: T }
  | { sourceType: "none"; dateKey: string };

/**
 * A prescription that may or may not be scheduled.
 *
 * `scheduledDateKey` is what makes it dated. Anything without one is legacy or
 * standing content: still usable in its own screen, but never claimed as a
 * specific day's plan — guessing a date for it would fabricate history.
 */
export type DatedCandidate<T> = {
  id: string;
  scheduledDateKey?: string | null;
  /** Absent is treated as published; only an explicit "draft" is withheld. */
  status?: "draft" | "published" | null;
  planVersion?: number | null;
  /** Millisecond timestamp used only to break ties. */
  publishedAtMillis?: number | null;
  payload: T;
};

export type ScheduledProgramSession<S> = {
  id: string;
  /** Whole days from the program's startDateKey. Absent = unscheduled. */
  dayOffset?: number | null;
  payload: S;
};

export type ScheduledProgram<S> = {
  id: string;
  startDateKey?: string | null;
  status?: "draft" | "published" | null;
  planVersion?: number | null;
  publishedAtMillis?: number | null;
  sessions: ScheduledProgramSession<S>[];
};

const isPublished = (status?: string | null): boolean => status !== "draft";

/**
 * Deterministic ordering for duplicate candidates.
 *
 * Legacy data can produce two prescriptions for the same date. Picking the
 * "first" one Firestore happens to return would make the resolved plan depend
 * on query order, cache state and network timing — the same date could resolve
 * differently on two devices.
 *
 * Order, most significant first:
 *   1. higher planVersion
 *   2. later publishedAtMillis
 *   3. lexicographically greater document id
 *
 * Step 3 is arbitrary but total, so there is always exactly one winner.
 */
const preferenceRank = <T>(a: DatedCandidate<T>, b: DatedCandidate<T>): number => {
  const versionDelta = (b.planVersion ?? 0) - (a.planVersion ?? 0);
  if (versionDelta !== 0) return versionDelta;
  const publishedDelta = (b.publishedAtMillis ?? 0) - (a.publishedAtMillis ?? 0);
  if (publishedDelta !== 0) return publishedDelta;
  return b.id.localeCompare(a.id);
};

/** True when this candidate is a real, published plan for `dateKey`. */
export const isDatedCandidateFor = <T>(candidate: DatedCandidate<T>, dateKey: string): boolean => {
  return isValidDateKey(candidate.scheduledDateKey)
    && candidate.scheduledDateKey === dateKey
    && isPublished(candidate.status);
};

/** True when nothing schedules this item — legacy or standing content. */
export const isUnscheduledCandidate = <T>(candidate: DatedCandidate<T>): boolean => {
  return !isValidDateKey(candidate.scheduledDateKey);
};

/** True when a program carries enough information to be placed on a calendar. */
export const isScheduledProgram = <S>(program: ScheduledProgram<S>): boolean => {
  return isValidDateKey(program.startDateKey) && isPublished(program.status);
};

/**
 * The program session falling on `dateKey`, by explicit offset only.
 *
 * Placement comes from `startDateKey + dayOffset` and nothing else. Array
 * position, session number, "first incomplete session" and creation time are
 * all deliberately ignored — every one of them silently drifts as soon as a
 * client misses a day or a coach reorders a week.
 *
 * A date with no matching offset is a rest day, not an error.
 */
export const findProgramSessionForDate = <S>(
  program: ScheduledProgram<S>,
  dateKey: string
): ScheduledProgramSession<S> | null => {
  if (!isScheduledProgram(program) || !isValidDateKey(dateKey)) return null;

  let offset: number;
  try {
    offset = daysBetweenDateKeys(program.startDateKey as string, dateKey);
  } catch {
    return null;
  }
  if (offset < 0) return null;

  const matches = program.sessions.filter(
    (session) => Number.isInteger(session.dayOffset) && session.dayOffset === offset
  );
  if (matches.length === 0) return null;
  // Deterministic even if a program somehow carries two sessions on one offset.
  return [...matches].sort((a, b) => b.id.localeCompare(a.id))[0];
};

/**
 * Resolves one dimension (workout OR nutrition) for one date.
 *
 * Workout and nutrition are resolved by separate calls and never consult each
 * other, so a daily workout override can coexist with program nutrition — and
 * neither dimension can hide or replace the other.
 *
 * Priority: published daily item for the date → explicitly scheduled program
 * session for the date → none.
 */
export const resolvePlanDimension = <T, S = T>(input: {
  dateKey: string;
  dailyCandidates?: DatedCandidate<T>[];
  programs?: ScheduledProgram<S>[];
  /** Maps a program session to this dimension's payload shape. */
  toProgramPayload?: (session: ScheduledProgramSession<S>, program: ScheduledProgram<S>) => T | null;
}): ResolvedPlanDimension<T> => {
  const { dateKey, dailyCandidates = [], programs = [], toProgramPayload } = input;

  if (!isValidDateKey(dateKey)) return { sourceType: "none", dateKey };

  const daily = dailyCandidates
    .filter((candidate) => isDatedCandidateFor(candidate, dateKey))
    .sort(preferenceRank);

  if (daily.length > 0) {
    const winner = daily[0];
    return { sourceType: "daily", sourceId: winner.id, dateKey, payload: winner.payload };
  }

  if (!toProgramPayload) return { sourceType: "none", dateKey };

  const scheduled = programs
    .filter(isScheduledProgram)
    .sort((a, b) => preferenceRank(
      { id: a.id, planVersion: a.planVersion, publishedAtMillis: a.publishedAtMillis, payload: null as unknown as T },
      { id: b.id, planVersion: b.planVersion, publishedAtMillis: b.publishedAtMillis, payload: null as unknown as T }
    ));

  for (const program of scheduled) {
    const session = findProgramSessionForDate(program, dateKey);
    if (!session) continue;
    const payload = toProgramPayload(session, program);
    if (payload == null) continue;
    return {
      sourceType: "program",
      sourceId: program.id,
      sessionId: session.id,
      dateKey,
      payload,
    };
  }

  return { sourceType: "none", dateKey };
};

/** Human-readable provenance for the UI. Factual only — never a judgement. */
export const describePlanSource = (resolved: { sourceType: PlanSourceType }): string => {
  switch (resolved.sourceType) {
    case "daily":
      return "Scheduled for this day";
    case "program":
      return "From the assigned program";
    default:
      return "No plan provided";
  }
};
