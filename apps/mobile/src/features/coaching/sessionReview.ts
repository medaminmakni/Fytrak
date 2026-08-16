import type { WorkoutSet } from "../../types/domain";

/**
 * One logged session, read against what was asked.
 *
 * The coach's question is not "what did they lift" — the log already shows
 * that. It is *did this go the way I planned, and if not, where*. That is a
 * comparison, and it only means anything when both halves are stated with
 * their gaps intact.
 *
 * WHAT THIS DELIBERATELY CANNOT DO
 *
 * The design's session detail is built on "RPE AGAINST WHAT YOU ASKED — 10 / 8"
 * and asserts the logger already records RPE. Half of that is now true: the set
 * row captures RPE. The other half is not — prescriptions carry `targetSets`,
 * `targetReps` and `restTime` and **no target RPE**, so there is nothing to
 * compare against. `averageRpe` is therefore reported alone, as a fact about
 * the session, and no delta is invented. When `targetRpe` exists on
 * prescriptions this module gains the second column and nothing else changes.
 */

export type PlannedExercise = {
  name: string;
  targetSets?: number | null;
  targetReps?: string | null;
  restTime?: string | null;
};

export type LoggedExercise = {
  name: string;
  sets: WorkoutSet[];
};

export type ExerciseReviewRow = {
  name: string;
  /** Null when nothing planned this exercise — the trainee added it. */
  plannedSets: number | null;
  plannedReps: string | null;
  completedSets: number;
  /**
   * Mean RPE across the sets that were RATED, or null when none were.
   *
   * Never 0. An unrated session and a session rated 0 are different facts, and
   * 0 is not on the scale anyway.
   */
  averageRpe: number | null;
  /** How many sets carried a rating, so the average can be read in context. */
  ratedSets: number;
  /** Heaviest completed set, or null for bodyweight and timed work. */
  topWeight: number | null;
};

export type SessionReview = {
  rows: ExerciseReviewRow[];
  /** Planned exercises with no matching log. Named, not counted. */
  notDone: string[];
  /** Logged exercises nobody planned. Not a fault — often a good sign. */
  unplanned: string[];
  totalCompletedSets: number;
  totalPlannedSets: number | null;
  /** Session-wide mean RPE across rated sets, or null. */
  averageRpe: number | null;
  ratedSets: number;
};

type ProgramReviewSet = {
  targetReps?: number | null;
};

type ProgramReviewExercise = {
  name: string;
  restTimeSec?: number | null;
  suggestedSets?: ProgramReviewSet[];
};

type ProgramReviewSession = {
  id: string;
  title: string;
  exercises?: ProgramReviewExercise[];
};

export type ProgramReviewCatalogItem = {
  id: string;
  weeks?: Array<{ sessions?: ProgramReviewSession[] }>;
};

export type SourceLinkedWorkout = {
  sourceType?: string | null;
  sourceProgramId?: string | null;
  sourceProgramSessionId?: string | null;
  sourceScheduledDateKey?: string | null;
};

export type WorkoutReviewPlan = {
  sourceLabel: string;
  plannedExercises: PlannedExercise[];
  sourceStatus: "unlinked" | "exact" | "unavailable";
};

const plannedRepsLabel = (sets: ProgramReviewSet[]): string | null => {
  const reps = sets
    .map((set) => set.targetReps)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (reps.length === 0) return null;
  return reps.every((value) => value === reps[0])
    ? String(reps[0])
    : reps.join(" / ");
};

const toReviewExercises = (exercises: ProgramReviewExercise[]): PlannedExercise[] =>
  (exercises ?? []).map((exercise) => {
    const sets = Array.isArray(exercise.suggestedSets) ? exercise.suggestedSets : [];
    return {
      name: exercise.name,
      targetSets: sets.length > 0 ? sets.length : null,
      targetReps: plannedRepsLabel(sets),
      restTime: typeof exercise.restTimeSec === "number" && exercise.restTimeSec > 0
        ? `${exercise.restTimeSec}s`
        : null,
    };
  });

/**
 * Resolves the prescription a logged workout actually answered.
 *
 * Date alone is never enough: a client can log a manual session, or complete a
 * session from another program on the same day. If all source fields do not
 * resolve to one exact session, the coach sees actual performance only rather
 * than a misleading list of exercises from a different plan.
 */
export const resolveWorkoutReviewPlan = (
  workout: SourceLinkedWorkout,
  programs: ProgramReviewCatalogItem[],
  selectedDateKey: string,
  currentProgramSession?: { programId?: string | null; sessionId?: string | null } | null,
): WorkoutReviewPlan => {
  if (workout?.sourceType !== "program") {
    // Legacy and daily-prescription logs do not persist a prescription source
    // id, so calling every unlinked log "manual" would invent provenance.
    return { sourceLabel: "Logged session", plannedExercises: [], sourceStatus: "unlinked" };
  }

  const programId = workout.sourceProgramId;
  const sessionId = workout.sourceProgramSessionId;
  const sourceDateKey = workout.sourceScheduledDateKey;
  if (!programId || !sessionId || !sourceDateKey || sourceDateKey !== selectedDateKey) {
    return { sourceLabel: "Program source unavailable", plannedExercises: [], sourceStatus: "unavailable" };
  }

  const program = (programs ?? []).find((candidate) => candidate.id === programId);
  const session = program?.weeks
    ?.flatMap((week) => week.sessions ?? [])
    .find((candidate) => candidate.id === sessionId);
  if (!session) {
    return { sourceLabel: "Program source unavailable", plannedExercises: [], sourceStatus: "unavailable" };
  }

  const isCurrentPrescription = currentProgramSession?.programId === programId
    && currentProgramSession?.sessionId === sessionId;
  return {
    sourceLabel: isCurrentPrescription
      ? `${session.title} - Prescribed session`
      : `${session.title} - Program session`,
    plannedExercises: toReviewExercises(session.exercises ?? []),
    sourceStatus: "exact",
  };
};

/** Case- and space-insensitive, so "Incline DB Press" matches "incline db press". */
const normalise = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");

const meanRpe = (sets: WorkoutSet[]): { average: number | null; rated: number } => {
  const values = sets
    .map((set) => (typeof set.rpe === "string" ? Number(set.rpe) : Number.NaN))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 10);
  if (values.length === 0) return { average: null, rated: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  // One decimal. "7.8 vs 8 asked" is the design's own phrasing.
  return { average: Math.round((total / values.length) * 10) / 10, rated: values.length };
};

const topWeightOf = (sets: WorkoutSet[]): number | null => {
  const weights = sets
    .map((set) => (typeof set.weight === "number" ? set.weight : Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  return weights.length > 0 ? Math.max(...weights) : null;
};

export const buildSessionReview = (
  logged: LoggedExercise[],
  planned: PlannedExercise[] = [],
): SessionReview => {
  const plannedByName = new Map<string, PlannedExercise>();
  planned.forEach((exercise) => {
    if (exercise?.name) plannedByName.set(normalise(exercise.name), exercise);
  });

  const seen = new Set<string>();
  const rows: ExerciseReviewRow[] = [];
  const unplanned: string[] = [];
  const allSets: WorkoutSet[] = [];

  (logged ?? []).forEach((exercise) => {
    if (!exercise?.name) return;
    const key = normalise(exercise.name);
    seen.add(key);

    /*
     * Only COMPLETED sets count as done. A row the trainee typed into and never
     * ticked is not work performed, and counting it would overstate the session
     * to the one person relying on this to decide the next one.
     */
    const done = (exercise.sets ?? []).filter((set) => set.isCompleted);
    allSets.push(...done);

    const match = plannedByName.get(key);
    if (!match) unplanned.push(exercise.name);

    const { average, rated } = meanRpe(done);
    rows.push({
      name: exercise.name,
      plannedSets: typeof match?.targetSets === "number" ? match.targetSets : null,
      plannedReps: typeof match?.targetReps === "string" && match.targetReps ? match.targetReps : null,
      completedSets: done.length,
      averageRpe: average,
      ratedSets: rated,
      topWeight: topWeightOf(done),
    });
  });

  const notDone = planned
    .filter((exercise) => exercise?.name && !seen.has(normalise(exercise.name)))
    .map((exercise) => exercise.name);

  const plannedSetTotals = planned
    .map((exercise) => exercise?.targetSets)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const session = meanRpe(allSets);

  return {
    rows,
    notDone,
    unplanned,
    totalCompletedSets: rows.reduce((sum, row) => sum + row.completedSets, 0),
    /*
     * Null rather than 0 when nothing was planned. "18 of 0" is not a
     * comparison, and "18 of 18" must only appear when 18 were actually asked.
     */
    totalPlannedSets: plannedSetTotals.length > 0
      ? plannedSetTotals.reduce((sum, value) => sum + value, 0)
      : null,
    averageRpe: session.average,
    ratedSets: session.rated,
  };
};
