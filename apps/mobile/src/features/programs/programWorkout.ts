/**
 * The two crossings between a coach's program and a client's workout log.
 *
 * OUT: a prescribed session becomes a prefilled log.
 * BACK: a finished log proves which session it satisfied.
 *
 * Both are pure. Both are places the previous implementation lost information:
 * the conversion dropped the coach's instructions and rest times, and nothing
 * at all connected a completed workout to the session that asked for it.
 */

export type ProgramSourceMetadata = {
  /** Discriminates a program session from a dated daily prescription. */
  sourceType: "program";
  sourceProgramId: string;
  sourceProgramSessionId: string;
  /** The client-local day the session was scheduled for. */
  sourceScheduledDateKey: string;
};

export type PrescribedSet = {
  type: string;
  targetReps?: number | null;
  targetWeight?: number | null;
  targetDurationSec?: number | null;
};

export type PrescribedExercise = {
  name: string;
  instructions?: string | null;
  restTimeSec?: number | null;
  suggestedSets: PrescribedSet[];
};

export type PrescribedSession = {
  id: string;
  title: string;
  estimatedMinutes?: number;
  exercises: PrescribedExercise[];
};

export type PrefilledSet = {
  type: string;
  /** The coach's ask, carried so the client sees it before overwriting it. */
  targetReps?: number;
  targetWeight?: number;
  targetDurationSec?: number;
  reps?: number;
  weight?: number;
  durationSec?: number;
  isCompleted: false;
};

export type PrefilledExercise = {
  name: string;
  type: string;
  instructions?: string;
  restTimeSec?: number;
  sets: PrefilledSet[];
};

export type PrefilledWorkout = {
  name: string;
  exercises: PrefilledExercise[];
  source: ProgramSourceMetadata;
};

const positive = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

/**
 * A prescribed session, ready for the logger.
 *
 * TARGETS ARE CARRIED SEPARATELY FROM ACTUALS. The previous conversion wrote
 * the coach's `targetReps` straight into the client's `reps` field, so the
 * moment the log saved, the ask and the outcome were the same number and no
 * later screen could tell whether the client had actually hit it — or entered
 * anything at all. The client's fields start empty; the coach's ask rides
 * alongside as `target*`, which is also what makes the coach's session review
 * a comparison rather than a restatement.
 *
 * `instructions` and `restTimeSec` are preserved. Both were silently dropped,
 * which meant a coach writing "neutral grip if the shoulder complains" watched
 * it never reach the person it was written for.
 */
export const prefillWorkoutFromSession = (
  session: PrescribedSession,
  programId: string,
  scheduledDateKey: string,
): PrefilledWorkout => ({
  name: session.title?.trim() || "Session",
  exercises: (session.exercises ?? []).map((exercise) => {
    const sets = exercise.suggestedSets ?? [];
    // An exercise with no prescribed sets still gets one empty row, so the
    // client has somewhere to log rather than an exercise they cannot fill in.
    const source: PrescribedSet[] = sets.length > 0 ? sets : [{ type: "WEIGHT_REPS" }];
    return {
      name: exercise.name,
      type: source[0]?.type ?? "WEIGHT_REPS",
      ...(exercise.instructions?.trim() ? { instructions: exercise.instructions.trim() } : {}),
      ...(positive(exercise.restTimeSec) !== undefined ? { restTimeSec: positive(exercise.restTimeSec) } : {}),
      sets: source.map((set) => ({
        type: set.type,
        ...(positive(set.targetReps) !== undefined ? { targetReps: positive(set.targetReps) } : {}),
        ...(positive(set.targetWeight) !== undefined ? { targetWeight: positive(set.targetWeight) } : {}),
        ...(positive(set.targetDurationSec) !== undefined ? { targetDurationSec: positive(set.targetDurationSec) } : {}),
        isCompleted: false as const,
      })),
    };
  }),
  source: {
    sourceType: "program",
    sourceProgramId: programId,
    sourceProgramSessionId: session.id,
    sourceScheduledDateKey: scheduledDateKey,
  },
});

/** True when a session has enough content to be opened. */
export const sessionIsReady = (session: { exercises?: unknown[] } | null | undefined): boolean =>
  Array.isArray(session?.exercises) && (session?.exercises?.length ?? 0) > 0;

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export type CompletionCandidate = {
  id: string;
  sourceType?: string | null;
  sourceProgramId?: string | null;
  sourceProgramSessionId?: string | null;
  sourceScheduledDateKey?: string | null;
};

/**
 * The logs that completed a specific program session.
 *
 * ALL FOUR PARTS MUST MATCH. A workout logged on the same day is not the same
 * thing as the session: a client who does their own cardio on a Tuesday has not
 * completed Tuesday's prescribed pushing session, and crediting it would tell
 * the coach a lie in the one place they look to decide the next week.
 *
 * Completion is derived from the log, never stored on the program. The program
 * document is the coach's prescription and the trainee must not be able to
 * write to it — which is also why `isCompleted` on `ProgramSession` cannot be
 * the source of truth.
 */
export const findSessionCompletions = (
  logs: CompletionCandidate[],
  programId: string,
  sessionId: string,
  scheduledDateKey: string,
): CompletionCandidate[] => {
  if (!programId || !sessionId || !scheduledDateKey) return [];
  return (logs ?? []).filter(
    (log) =>
      log?.sourceType === "program" &&
      log.sourceProgramId === programId &&
      log.sourceProgramSessionId === sessionId &&
      log.sourceScheduledDateKey === scheduledDateKey,
  );
};

export const isSessionCompleted = (
  logs: CompletionCandidate[],
  programId: string,
  sessionId: string,
  scheduledDateKey: string,
): boolean => findSessionCompletions(logs, programId, sessionId, scheduledDateKey).length > 0;

/**
 * The one log that counts, when a session was submitted more than once.
 *
 * Retries and double-taps can produce several logs carrying the same source.
 * Rather than deleting anything — history stays intact — the earliest is
 * treated as the completion and the rest remain ordinary logs. Ordering is by
 * document id, which is total and identical on every device.
 */
export const canonicalCompletion = (
  logs: CompletionCandidate[],
  programId: string,
  sessionId: string,
  scheduledDateKey: string,
): CompletionCandidate | null => {
  const matches = findSessionCompletions(logs, programId, sessionId, scheduledDateKey);
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => a.id.localeCompare(b.id))[0];
};
