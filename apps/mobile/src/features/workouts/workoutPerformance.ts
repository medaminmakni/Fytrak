import type { WorkoutLog, WorkoutSet } from "../../services/userSession";
import type { ActiveWorkoutExerciseDraft } from "./activeWorkoutDraft";

export type CompletedWorkoutExercise = {
  name: string;
  sets: WorkoutSet[];
};

export type WorkoutPersonalRecord = {
  exerciseName: string;
  estimatedOneRepMax: number;
  previousBest: number;
};

export type ExercisePreviousPerformance = {
  workoutName: string;
  sets: WorkoutSet[];
};

export function getCompletedWorkoutExercises(exercises: ActiveWorkoutExerciseDraft[]): CompletedWorkoutExercise[] {
  return exercises
    .map((exercise) => ({
      name: exercise.name.trim() || "Untitled",
      sets: exercise.sets.filter((set) => set.isCompleted),
    }))
    .filter((exercise) => exercise.sets.length > 0);
}

export function calculateWorkoutVolume(exercises: CompletedWorkoutExercise[]): number {
  return exercises.reduce((sum, exercise) => {
    return sum + exercise.sets.reduce((setSum, set) => {
      return setSum + ((set.weight || 0) * (set.reps || 0));
    }, 0);
  }, 0);
}

/**
 * A trainee's typed RPE, or the decision to store nothing.
 *
 * Returns `{ ok: false }` for input that is not an RPE, so the row can ignore
 * the keystroke rather than storing a value the scale does not have. Clearing
 * the field yields `{ ok: true, rpe: undefined }` — Firestore is configured
 * with `ignoreUndefinedProperties`, so an unrated set carries no `rpe` field at
 * all and reads back as genuinely absent rather than as a zero.
 *
 * RPE is never required. It is the one field on a set that describes how the
 * work felt, and a trainee who does not want to rate a set must be able to
 * finish it — the same rule the post-session check-in follows.
 */
export function parseRpeInput(raw: string): { ok: true; rpe: string | undefined } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, rpe: undefined };
  if (!/^\d{1,2}$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1 || value > 10) return { ok: false };
  return { ok: true, rpe: String(value) };
}

export function duplicateSetForNextEntry(set: WorkoutSet, type: WorkoutSet["type"]): WorkoutSet {
  return {
    type,
    reps: set.reps,
    weight: set.weight,
    durationSec: set.durationSec,
    // RPE describes effort actually experienced in this set. A new set has
    // not happened yet, so carrying a prior rating would fabricate data.
    rpe: undefined,
    isCompleted: false,
  };
}

export function getLatestExercisePerformance(
  exerciseName: string,
  workoutHistory: WorkoutLog[]
): ExercisePreviousPerformance | null {
  const normalizedName = exerciseName.trim().toLowerCase();
  if (!normalizedName) return null;

  for (const workout of workoutHistory) {
    const match = workout.exercises.find((exercise) => {
      return exercise.name.trim().toLowerCase() === normalizedName;
    });

    if (match) {
      return {
        workoutName: workout.name,
        sets: match.sets.filter((set) => set.isCompleted),
      };
    }
  }

  return null;
}

export function estimateOneRepMax(set: WorkoutSet): number {
  if (!set.weight || !set.reps || set.reps <= 0) return 0;
  return set.weight / (1.0278 - 0.0278 * set.reps);
}

export function getBestEstimatedOneRepMaxForExercise(
  exerciseName: string,
  workoutHistory: WorkoutLog[]
): number {
  const normalizedName = exerciseName.trim().toLowerCase();
  if (!normalizedName) return 0;

  return workoutHistory.reduce((best, workout) => {
    const exercise = workout.exercises.find((item) => item.name.trim().toLowerCase() === normalizedName);
    if (!exercise) return best;

    const bestInWorkout = exercise.sets.reduce((setBest, set) => {
      return Math.max(setBest, estimateOneRepMax(set));
    }, 0);

    return Math.max(best, bestInWorkout);
  }, 0);
}

export function detectWorkoutPersonalRecords(
  completedExercises: CompletedWorkoutExercise[],
  workoutHistory: WorkoutLog[]
): WorkoutPersonalRecord[] {
  const previousBestByExercise = new Map<string, number>();

  workoutHistory.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const key = exercise.name.trim().toLowerCase();
      const bestInWorkout = exercise.sets.reduce((best, set) => Math.max(best, estimateOneRepMax(set)), 0);
      previousBestByExercise.set(key, Math.max(previousBestByExercise.get(key) || 0, bestInWorkout));
    });
  });

  return completedExercises.flatMap((exercise) => {
    const key = exercise.name.trim().toLowerCase();
    const currentBest = exercise.sets.reduce((best, set) => Math.max(best, estimateOneRepMax(set)), 0);
    const previousBest = previousBestByExercise.get(key) || 0;

    if (currentBest > 0 && currentBest > previousBest + 0.5) {
      return [{
        exerciseName: exercise.name,
        estimatedOneRepMax: Math.round(currentBest),
        previousBest: Math.round(previousBest),
      }];
    }

    return [];
  });
}
