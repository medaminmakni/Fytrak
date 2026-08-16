import * as Haptics from "expo-haptics";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { waitForPendingWrites } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import {
  saveWorkoutLog,
  completePrescribedWorkout,
  saveWorkoutIntake,
  type ProfileLevel
} from "../../services/userSession";
import { ExerciseLibraryItem, t as tEx } from "../../constants/exercises";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";

// Shared Components
import { ToastService } from "../../components/Toast";
import { Typography } from "../../components/Typography";
import { ExerciseDetailSheet } from "../../components/ExerciseDetailSheet";
import {
  clearActiveWorkoutDraft,
  type ActiveWorkoutExerciseDraft,
} from "../../features/workouts/activeWorkoutDraft";
import {
  calculateWorkoutVolume,
  detectWorkoutPersonalRecords,
  getLatestExercisePerformance,
  getCompletedWorkoutExercises,
} from "../../features/workouts/workoutPerformance";
import { trackEvent } from "../../services/analytics";
import { toLocalDateKey } from "../../utils/dateKeys";
import { radius, spacing, touchTarget, typography } from "../../theme/tokens";

import { useActiveWorkout } from "../../hooks/useActiveWorkout";
import { useExerciseSearch } from "../../hooks/useExerciseSearch";
import { usePrescribedWorkouts } from "../../hooks/usePrescribedWorkouts";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useWorkouts } from "../../hooks/useWorkouts";
import { WorkoutExerciseCard } from "../../components/WorkoutExerciseCard";
import { ExerciseSearchModal } from "../../features/workouts/components/ExerciseSearchModal";
import { WorkoutCheckInView } from "../../features/workouts/components/WorkoutCheckInView";
import {
  emptyCheckInDraft,
  toStoredCheckIn,
  validateCheckInDraft,
  type CheckInDraft,
} from "../../features/workouts/checkIn";
import { WorkoutIntakeView } from "../../features/workouts/components/WorkoutIntakeView";
import { RestTimer } from "../../features/workouts/components/RestTimer";
import { useClientDateKey } from "../../hooks/useClientDateKey";
import { resolvePlanDimension } from "../../features/plans/planResolution";
import {
  selectUnscheduled,
  toWorkoutCandidates,
  type ScheduledPrescribedWorkout,
} from "../../features/plans/planAdapters";

type ExerciseLog = ActiveWorkoutExerciseDraft;

export function WorkoutLogScreen() {
  const workouts = useWorkouts();
  const prescribed = usePrescribedWorkouts();
  const { profile } = useUserProfile();
  const dateKey = useClientDateKey(profile?.timezone);
  const scheduledPrescriptions = prescribed as ScheduledPrescribedWorkout[];
  const todayPrescription = useMemo(
    () => resolvePlanDimension({
      dateKey,
      dailyCandidates: toWorkoutCandidates(scheduledPrescriptions),
    }),
    [dateKey, prescribed]
  );
  const visiblePrescription = todayPrescription.sourceType === "daily"
    ? todayPrescription.payload
    : selectUnscheduled(scheduledPrescriptions)[0] ?? null;

  const {
    workoutName, setWorkoutName,
    exercises, setExercises,
    activePrescriptionId, setActivePrescriptionId,
    programSource, setProgramSource,
    workoutStartedAt, setWorkoutStartedAt,
    isCompletingWorkoutRef,
    restTimeLeft, setRestTimeLeft,
    timerActive, setTimerActive,
    initFromPrescribed,
    initFromProgramSession,
    toggleSet,
    updateSet,
    duplicateSet,
    applyPreviousValues,
    removeExercise,
    updateExerciseType,
    undoLastCompletedSet,
  } = useActiveWorkout(workouts);

  // EXERCISE INFO MODAL
  const [selectedExerciseInfo, setSelectedExerciseInfo] = useState<ExerciseLibraryItem | null>(null);
  const [isExerciseModalVisible, setIsExerciseModalVisible] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null);
  const {
    query: exerciseSearchQuery,
    setQuery: setExerciseSearchQuery,
    isSearching,
    filteredExercises,
    findExerciseInfo,
  } = useExerciseSearch({ includeMuscleGroup: true });

  const applyExerciseSelection = useCallback((exercise: ExerciseLog) => {
    setExercises((current) => {
      if (activeExerciseIndex === null) {
        return [...current, exercise];
      }

      return current.map((item, index) => (index === activeExerciseIndex ? exercise : item));
    });
  }, [activeExerciseIndex]);

  const addCustomExercise = useCallback((name: string) => {
    const customName = name.trim() || "Custom Exercise";
    applyExerciseSelection({
      name: customName,
      type: "WEIGHT_REPS",
      sets: [{ type: "WEIGHT_REPS", isCompleted: false }],
    });
  }, [applyExerciseSelection]);

  const lookupExerciseInfo = useCallback((exercise: ExerciseLog) => {
    return findExerciseInfo({ id: exercise.exerciseId, name: exercise.name });
  }, [findExerciseInfo]);

  const openExerciseDetails = useCallback((exercise: ExerciseLibraryItem) => {
    setIsExerciseModalVisible(false);
    setSelectedExerciseInfo(exercise);
  }, []);

  const addLibraryExerciseToWorkout = useCallback((exercise: ExerciseLibraryItem) => {
    applyExerciseSelection({
      exerciseId: exercise.id,
      name: tEx(exercise.name),
      type: exercise.defaultType,
      sets: [{ type: exercise.defaultType, isCompleted: false }],
    });
    setSelectedExerciseInfo(null);
    setExerciseSearchQuery("");
    ToastService.success("Added", `${tEx(exercise.name)} is ready to log.`);
  }, [applyExerciseSelection]);



  // NAVIGATION
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // COMPUTED LIVE STATS
  const totalSetsCompleted = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.isCompleted).length, 0);
  const totalVolume = exercises.reduce((sum, ex) => {
    return sum + ex.sets.filter(s => s.isCompleted && s.type === "WEIGHT_REPS").reduce((setSum, s) => setSum + ((Number(s.weight) || 0) * (Number(s.reps) || 0)), 0);
  }, 0);

  // INTAKE STATES
  const [showIntake, setShowIntake] = useState(false);

  // CHECK-IN STATES
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  /*
   * One nullable draft, all fields starting unanswered. The previous version
   * seeded energy/soreness/mood at 3 and sleep at 7.5h and wrote them whether
   * or not the client touched anything, so a coach could read numbers the form
   * had invented.
   */
  const [checkInDraft, setCheckInDraft] = useState<CheckInDraft>(emptyCheckInDraft);
  const [isSubmittingWorkout, setIsSubmittingWorkout] = useState(false);
  // Tracks the id returned by saveWorkoutLog once it succeeds, so that if a
  // later step (completePrescribedWorkout / clearActiveWorkoutDraft) throws
  // and the user retries, we don't create a second duplicate workout doc.
  const savedWorkoutIdRef = useRef<string | null>(null);

  // PREVENT ACCIDENTAL DISCARD
  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e: any) => {
        if (totalSetsCompleted === 0 || isCheckingIn || showIntake) return;
        e.preventDefault();
        ToastService.confirm({
          title: "Discard this workout?",
          message: "Your active log will be lost.",
          confirmLabel: "Discard",
          cancelLabel: "Keep logging",
          destructive: true,
          onConfirm: () => {
            const userId = auth.currentUser?.uid;
            if (userId) void clearActiveWorkoutDraft(userId);
            // The in-memory link goes with the draft. Leaving it set would let
            // the next workout inherit a session it never performed.
            setProgramSource(null);
            navigation.dispatch(e.data.action);
          },
        });
      };
      navigation.addListener('beforeRemove', onBeforeRemove);
      return () => navigation.removeListener('beforeRemove', onBeforeRemove);
    }, [navigation, totalSetsCompleted, isCheckingIn, showIntake])
  );

  // INTAKE AUTO-SHOW
  useEffect(() => {
    if (profile && profile.workoutProfileCompleted !== true) setShowIntake(true);
  }, [profile]);

  // AUTO-LOAD PRESCRIPTION
  useEffect(() => {
    const targetId = route.params?.autoLoadPrescriptionId;
    if (targetId && prescribed.length > 0) {
      const found = prescribed.find(p => p.id === targetId);
      if (found) {
        initFromPrescribed(found);
        navigation.setParams({ autoLoadPrescriptionId: undefined });
      }
    }
  }, [route.params?.autoLoadPrescriptionId, prescribed]);

  useEffect(() => {
    const programSession = route.params?.programSession;
    const programId = route.params?.programId;
    const scheduledDateKey = route.params?.programScheduledDateKey;
    if (!programSession) return;
    /*
     * All three or nothing. Opening a session without its program id and
     * scheduled day would produce a log that cannot be matched back to the
     * prescription — the exact gap this phase closes — so the params are
     * cleared and the session is not opened rather than opened untraceably.
     */
    if (!programId || !scheduledDateKey) {
      navigation.setParams({ programSession: undefined, programId: undefined, programScheduledDateKey: undefined });
      ToastService.error("Could not open the session", "Its program details are missing. Open it from Today.");
      return;
    }
    initFromProgramSession(programSession, programId, scheduledDateKey);
    navigation.setParams({ programSession: undefined, programId: undefined, programScheduledDateKey: undefined });
  }, [initFromProgramSession, navigation, route.params?.programSession, route.params?.programId, route.params?.programScheduledDateKey]);




  const handleCompleteWithCheckIn = async () => {
    const user = auth.currentUser;
    if (!user) return;

    /*
     * The one thing that can block a save: a pain flag with no description.
     * Re-checked here and not only in the view, because the button is not the
     * only path into this function.
     */
    const validation = validateCheckInDraft(checkInDraft);
    if (!validation.ok) {
      ToastService.error("Almost there", validation.message);
      return;
    }
    // `undefined` when the client answered nothing at all.
    const storedCheckIn = toStoredCheckIn(checkInDraft);

    if (isCompletingWorkoutRef.current) return; // re-entrancy guard: blocks double-tap/double-invoke
    isCompletingWorkoutRef.current = true;
    setIsSubmittingWorkout(true);
    try {
      const completedExercises = getCompletedWorkoutExercises(exercises);
      const personalRecords = detectWorkoutPersonalRecords(completedExercises, workouts);
      const totalVolume = calculateWorkoutVolume(completedExercises);
      const duration = Math.max(1, Math.round((Date.now() - new Date(workoutStartedAt).getTime()) / 60000));

      // Only write the workout log once. If a later step below throws and
      // the user retries, savedWorkoutIdRef already being set skips this
      // call instead of creating a duplicate workout document.
      if (!savedWorkoutIdRef.current) {
        savedWorkoutIdRef.current = await saveWorkoutLog(
          user.uid,
          {
            name: workoutName.trim() || "Today's Session",
            exercises: completedExercises,
            duration,
            totalVolume,
            /*
             * Which program session this satisfied, when it satisfied one.
             * Absent on a freely logged workout — and that absence is exactly
             * what stops an unrelated session from completing a prescription.
             */
            ...(programSource ?? {}),
            // `undefined` when the client skipped, so the field is absent from
            // the document rather than stored as an empty object or defaults.
            ...(storedCheckIn ? { checkIn: storedCheckIn } : {}),
          },
          profile?.timezone
        );
      }
      if (activePrescriptionId) await completePrescribedWorkout(user.uid, activePrescriptionId);
      trackEvent("workout_completed", {
        setsCompleted: completedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
        totalVolume,
        durationMinutes: duration,
        personalRecords: personalRecords.length,
        source: programSource ? "program_session" : activePrescriptionId ? "coach_prescribed" : "manual",
      });
      setIsCheckingIn(false);
      setExercises([]); // Clear local state so beforeRemove discard alert is bypassed
      ToastService.success(
        personalRecords.length > 0 ? "New PR!" : "Workout Complete!",
        personalRecords.length > 0
          ? `${personalRecords[0].exerciseName}: ${personalRecords[0].estimatedOneRepMax}kg estimated 1RM`
          : "Excellent work today."
      );
      savedWorkoutIdRef.current = null;
      setIsSubmittingWorkout(false);
      navigation.navigate("Home");

      // saveWorkoutLog's addDoc() resolves as soon as the write is queued
      // locally, not once the server confirms it — this SDK configuration
      // has no durable offline cache on React Native (memory-only), so a
      // killed app before a queued write syncs would otherwise lose it.
      // Give the write a bounded window to reach the server before deleting
      // the AsyncStorage draft backup. isCompletingWorkoutRef stays true
      // (blocking the autosave effect from touching the draft) until this
      // settles. This reduces, but cannot fully eliminate, the data-loss
      // window without switching to a Firestore client with real disk
      // persistence on RN.
      Promise.race([
        waitForPendingWrites(db).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ])
        .then(() => clearActiveWorkoutDraft(user.uid))
        .catch(() => {})
        .finally(() => {
          isCompletingWorkoutRef.current = false;
          // The session has been logged. Anything started next is its own
          // workout, not another attempt at this one.
          setProgramSource(null);
        });
    } catch (error) {
      console.error("Workout submission error:", error);
      isCompletingWorkoutRef.current = false;
      setIsSubmittingWorkout(false);
      ToastService.error(
        "Error",
        savedWorkoutIdRef.current
          ? "Your workout was saved, but finishing touches failed. Tap Submit again to retry."
          : "Could not save log. Your workout draft is still saved."
      );
    }
  };

  const reviewCompletedExercises = getCompletedWorkoutExercises(exercises);
  const reviewPersonalRecords = detectWorkoutPersonalRecords(reviewCompletedExercises, workouts);
  const reviewDuration = Math.max(1, Math.round((Date.now() - new Date(workoutStartedAt).getTime()) / 60000));

  if (showIntake) {
    return (
      <ScreenShell title="Workout" subtitle="Onboarding details" contentStyle={styles.shellContent}>
        <WorkoutIntakeView onComplete={() => setShowIntake(false)} />
      </ScreenShell>
    );
  }

  if (isCheckingIn) {
    return (
      <ScreenShell title="Check-in" subtitle="Feedback" contentStyle={styles.shellContent}>
        <WorkoutCheckInView
          workoutName={workoutName}
          totalSetsCompleted={totalSetsCompleted}
          totalVolume={totalVolume}
          durationMinutes={reviewDuration}
          personalRecords={reviewPersonalRecords}
          draft={checkInDraft}
          onDraftChange={setCheckInDraft}
          onSubmit={handleCompleteWithCheckIn}
          onBack={() => setIsCheckingIn(false)}
          isSubmitting={isSubmittingWorkout}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Workout" subtitle="Track progress" contentStyle={styles.shellContent}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {(profile?.isPremium || profile?.assignmentStatus === "assigned") && visiblePrescription && workoutName !== visiblePrescription.title && (
            <Pressable style={styles.prescribedBanner} onPress={() => initFromPrescribed(visiblePrescription)}>
              <Ionicons name="flash" size={18} color="#000" />
              <Text style={styles.bannerText}>
                {todayPrescription.sourceType === "daily" ? "LOAD TODAY'S PLAN" : "LOAD UNSCHEDULED PLAN"}: {visiblePrescription.title}
              </Text>
            </Pressable>
          )}

          <View style={styles.sessionFocusCard}>
            <View style={styles.sessionFocusHeader}>
              <View style={{ flex: 1 }}>
                <Typography variant="label" color={colors.primary}>ACTIVE SESSION</Typography>
                <TextInput
                  style={styles.workoutNameInput}
                  value={workoutName}
                  onChangeText={setWorkoutName}
                  placeholder="Workout Name"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={styles.autosavePill}>
                <Ionicons name="cloud-done-outline" size={14} color={colors.success} />
                <Text style={styles.autosaveText}>Saved</Text>
              </View>
            </View>
            <View style={styles.liveStatsRow}>
              <View style={styles.liveStatBox}>
                <Typography variant="label" color={colors.textMuted}>SETS</Typography>
                <Typography variant="metric">{totalSetsCompleted}</Typography>
              </View>
              <View style={styles.liveStatBox}>
                <Typography variant="label" color={colors.textMuted}>VOLUME</Typography>
                <Typography variant="metric">{totalVolume} <Typography variant="label" color={colors.textDim}>kg</Typography></Typography>
              </View>
              <View style={styles.liveStatBox}>
                <Typography variant="label" color={colors.textMuted}>REST</Typography>
                <Typography variant="metric" style={styles.restMetric}>
                  {timerActive && restTimeLeft > 0 ? `${Math.floor(restTimeLeft / 60)}:${String(restTimeLeft % 60).padStart(2, "0")}` : "--"}
                </Typography>
              </View>
            </View>
            {totalSetsCompleted > 0 ? (
              <Pressable style={styles.undoLastSetBtn} onPress={undoLastCompletedSet}>
                <Ionicons name="arrow-undo" size={16} color={colors.textMuted} />
                <Text style={styles.undoLastSetText}>Undo last completed set</Text>
              </Pressable>
            ) : null}
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color="#333" />
              <Typography variant="h2" color={colors.textMuted}>Time to train</Typography>
              <Typography variant="bodySmall" color={colors.textFaint}>Add your first exercise to start tracking.</Typography>
            </View>
          ) : (
            exercises.map((ex, exIdx) => {
              const previousPerformance = getLatestExercisePerformance(ex.name, workouts);
              const previousSummary = previousPerformance?.sets
                .slice(0, 3)
                .map((set) => {
                  if (set.type === "TIME") return `${set.durationSec || 0}s`;
                  if (set.type === "BODYWEIGHT" || set.type === "REPS_ONLY") return `${set.reps || 0} reps`;
                  return `${set.weight || 0}kg x ${set.reps || 0}`;
                })
                .join("  |  ");

              return (
                <WorkoutExerciseCard
                  key={exIdx}
                  ex={ex}
                  exIdx={exIdx}
                  previousSummary={previousSummary}
                  previousSets={previousPerformance?.sets}
                  hasVideoUrl={!!lookupExerciseInfo(ex)?.videoUrl}
                  onSearchExercise={() => {
                    setActiveExerciseIndex(exIdx);
                    setExerciseSearchQuery("");
                    setIsExerciseModalVisible(true);
                  }}
                  onOpenDetails={() => {
                    const info = lookupExerciseInfo(ex);
                    if (info) openExerciseDetails(info);
                  }}
                  onRemove={() => removeExercise(exIdx)}
                  onUpdateType={(type) => updateExerciseType(exIdx, type)}
                  onUpdateSet={(sIdx, field, value) => updateSet(exIdx, sIdx, field, value)}
                  onToggleSet={(sIdx) => toggleSet(exIdx, sIdx)}
                  onDuplicateSet={() => duplicateSet(exIdx)}
                  onApplyPrevious={(sets) => applyPreviousValues(exIdx, sets)}
                />
              );
            })
          )}

          <Pressable
            style={styles.addExBtn}
            onPress={() => {
              setActiveExerciseIndex(null);
              setExerciseSearchQuery("");
              setIsExerciseModalVisible(true);
            }}
          >
            <Ionicons name="add-circle" size={22} color={colors.primary} />
            <Text style={styles.addExText}>ADD EXERCISE</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.workoutActionDock}>
          <Pressable
            style={styles.dockFinishBtn}
            onPress={() => {
              if (totalSetsCompleted === 0) {
                ToastService.error("Empty Workout", "Please complete at least one set before checking in.");
                return;
              }
              setIsCheckingIn(true);
            }}
          >
            <Text style={styles.finishBtnText}>FINISH</Text>
            <Ionicons name="checkbox" size={20} color={colors.primaryText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {timerActive && restTimeLeft > 0 && (
        <RestTimer
          value={restTimeLeft}
          onAdjust={(d: number) => setRestTimeLeft(prev => prev + d)}
          onSkip={() => {
            setTimerActive(false);
            setRestTimeLeft(0);
          }}
        />
      )}

      <ExerciseSearchModal
        visible={isExerciseModalVisible}
        query={exerciseSearchQuery}
        onQueryChange={setExerciseSearchQuery}
        isSearching={isSearching}
        results={filteredExercises}
        onClose={() => setIsExerciseModalVisible(false)}
        onOpenDetails={openExerciseDetails}
        onSelectExercise={(exercise) => {
          addLibraryExerciseToWorkout(exercise);
          setIsExerciseModalVisible(false);
        }}
        onAddCustom={(name) => {
          addCustomExercise(name);
          setIsExerciseModalVisible(false);
          setExerciseSearchQuery("");
        }}
      />

      <ExerciseDetailSheet
        exercise={selectedExerciseInfo}
        isVisible={!!selectedExerciseInfo}
        onClose={() => setSelectedExerciseInfo(null)}
        primaryActionLabel="Add to workout"
        onPrimaryAction={addLibraryExerciseToWorkout}
      />
    </ScreenShell>
  );
}



const styles = StyleSheet.create({
  shellContent: { paddingBottom: 0 },
  scroll: { paddingBottom: 160, gap: spacing.md },
  prescribedBanner: { minHeight: touchTarget.comfortable, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: spacing.md, borderRadius: radius.md, gap: spacing.sm, marginTop: spacing.sm },
  bannerText: { color: colors.primaryText, ...typography.label },
  sessionFocusCard: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.borderSubtle, gap: spacing.lg },
  sessionFocusHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  workoutNameInput: { color: colors.text, ...typography.title, marginTop: spacing.sm },
  autosavePill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSubtle },
  autosaveText: { color: colors.textMuted, ...typography.label },
  liveStatsRow: { flexDirection: "row", gap: spacing.md },
  liveStatBox: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  restMetric: { color: colors.text },
  undoLastSetBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  undoLastSetText: { color: colors.textMuted, ...typography.label },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: spacing["4xl"], gap: spacing.sm, backgroundColor: colors.bgElevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: "dashed", marginBottom: spacing.lg },
  exerciseCard: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.borderSubtle },
  exerciseHeader: { gap: spacing.md, marginBottom: spacing.md },
  exerciseNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  exerciseNameInput: { flex: 1 },
  exerciseActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  removeExerciseBtn: { width: touchTarget.min, height: touchTarget.min, alignItems: "center", justifyContent: "center" },
  typeSelectorRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  typePill: { minHeight: 32, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderSubtle },
  typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillText: { color: colors.textMuted, ...typography.label, fontSize: 11 },
  typePillTextActive: { color: colors.primaryText },
  previousValuesCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: spacing.md },
  previousValuesIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: "center", justifyContent: "center" },
  previousValuesLabel: { color: colors.textFaint, ...typography.label, fontSize: 11 },
  previousValuesText: { color: colors.text, ...typography.bodySmall, fontWeight: "700" },
  previousValuesAction: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  previousValuesActionText: { color: colors.primaryText, ...typography.label, fontSize: 11 },
  tableHeader: { flexDirection: "row", marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  columnLabel: { flex: 1, color: colors.textFaint, ...typography.label, fontSize: 11, textAlign: "center" },
  columnLabelStart: { textAlign: I18nManager.isRTL ? "right" : "left" },
  setRow: { minHeight: 48, flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, marginBottom: spacing.sm },
  setRowCompleted: { backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: "rgba(255,204,0,0.28)" },
  setText: { color: colors.textMuted, ...typography.bodySmall, fontWeight: "800", textAlign: "center" },
  setInput: { flex: 1, color: colors.text, ...typography.body, fontWeight: "800", textAlign: "center", paddingVertical: spacing.sm },
  checkBtn: { flex: 0.5, minHeight: touchTarget.min, alignItems: "center", justifyContent: "center" },
  addSetBtn: { minHeight: touchTarget.min, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm, gap: spacing.xs },
  addSetText: { color: colors.primary, ...typography.label },
  addExBtn: { minHeight: 56, backgroundColor: colors.surface, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderWidth: 1, borderColor: "#333", gap: 10, marginBottom: spacing.xl },
  addExText: { color: colors.primary, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
  finishBtnText: { color: colors.primaryText, ...typography.button, fontSize: 16 },
  workoutActionDock: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 84, backgroundColor: "rgba(10,10,10,0.94)", borderRadius: radius.xl, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle },
  dockFinishBtn: { minHeight: 56, borderRadius: radius.lg, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  videoIconBg: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  videoTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  videoSub: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
});
