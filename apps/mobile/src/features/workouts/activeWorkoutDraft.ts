import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutSet, WorkoutSetType } from "../../services/userSession";
import type { ProgramSourceMetadata } from "../programs/programWorkout";

export type ActiveWorkoutExerciseDraft = {
  exerciseId?: string;
  name: string;
  type: WorkoutSetType;
  sets: WorkoutSet[];
};

/** The current draft shape. Bump this and add a migration branch below. */
export const ACTIVE_WORKOUT_DRAFT_VERSION = 2 as const;

export type ActiveWorkoutDraft = {
  version: 2;
  userId: string;
  workoutName: string;
  activePrescriptionId: string | null;
  /**
   * Which program session this draft is being performed against, if any.
   *
   * v1 drafts had no such field, so a client who started a program session,
   * backgrounded the app and resumed came back to a workout that had silently
   * forgotten which session it was — and the log it produced could never be
   * matched to the prescription. Resuming now restores the link.
   *
   * `null` is meaningful and must be written: it is how a manual or
   * prescription-based workout says "not a program session", and how a stale
   * source from a previous workout gets cleared rather than inherited.
   */
  programSource: ProgramSourceMetadata | null;
  exercises: ActiveWorkoutExerciseDraft[];
  startedAt: string;
  updatedAt: string;
};

/** A v1 draft, kept only so the migration can describe what it reads. */
type LegacyWorkoutDraftV1 = Omit<ActiveWorkoutDraft, "version" | "programSource"> & { version: 1 };

const keyForUser = (userId: string) => `fytrak:active-workout:${userId}`;

export function createEmptyWorkoutExercise(): ActiveWorkoutExerciseDraft {
  return {
    name: "",
    type: "WEIGHT_REPS",
    sets: [{ type: "WEIGHT_REPS", isCompleted: false }],
  };
}

export function hasMeaningfulWorkoutDraft(draft: Pick<ActiveWorkoutDraft, "workoutName" | "exercises">): boolean {
  const hasNamedWorkout = draft.workoutName.trim() !== "" && draft.workoutName !== "Today's Session";
  const hasExerciseData = draft.exercises.some((exercise) => {
    return (
      exercise.name.trim() !== "" ||
      exercise.sets.some((set) => set.isCompleted || Boolean(set.reps) || Boolean(set.weight) || Boolean(set.durationSec))
    );
  });

  return hasNamedWorkout || hasExerciseData;
}

export async function saveActiveWorkoutDraft(draft: ActiveWorkoutDraft): Promise<void> {
  await AsyncStorage.setItem(keyForUser(draft.userId), JSON.stringify(draft));
}

/**
 * Brings a stored draft up to the current version, or rejects it.
 *
 * Pure and exported so every branch is testable without AsyncStorage. Returns
 * null for anything unreadable, which the caller treats as "discard".
 *
 * A v1 draft is a valid draft written before program sessions were traceable.
 * It loads with `programSource: null` — the honest answer, since nothing in it
 * records which session it came from. Discarding it instead would lose a
 * client's half-finished workout to a schema change they never saw.
 */
export function migrateWorkoutDraft(parsed: unknown, userId: string): ActiveWorkoutDraft | null {
  if (!parsed || typeof parsed !== "object") return null;
  const draft = parsed as Partial<ActiveWorkoutDraft> & Partial<LegacyWorkoutDraftV1>;

  if (draft.userId !== userId) return null;
  if (!Array.isArray(draft.exercises)) return null;

  if (draft.version === 1) {
    return {
      ...(draft as unknown as LegacyWorkoutDraftV1),
      version: ACTIVE_WORKOUT_DRAFT_VERSION,
      programSource: null,
    };
  }

  if (draft.version === ACTIVE_WORKOUT_DRAFT_VERSION) {
    return {
      ...(draft as unknown as ActiveWorkoutDraft),
      // Absent or malformed is treated as "no source" rather than trusted.
      programSource: isProgramSource(draft.programSource) ? draft.programSource : null,
    };
  }

  // A version from the future, or none at all.
  return null;
}

/** All four fields, or it is not a source. A partial link points at nothing. */
const isProgramSource = (value: unknown): value is ProgramSourceMetadata => {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<ProgramSourceMetadata>;
  return source.sourceType === "program"
    && typeof source.sourceProgramId === "string" && source.sourceProgramId.length > 0
    && typeof source.sourceProgramSessionId === "string" && source.sourceProgramSessionId.length > 0
    && typeof source.sourceScheduledDateKey === "string" && source.sourceScheduledDateKey.length > 0;
};

export async function loadActiveWorkoutDraft(userId: string): Promise<ActiveWorkoutDraft | null> {
  const raw = await AsyncStorage.getItem(keyForUser(userId));
  if (!raw) return null;

  try {
    const migrated = migrateWorkoutDraft(JSON.parse(raw), userId);
    if (!migrated) {
      await clearActiveWorkoutDraft(userId);
      return null;
    }
    return migrated;
  } catch {
    await clearActiveWorkoutDraft(userId);
    return null;
  }
}

export async function clearActiveWorkoutDraft(userId: string): Promise<void> {
  await AsyncStorage.removeItem(keyForUser(userId));
}
