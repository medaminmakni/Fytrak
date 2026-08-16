import { ToastService } from "../components/Toast";
import { useState, useRef, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { auth } from "../config/firebase";
import {
  clearActiveWorkoutDraft,
  createEmptyWorkoutExercise,
  ACTIVE_WORKOUT_DRAFT_VERSION,
  hasMeaningfulWorkoutDraft,
  loadActiveWorkoutDraft,
  saveActiveWorkoutDraft,
  type ActiveWorkoutExerciseDraft,
} from "../features/workouts/activeWorkoutDraft";
import {
  duplicateSetForNextEntry,
  estimateOneRepMax,
  getBestEstimatedOneRepMaxForExercise,
} from "../features/workouts/workoutPerformance";
import { trackEvent } from "../services/analytics";
import type { PrescribedWorkout, WorkoutLog, WorkoutSet, WorkoutSetType } from "../services/userSession";
import type { ExerciseLibraryItem } from "../constants/exercises";
import { t as tEx } from "../constants/exercises";
import type { ProgramSession } from "../services/programService";
import {
  prefillWorkoutFromSession,
  type PrescribedSession,
  type ProgramSourceMetadata,
} from "../features/programs/programWorkout";

type ExerciseLog = ActiveWorkoutExerciseDraft;

export function useActiveWorkout(workouts: WorkoutLog[]) {
  const [workoutName, setWorkoutName] = useState("Today's Session");
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [activePrescriptionId, setActivePrescriptionId] = useState<string | null>(null);
  /*
   * Which program session this log is being performed against, if any.
   *
   * Carried to the save so completion can be PROVEN from the log rather than
   * written onto the coach's program document — which the trainee must not be
   * able to modify.
   */
  const [programSource, setProgramSource] = useState<ProgramSourceMetadata | null>(null);
  const [workoutStartedAt, setWorkoutStartedAt] = useState(new Date().toISOString());
  
  const hasLoadedDraftRef = useRef(false);
  const isCompletingWorkoutRef = useRef(false);

  // REST TIMER
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // LOCAL ACTIVE WORKOUT DRAFT
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      hasLoadedDraftRef.current = true;
      return;
    }

    let isMounted = true;

    loadActiveWorkoutDraft(user.uid).then((draft) => {
      if (!isMounted) return;

      hasLoadedDraftRef.current = true;
      if (!draft || !hasMeaningfulWorkoutDraft(draft)) return;

      ToastService.confirm({
        title: "Resume your workout?",
        message: "You have an unfinished session saved on this device.",
        confirmLabel: "Resume",
        cancelLabel: "Discard",
        onCancel: () => void clearActiveWorkoutDraft(user.uid),
        onConfirm: () => {
          const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(draft.updatedAt).getTime()) / 60000));
          trackEvent("active_workout_resumed", {
            exerciseCount: draft.exercises.length,
            ageMinutes,
          });
          setWorkoutName(draft.workoutName);
          setActivePrescriptionId(draft.activePrescriptionId);
          // Restores the link to the program session. v1 drafts carry null,
          // which is the honest answer — they never recorded one.
          setProgramSource(draft.programSource);
          setWorkoutStartedAt(draft.startedAt);
          setExercises(draft.exercises.length > 0 ? draft.exercises : []);
        },
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !hasLoadedDraftRef.current || isCompletingWorkoutRef.current) return;

    const draft = {
      version: ACTIVE_WORKOUT_DRAFT_VERSION,
      userId: user.uid,
      workoutName,
      activePrescriptionId,
      programSource,
      exercises,
      startedAt: workoutStartedAt,
      updatedAt: new Date().toISOString(),
    };

    const autosave = setTimeout(() => {
      if (hasMeaningfulWorkoutDraft(draft)) {
        void saveActiveWorkoutDraft(draft);
      } else {
        void clearActiveWorkoutDraft(user.uid);
      }
    }, 400);

    return () => clearTimeout(autosave);
  }, [activePrescriptionId, programSource, exercises, workoutName, workoutStartedAt]);

  // TIMER LOGIC
  // Deliberately depends on `timerActive` only. Including `restTimeLeft` here
  // (as it previously did) tore down and re-created the interval on every tick,
  // restarting the 1000ms clock after each render commit and accumulating
  // drift. The functional updater below already sees the latest value, so the
  // interval can be created once per active period.
  useEffect(() => {
    if (!timerActive) return;

    timerRef.current = setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerActive]);

  // WORKOUT ACTIONS
  const initFromPrescribed = useCallback((p: PrescribedWorkout) => {
    setWorkoutName(p.title);
    setActivePrescriptionId(p.id);
    /*
     * Clears any program session left over from a previous workout.
     *
     * Without this, opening a program session and then switching to a daily
     * prescription produced a log carrying BOTH — and the stale source would
     * have completed a program session the client never performed.
     */
    setProgramSource(null);
    setWorkoutStartedAt(new Date().toISOString());
    setExercises(p.exercises.map(ex => {
      const exType = ex.type || "WEIGHT_REPS";
      return {
        name: ex.name,
        type: exType,
        sets: Array(ex.targetSets).fill(0).map(() => ({
          type: exType,
          reps: exType === "TIME" ? undefined : Number(ex.targetReps) || 0,
          durationSec: exType === "TIME" ? parseInt(ex.targetReps) || 60 : undefined,
          isCompleted: false
        }))
      };
    }));
  }, []);

  /**
   * Opens a program session in the logger.
   *
   * Three things changed here, all of which were losing the coach's work:
   *
   * 1. `instructions` and `restTimeSec` were dropped entirely, so a coach
   *    writing "neutral grip if the shoulder complains" watched it never reach
   *    the person it was written for.
   * 2. The coach's `targetReps`/`targetWeight` were written straight into the
   *    client's `reps`/`weight`. The ask and the outcome were therefore the same
   *    number the moment the log saved, and no later screen could tell whether
   *    the client had hit the target or entered anything at all. Targets now
   *    ride alongside, and the client's own fields start empty.
   * 3. Nothing recorded WHICH session was being performed, so a finished
   *    workout could never be matched back to the prescription that asked for
   *    it. The source metadata is carried to the save.
   */
  const initFromProgramSession = useCallback((
    session: ProgramSession,
    programId: string,
    scheduledDateKey: string,
  ) => {
    const prefilled = prefillWorkoutFromSession(
      session as unknown as PrescribedSession,
      programId,
      scheduledDateKey,
    );
    setWorkoutName(prefilled.name);
    setActivePrescriptionId(null);
    setProgramSource(prefilled.source);
    setWorkoutStartedAt(new Date().toISOString());
    setExercises(prefilled.exercises.map((exercise) => ({
      name: exercise.name,
      type: exercise.type as WorkoutSetType,
      instructions: exercise.instructions,
      restTimeSec: exercise.restTimeSec,
      sets: exercise.sets.map((set) => ({
        type: set.type as WorkoutSetType,
        targetReps: set.targetReps,
        targetWeight: set.targetWeight,
        targetDurationSec: set.targetDurationSec,
        isCompleted: false,
      })),
    })));
  }, []);

  const addExerciseCard = useCallback(() => {
    setExercises((current) => [...current, createEmptyWorkoutExercise()]);
  }, []);

  const toggleSet = useCallback((exIdx: number, sIdx: number) => {
    const exercise = exercises[exIdx];
    const set = exercise?.sets[sIdx];
    if (!exercise || !set) return;

    const willComplete = !set.isCompleted;
    const updatedSet = { ...set, isCompleted: willComplete };

    // Keep React state updaters pure. Toast and timer updates below target
    // other components and must not run while React evaluates this update.
    setExercises((current) => current.map((currentExercise, exerciseIndex) => (
      exerciseIndex === exIdx
        ? {
            ...currentExercise,
            sets: currentExercise.sets.map((currentSet, setIndex) => (
              setIndex === sIdx ? updatedSet : currentSet
            )),
          }
        : currentExercise
    )));

    if (willComplete) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestTimeLeft(60);
      setTimerActive(true);

      const estimatedMax = estimateOneRepMax(updatedSet);
      const previousBest = getBestEstimatedOneRepMaxForExercise(exercise.name, workouts);
      if (estimatedMax > 0 && estimatedMax > previousBest + 0.5) {
        ToastService.success(
          "Potential PR",
          `${Math.round(estimatedMax)}kg estimated 1RM on ${exercise.name || "this exercise"}.`
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimerActive(false);
      setRestTimeLeft(0);
    }
  }, [exercises, workouts]);

  const updateSet = useCallback((exIdx: number, sIdx: number, field: keyof WorkoutSet, value: any) => {
    setExercises((current) => {
      const next = [...current];
      next[exIdx].sets[sIdx] = { ...next[exIdx].sets[sIdx], [field]: value };
      return next;
    });
  }, []);

  const duplicateSet = useCallback((exIdx: number) => {
    setExercises(current => {
      const next = [...current];
      const previousSet = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx].sets.push(previousSet ? duplicateSetForNextEntry(previousSet, next[exIdx].type) : { type: next[exIdx].type, isCompleted: false });
      return next;
    });
  }, []);

  const applyPreviousValues = useCallback((exIdx: number, previousSets: WorkoutSet[]) => {
    if (previousSets.length === 0) return;

    setExercises((current) => current.map((exercise, index) => {
      if (index !== exIdx) return exercise;

      const nextSets = exercise.sets.map((set, setIndex) => {
        if (set.isCompleted) return set;
        const previous = previousSets[setIndex];
        if (!previous) return set;
        return {
          ...set,
          weight: previous.weight,
          reps: previous.reps,
          durationSec: previous.durationSec,
          rpe: undefined,
        };
      });

      if (previousSets.length > nextSets.length) {
        previousSets.slice(nextSets.length).forEach((previous) => {
          nextSets.push(duplicateSetForNextEntry(previous, exercise.type));
        });
      }

      return { ...exercise, sets: nextSets };
    }));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ToastService.success("Loaded", "Previous values filled in.");
  }, []);

  const removeExercise = useCallback((exIdx: number) => {
    setExercises(current => current.filter((_, i) => i !== exIdx));
  }, []);

  const updateExerciseType = useCallback((exIdx: number, type: WorkoutSetType) => {
    setExercises(current => {
      const next = [...current];
      next[exIdx].type = type;
      next[exIdx].sets.forEach(s => s.type = type);
      return next;
    });
  }, []);

  const undoLastCompletedSet = useCallback(() => {
    for (let exIdx = exercises.length - 1; exIdx >= 0; exIdx -= 1) {
      for (let setIdx = exercises[exIdx].sets.length - 1; setIdx >= 0; setIdx -= 1) {
        if (exercises[exIdx].sets[setIdx].isCompleted) {
          setExercises((current) => current.map((exercise, exerciseIndex) => {
            if (exerciseIndex !== exIdx) return exercise;
            return {
              ...exercise,
              sets: exercise.sets.map((set, index) => (
                index === setIdx ? { ...set, isCompleted: false } : set
              )),
            };
          }));
          setTimerActive(false);
          setRestTimeLeft(0);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          ToastService.info("Undone", `Set ${setIdx + 1} marked incomplete.`);
          return;
        }
      }
    }
  }, [exercises]);

  return {
    workoutName, setWorkoutName,
    exercises, setExercises,
    activePrescriptionId,
    programSource, setProgramSource,
setActivePrescriptionId,
    workoutStartedAt, setWorkoutStartedAt,
    isCompletingWorkoutRef,
    restTimeLeft, setRestTimeLeft,
    timerActive, setTimerActive,
    initFromPrescribed,
    initFromProgramSession,
    addExerciseCard,
    toggleSet,
    updateSet,
    duplicateSet,
    applyPreviousValues,
    removeExercise,
    updateExerciseType,
    undoLastCompletedSet,
  };
}
