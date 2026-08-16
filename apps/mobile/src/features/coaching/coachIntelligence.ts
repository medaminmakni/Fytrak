import { daysBetweenDateKeys, getForeignClientTodayDateKey } from "../../utils/dateKeys";

export type CoachClientSignal = {
  traineeId: string;
  lastWorkoutAt: Date | null;
  /** The client's IANA zone. Null when never captured. */
  timezone?: string | null;
  /** Stored at write time. Preferred over deriving from `lastWorkoutAt`. */
  lastWorkoutDateKey?: string | null;
  workoutsLast7Days: number;
  mealsLast7Days: number;
  avgDailyProtein: number;
  proteinTarget: number | null;
};

/**
 * What a coach can actually be told about a client's activity.
 *
 * This replaces two things that were being drawn and should not have been:
 *
 * - `complianceScore` as a percentage. It is 55 points for workouts logged, 25
 *   for meals *logged* (a count, never compared against targets) and 20 for
 *   protein — which pays out 12 points for free when the client has no protein
 *   target at all. A client eating 4,000 kcal against a 2,100 target scores
 *   highly. Rendering it gave a wrong number the authority of a headline.
 * - A HIGH / MEDIUM / LOW badge. A coach cannot act on a word. They can act on
 *   "silent 9 days", which is the raw fact the roster snapshot already carries.
 *
 * Every branch here is a statement of record, not a judgement.
 */
export type ClientActivityState =
  | { kind: "logged_today" }
  | { kind: "logged_recently"; daysAgo: number }
  | { kind: "silent"; daysAgo: number }
  | { kind: "never_logged" }
  /** The client has logged, but we cannot say which of their days it was. */
  | { kind: "unknown" };

/**
 * How long a client has been quiet, in CALENDAR days of their own timezone.
 *
 * This used to subtract timestamps: `Math.floor(elapsedMillis / 86400000)`.
 * That answers "was it within the last 24 hours", which is a different
 * question. A client who trained at 23:00 and a coach who looked at 01:00 saw
 * "logged today" for a session that happened yesterday — and at 7 days the
 * error compounds into the silence count that drives the roster.
 *
 * Both arguments are `YYYY-MM-DD` keys resolved in the CLIENT's zone. The
 * comparison is therefore string-to-string with no clock in it at all, which is
 * also why it is testable across timezones and DST without mocking time.
 *
 * A coach's device timezone must never reach this function.
 */
export function describeClientActivity(
  lastWorkoutDateKey: string | null | undefined,
  clientTodayDateKey: string | null | undefined,
): ClientActivityState {
  if (!lastWorkoutDateKey) return { kind: "never_logged" };

  /*
   * No client timezone means no client calendar. Saying "silent 9 days" from a
   * coach's own clock would be inventing a number about someone else's week.
   */
  if (!clientTodayDateKey) return { kind: "unknown" };

  const days = daysBetweenDateKeys(lastWorkoutDateKey, clientTodayDateKey);

  // A key in the future (clock skew, or a client who travelled east) is not a
  // reason to report silence.
  if (days <= 0) return { kind: "logged_today" };
  // Three days is where a coach starts asking rather than waiting. Below it the
  // gap is stated without colour; at or above it, it is stated with colour.
  if (days < 3) return { kind: "logged_recently", daysAgo: days };
  return { kind: "silent", daysAgo: days };
}

/**
 * `describeClientActivity` for a roster signal, resolving both date keys in the
 * CLIENT's timezone.
 *
 * Callers used to pass `signal.lastWorkoutAt` straight in, which made the
 * answer depend on the coach's device clock. This is the only shape the coach
 * screens should use.
 */
export function describeSignalActivity(
  signal: Pick<CoachClientSignal, "lastWorkoutAt" | "timezone" | "lastWorkoutDateKey">,
  now: Date = new Date(),
): ClientActivityState {
  /*
   * Prefer the STORED key. It was written in the client's zone at the moment
   * they trained, so it survives them moving timezone — a derived key would
   * silently re-date every historical session when their profile changes.
   *
   * Falling back to the timestamp keeps summaries written before this field
   * existed working, at the cost of that re-dating risk for legacy rows only.
   */
  const storedKey = signal.lastWorkoutDateKey;
  const hasStoredKey = typeof storedKey === "string" && storedKey.length > 0;

  if (!hasStoredKey && !signal.lastWorkoutAt) return { kind: "never_logged" };

  const todayKey = getForeignClientTodayDateKey(signal.timezone, now);
  if (!todayKey) return { kind: "unknown" };

  const lastKey = hasStoredKey
    ? storedKey
    : getForeignClientTodayDateKey(signal.timezone, signal.lastWorkoutAt as Date);

  // Neither a stored key nor an interpretable timestamp.
  if (!lastKey) return { kind: "unknown" };

  return describeClientActivity(lastKey, todayKey);
}

/**
 * Rank for "who has been quiet longest".
 *
 * Lower sorts first. This is the ONLY thing the roster orders by now: it used
 * to sort on `complianceScore`, a composite of workouts, meals-logged and a
 * protein guess — so a roster labelled "sorted by who has been quiet longest"
 * was in fact sorted by a number that included how often someone photographed
 * their lunch. The label and the algorithm now say the same thing.
 *
 * `never_logged` sits between "recently" and "silent": a new client needs a
 * plan, not chasing, but should not be buried under the whole roster either.
 */
export function activitySortRank(state: ClientActivityState): number {
  switch (state.kind) {
    case "silent":
      // Longest silence first, so 9 days outranks 3.
      return 0 - state.daysAgo;
    case "never_logged":
      return 1000;
    case "unknown":
      return 2000;
    case "logged_recently":
      return 3000 + state.daysAgo;
    case "logged_today":
      return 4000;
  }
}

/*
 * `scoreCoachClient` and `buildCoachDashboardIntelligence` were removed here.
 *
 * They produced `complianceScore` (55 points for workouts logged, 25 for meals
 * *logged* — a count, never compared against a target — and 20 for protein, of
 * which 12 were paid out free to anyone with no protein target), a
 * HIGH/MEDIUM/LOW `risk` band, a `riskReason` sentence and `avgCompliance`.
 *
 * Phase 2 cut them off from the coach dashboard and roster. This deletes them:
 * a grep after that phase found no remaining caller anywhere in the app, only
 * the test file that covered them. Dead code with passing tests is still dead
 * code, and leaving a scoring engine in the tree invites it back.
 *
 * The comment in `useCoachDashboard` that claimed "the trainee side has its own
 * uses for them" was simply wrong — nothing trainee-side ever called either.
 *
 * What replaced them: `describeClientActivity` / `describeSignalActivity`,
 * which state a date rather than grade a client.
 */
