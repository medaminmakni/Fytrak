import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, ActivityIndicator, Pressable, TextInput } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth } from "../../config/firebase";
import { useTraineeDetailData } from "../../hooks/useTraineeDetailData";
import { getClientTodayDateKey, toLocalDateKey } from "../../utils/dateKeys";
import { VisualCheckInCard } from "../../features/coaching/components/VisualCheckInCard";
import { NutritionIntelligenceCard } from "../../features/coaching/components/NutritionIntelligenceCard";
import { TrainingIntelligenceCard } from "../../features/coaching/components/TrainingIntelligenceCard";
import { BioMarkersCard } from "../../features/coaching/components/BioMarkersCard";
import { Typography } from "../../components/Typography";
import { Surface } from "../../components/Surface";
import { describePlanSource, resolvePlanDimension } from "../../features/plans/planResolution";
import {
    toMealCandidates,
    toScheduledPrograms,
    toWorkoutCandidates,
    type ScheduledPrescribedWorkout,
} from "../../features/plans/planAdapters";
import type { ProgramSession } from "../../services/programService";
import { ToastService } from "../../components/Toast";
import {
    markDailyReportReviewed,
    subscribeToDailyReport,
    type DailyReport,
} from "../../services/dailyReportService";
import { toSafeDate } from "../../utils/chartFilters";
import {
    createCheckInTask,
    saveCoachNote,
    subscribeToCoachNotes,
    subscribeToOpenCheckInTasks,
    updateCheckInTaskStatus,
    subscribeToUserProfile,
    type CheckInTask,
    type CoachNote,
} from "../../services/userSession";

export function TraineeDetailScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const traineeId = route.params?.traineeId || "";
    const traineeName = route.params?.traineeName || "Trainee";
    const routeTimezone = route.params?.traineeTimezone ?? null;
    const [traineeTimezone, setTraineeTimezone] = useState<string | null>(routeTimezone);

    useEffect(() => {
        if (!traineeId || routeTimezone) return;
        return subscribeToUserProfile(traineeId, (profile) => {
            setTraineeTimezone(profile.timezone ?? null);
        });
    }, [routeTimezone, traineeId]);

    // The day being reviewed. Defaults to today but the coach can step back
    // through the week — "what did they do along the journey" is unanswerable
    // if the report can only ever show the current day.
    const todayKey = traineeTimezone ? getClientTodayDateKey(traineeTimezone) : "";
    const [selectedDate, setSelectedDate] = useState<string>(todayKey);

    useEffect(() => {
        if (todayKey && !selectedDate) setSelectedDate(todayKey);
    }, [selectedDate, todayKey]);

    const {
        meals,
        workouts,
        waterMl,
        metricForDate,
        totals,
        traineeProfile,
        prescribedWorkouts,
        prescribedMeals,
        programs,
        trend,
        status,
        errors,
        isLoading,
    } = useTraineeDetailData(traineeId, selectedDate);

    const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
    const [checkInTasks, setCheckInTasks] = useState<CheckInTask[]>([]);
    const [noteDraft, setNoteDraft] = useState("");
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskDueDate, setTaskDueDate] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isSavingTask, setIsSavingTask] = useState(false);

    // Review state for the selected day. `null` means no report exists, which
    // is a real answer ("nothing was logged"), distinct from `reportError`
    // ("we could not find out").
    const [report, setReport] = useState<DailyReport | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);

    useEffect(() => {
        if (!traineeId || !selectedDate) return;
        setReport(null);
        setReportError(null);
        return subscribeToDailyReport(
            traineeId,
            selectedDate,
            setReport,
            () => setReportError("Could not load the review status for this day.")
        );
    }, [traineeId, selectedDate]);

    const handleMarkReviewed = async () => {
        if (!report || isReviewing) return;
        try {
            setIsReviewing(true);
            setReportError(null);
            const { alreadyReviewed } = await markDailyReportReviewed(traineeId, selectedDate);
            ToastService.success(
                "Marked reviewed",
                alreadyReviewed ? "This day was already reviewed." : "This day is off your queue."
            );
        } catch (error) {
            console.error("Failed to mark report reviewed:", error);
            setReportError("Could not mark this day reviewed.");
            ToastService.error("Review failed", "Could not mark this day reviewed. Tap to retry.");
        } finally {
            setIsReviewing(false);
        }
    };

    useEffect(() => {
        if (!traineeId) return;
        const unsubNotes = subscribeToCoachNotes(traineeId, setCoachNotes);
        const unsubTasks = subscribeToOpenCheckInTasks(traineeId, setCheckInTasks);

        return () => {
            unsubNotes();
            unsubTasks();
        };
    }, [traineeId]);

    const isToday = selectedDate === todayKey;

    const dayLabel = useMemo(() => {
        if (isToday) return "today";
        // Parse as local noon so the label cannot slip a day via UTC parsing.
        const parsed = new Date(`${selectedDate}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) return selectedDate;
        return parsed.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }, [selectedDate, isToday]);

    const failedSections = useMemo(
        () =>
            (Object.keys(errors) as (keyof typeof errors)[])
                .filter((key) => !!errors[key])
                .map((key) => String(key)),
        [errors]
    );

    const stepDay = (deltaDays: number) => {
        const parsed = new Date(`${selectedDate}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) return;
        parsed.setDate(parsed.getDate() + deltaDays);
        const next = toLocalDateKey(parsed);
        // Never navigate into the future — there is nothing to report on.
        if (next > todayKey) return;
        setSelectedDate(next);
    };

    // A coach must never be shown invented numbers as if they were the client's
    // plan. When the trainee has no macroTargets yet, `hasTargets` is false and
    // the nutrition card renders a "no plan set" state instead of a fake 2100
    // kcal target. Zeros are only a render-safe placeholder for the rings.
    /*
     * PLANNED vs ACTUAL, resolved for the selected client-local date.
     *
     * Workout and nutrition resolve INDEPENDENTLY, so a daily workout override
     * can sit alongside program nutrition and neither hides the other.
     *
     * Facts only. Fytrak states what was planned and what was logged; it does
     * not score the difference, call it compliance, or recommend anything. The
     * coach interprets and reacts through a plan change or a message.
     */
    // The payload type is an explicit union: a daily prescription and a program
    // session are different shapes, and the resolved source tells the UI which
    // one it is holding.
    const plannedWorkout = useMemo(() => resolvePlanDimension<
        ScheduledPrescribedWorkout | ProgramSession,
        ProgramSession
    >({
        dateKey: selectedDate,
        dailyCandidates: toWorkoutCandidates(prescribedWorkouts),
        programs: toScheduledPrograms(programs),
        toProgramPayload: (session) => session.payload,
    }), [selectedDate, prescribedWorkouts, programs]);

    const plannedNutrition = useMemo(() => resolvePlanDimension({
        dateKey: selectedDate,
        dailyCandidates: toMealCandidates(prescribedMeals),
        // Programs carry training sessions, not macros, so nutrition has no
        // program fallback. It resolves to "none" rather than borrowing the
        // workout's source.
    }), [selectedDate, prescribedMeals]);

    const hasTargets = Boolean(traineeProfile?.macroTargets);
    const targets = traineeProfile?.macroTargets ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };

    const formatTimestamp = (value?: unknown) => {
        if (!value) return "";
        const date = toSafeDate(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const formatDueDate = (value?: string | null) => {
        if (!value) return "";
        const date = toSafeDate(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    const timelineItems = useMemo(() => {
        const items = [
            ...coachNotes.map((note) => ({
                id: `note-${note.id}`,
                type: "note" as const,
                title: note.text,
                subtitle: "Coach note",
                createdAt: note.createdAt ?? note.updatedAt,
            })),
            ...checkInTasks.map((task) => ({
                id: `task-${task.id}`,
                type: "task" as const,
                title: task.title,
                subtitle: task.dueDate ? `Due ${formatDueDate(task.dueDate)}` : "Check-in task",
                createdAt: task.createdAt ?? task.updatedAt,
            })),
        ];

        return items
            .filter((item) => !!item.createdAt)
            .sort((a, b) => toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime())
            .slice(0, 8);
    }, [coachNotes, checkInTasks]);

    const handleSaveNote = async () => {
        if (!noteDraft.trim()) {
            ToastService.info("Missing note", "Add a quick update before saving.");
            return;
        }
        try {
            setIsSavingNote(true);
            await saveCoachNote({ traineeId, text: noteDraft });
            setNoteDraft("");
            ToastService.success("Note saved", "Coach note added.");
        } catch (error) {
            console.error("Failed to save note:", error);
            ToastService.error("Save failed", "Could not save the coach note.");
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleCreateTask = async () => {
        if (!taskTitle.trim()) {
            ToastService.info("Missing title", "Name the task before creating it.");
            return;
        }
        try {
            setIsSavingTask(true);
            await createCheckInTask({
                traineeId,
                title: taskTitle,
                description: taskDescription,
                dueDate: taskDueDate.trim() || undefined,
            });
            setTaskTitle("");
            setTaskDescription("");
            setTaskDueDate("");
            ToastService.success("Task created", "Check-in task assigned.");
        } catch (error) {
            console.error("Failed to create task:", error);
            ToastService.error("Create failed", "Could not create the check-in task.");
        } finally {
            setIsSavingTask(false);
        }
    };

    const handleTaskUpdate = async (taskId: string, status: "completed" | "dismissed") => {
        try {
            await updateCheckInTaskStatus(traineeId, taskId, status);
            ToastService.success(
                status === "completed" ? "Task completed" : "Task dismissed",
                status === "completed" ? "Marked as done." : "Task removed from open list."
            );
        } catch (error) {
            console.error("Failed to update task:", error);
            ToastService.error("Update failed", "Could not update the task status.");
        }
    };

    if (!selectedDate) {
        return (
            <ScreenShell title={traineeName} subtitle="Daily coaching report">
                <View style={{ padding: spacing.lg }}>
                    <Typography variant="h2">Client date unavailable</Typography>
                    <Typography variant="body" color={colors.textSecondary}>
                        This client has not captured a timezone yet. Their activity remains unchanged; ask them to open Fytrak once, then retry.
                    </Typography>
                </View>
            </ScreenShell>
        );
    }

    return (
        <ScreenShell
            title={traineeName?.toUpperCase() || "TRAINEE"}
            subtitle={`DAILY REPORT • ${isToday ? "TODAY" : dayLabel.toUpperCase()}`}
            contentStyle={styles.shellContent}
            rightActionIcon="chatbubbles-outline"
            onRightAction={() => navigation.navigate("CoachChat", { traineeId, traineeName, coachId: auth.currentUser?.uid || "unknown" })}
        >
            {isLoading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                    {/* DAY SELECTOR */}
                    <View style={styles.dayBar}>
                        <Pressable
                            style={styles.dayNavBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Previous day"
                            onPress={() => stepDay(-1)}
                        >
                            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
                        </Pressable>
                        <View style={styles.dayLabelBox}>
                            <Typography variant="h2" style={styles.dayLabelText}>
                                {isToday ? "Today" : dayLabel}
                            </Typography>
                            <Typography variant="label" color={colors.textFaint}>{selectedDate}</Typography>
                        </View>
                        <Pressable
                            style={[styles.dayNavBtn, isToday && styles.dayNavBtnDisabled]}
                            accessibilityRole="button"
                            accessibilityLabel="Next day"
                            accessibilityState={{ disabled: isToday }}
                            disabled={isToday}
                            onPress={() => stepDay(1)}
                        >
                            <Ionicons name="chevron-forward" size={18} color={isToday ? colors.textDim : colors.textSecondary} />
                        </Pressable>
                    </View>

                    {/*
                      * Review state. Deliberately factual: "reviewed" records
                      * only that the coach looked at this day — it is not a
                      * judgement on how the client performed, and nothing in
                      * the app infers one from it.
                      */}
                    <View style={styles.reviewBar}>
                        <View style={styles.reviewStatusBox}>
                            <Ionicons
                                name={
                                    report?.reviewStatus === "reviewed" ? "checkmark-circle"
                                        : report?.reviewStatus === "pending_review" ? "time-outline"
                                            : "ellipse-outline"
                                }
                                size={16}
                                color={report?.reviewStatus === "reviewed" ? colors.success : colors.textSecondary}
                            />
                            <Typography variant="label" color={colors.textSecondary}>
                                {reportError
                                    ? "Review status unavailable"
                                    : !report
                                        ? "Nothing logged this day"
                                        : report.reviewStatus === "reviewed"
                                            ? `Reviewed${report.reopenCount > 0 ? " · reopened since" : ""}`
                                            : report.reviewStatus === "pending_review"
                                                ? "Pending review"
                                                : "Live — day not finished"}
                            </Typography>
                        </View>

                        {report && report.reviewStatus !== "reviewed" && (
                            <Pressable
                                style={[styles.reviewButton, isReviewing && styles.reviewButtonBusy]}
                                accessibilityRole="button"
                                accessibilityLabel="Mark this day reviewed"
                                accessibilityState={{ disabled: isReviewing, busy: isReviewing }}
                                disabled={isReviewing}
                                onPress={handleMarkReviewed}
                            >
                                {isReviewing ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Typography style={styles.reviewButtonText}>MARK REVIEWED</Typography>
                                )}
                            </Pressable>
                        )}
                    </View>

                    {/*
                      * A failed read must never be presented as "the client did
                      * nothing" — those two states lead a coach to opposite
                      * decisions. Any dimension that errored says so explicitly.
                      */}
                    {failedSections.length > 0 && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                            <Typography variant="label" color={colors.warning} style={styles.errorBannerText}>
                                Could not load: {failedSections.join(", ")}. These sections are unknown, not empty.
                            </Typography>
                        </View>
                    )}

                    {/* ARCHITECT ACTIONS */}
                    <View style={styles.actionRow}>
                        <Pressable 
                            style={[styles.primaryAction, { backgroundColor: colors.primary }]}
                            onPress={() => navigation.navigate("PrescribeWorkout", { traineeId, traineeName })}
                        >
                            <Ionicons name="barbell" size={20} color={colors.primaryText} />
                            <Typography style={styles.actionText}>ROUTINE</Typography>
                        </Pressable>
                        <Pressable 
                            style={[styles.primaryAction, { backgroundColor: colors.success }]}
                            onPress={() => navigation.navigate("PrescribeMeal", { traineeId, traineeName })}
                        >
                            <Ionicons name="nutrition" size={20} color={colors.primaryText} />
                            <Typography style={styles.actionText}>NUTRITION</Typography>
                        </Pressable>
                        <Pressable 
                            style={[styles.primaryAction, { backgroundColor: colors.danger }]}
                            onPress={() => navigation.navigate("CreateProgram" as any, { traineeId, traineeName })}
                        >
                            <Ionicons name="calendar" size={20} color={colors.primaryText} />
                            <Typography style={styles.actionText}>PROGRAM</Typography>
                        </Pressable>
                    </View>

                    {/* PLANNED FOR THIS DAY — stated, never scored. */}
                    <Surface tone="muted" style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Typography variant="h2">Planned for {isToday ? "today" : dayLabel}</Typography>
                        </View>

                        <View style={styles.plannedRow}>
                            <Ionicons name="barbell-outline" size={16} color={colors.textSecondary} />
                            <View style={{ flex: 1 }}>
                                <Typography variant="label" color={colors.textSecondary}>WORKOUT</Typography>
                                {plannedWorkout.sourceType === "none" ? (
                                    <Typography variant="body">No workout plan provided</Typography>
                                ) : (
                                    <>
                                        <Typography variant="body">
                                            {(plannedWorkout.payload as { title?: string })?.title || "Planned session"}
                                        </Typography>
                                        <Typography variant="label" color={colors.textDim}>
                                            {describePlanSource(plannedWorkout)}
                                        </Typography>
                                    </>
                                )}
                            </View>
                        </View>

                        <View style={styles.plannedRow}>
                            <Ionicons name="nutrition-outline" size={16} color={colors.textSecondary} />
                            <View style={{ flex: 1 }}>
                                <Typography variant="label" color={colors.textSecondary}>NUTRITION</Typography>
                                {plannedNutrition.sourceType === "none" ? (
                                    <Typography variant="body">No nutrition plan provided</Typography>
                                ) : (
                                    <>
                                        <Typography variant="body">
                                            {(plannedNutrition.payload as { title?: string })?.title || "Planned nutrition"}
                                        </Typography>
                                        <Typography variant="label" color={colors.textDim}>
                                            {describePlanSource(plannedNutrition)}
                                            {(() => {
                                                const macros = (plannedNutrition.payload as { macros?: { calories?: number; protein?: number } })?.macros;
                                                return macros?.calories
                                                    ? ` · ${macros.calories} kcal, ${macros.protein ?? 0}g protein`
                                                    : "";
                                            })()}
                                        </Typography>
                                    </>
                                )}
                            </View>
                        </View>
                    </Surface>

                    <NutritionIntelligenceCard meals={meals} targets={targets} totals={totals} hasTargets={hasTargets} />
                    <TrainingIntelligenceCard
                        workouts={workouts}
                        hasError={status.workouts === "error"}
                        dayLabel={dayLabel}
                    />
                    {/*
                      * Weight and body fat are shown ONLY if measured on the
                      * selected day. Falling back to the latest-on-record made
                      * a weeks-old measurement look like it belonged to this
                      * day, which is exactly the kind of quiet inaccuracy a
                      * coach would act on.
                      */}
                    <BioMarkersCard weight={metricForDate?.weight} bodyFat={metricForDate?.bodyFat} />
                    {!metricForDate && trend.latestWeight !== undefined && (
                        <Typography variant="label" color={colors.textDim} style={styles.trendHint}>
                            No measurement on {dayLabel}. Last recorded: {trend.latestWeight}kg
                            {trend.latestWeightDate ? ` on ${trend.latestWeightDate}` : ""}.
                        </Typography>
                    )}
                    {/* Photo presence comes from the URL-free daily report. */}
                    <VisualCheckInCard
                        photo={report?.hasPhoto
                            ? { createdAt: report.lastActivityAt, date: selectedDate }
                            : null}
                        dayLabel={isToday ? "today" : dayLabel}
                    />

                    <View style={styles.waterRow}>
                        <Ionicons name="water-outline" size={16} color={colors.info} />
                        <Typography variant="label" color={colors.textDim}>
                            Water: {status.water === "error" ? "unavailable" : `${waterMl} ml`}
                        </Typography>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="clipboard" size={16} color={colors.primary} />
                            <Typography variant="label" color={colors.primary} style={styles.sectionTitle}>ACCOUNTABILITY</Typography>
                        </View>

                        <Surface tone="muted" style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Typography variant="h2">Check-in tasks</Typography>
                                <View style={styles.countPill}>
                                    <Typography style={styles.countText}>{checkInTasks.length} OPEN</Typography>
                                </View>
                            </View>
                            {checkInTasks.length === 0 ? (
                                <Typography variant="label" color={colors.textDim}>No open tasks yet.</Typography>
                            ) : (
                                <View style={styles.taskList}>
                                    {checkInTasks.map((task) => {
                                        const dueLabel = formatDueDate(task.dueDate);
                                        return (
                                            <View key={task.id} style={styles.taskItem}>
                                                <View style={styles.taskInfo}>
                                                    <Typography variant="h2" style={styles.taskTitle}>{task.title}</Typography>
                                                    {!!task.description && (
                                                        <Typography variant="label" color={colors.textFaint} style={styles.taskDesc}>{task.description}</Typography>
                                                    )}
                                                    {!!dueLabel && (
                                                        <Typography variant="label" color={colors.warning} style={styles.taskDue}>Due {dueLabel}</Typography>
                                                    )}
                                                </View>
                                                <View style={styles.taskActions}>
                                                    <Pressable
                                                        style={[styles.taskActionBtn, styles.taskActionComplete]}
                                                        onPress={() => handleTaskUpdate(task.id, "completed")}
                                                    >
                                                        <Ionicons name="checkmark" size={16} color={colors.primaryText} />
                                                    </Pressable>
                                                    <Pressable
                                                        style={[styles.taskActionBtn, styles.taskActionDismiss]}
                                                        onPress={() => handleTaskUpdate(task.id, "dismissed")}
                                                    >
                                                        <Ionicons name="close" size={16} color={colors.textSecondary} />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            <View style={styles.divider} />

                            <Typography variant="label" color={colors.textFaint}>Create new task</Typography>
                            <TextInput
                                placeholder="Task title"
                                placeholderTextColor={colors.textDim}
                                style={styles.input}
                                value={taskTitle}
                                onChangeText={setTaskTitle}
                            />
                            <TextInput
                                placeholder="Description (optional)"
                                placeholderTextColor={colors.textDim}
                                style={[styles.input, styles.inputMultiline]}
                                value={taskDescription}
                                onChangeText={setTaskDescription}
                                multiline
                            />
                            <TextInput
                                placeholder="Due date (YYYY-MM-DD)"
                                placeholderTextColor={colors.textDim}
                                style={styles.input}
                                value={taskDueDate}
                                onChangeText={setTaskDueDate}
                            />
                            <Pressable
                                style={[styles.primaryButton, !taskTitle.trim() && styles.primaryButtonDisabled]}
                                onPress={handleCreateTask}
                                disabled={isSavingTask || !taskTitle.trim()}
                            >
                                <Typography style={styles.primaryButtonText}>{isSavingTask ? "SAVING..." : "CREATE TASK"}</Typography>
                                <Ionicons name="add" size={16} color={colors.primaryText} />
                            </Pressable>
                        </Surface>

                        <Surface tone="muted" style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Typography variant="h2">Coach notes</Typography>
                                <Typography variant="label" color={colors.textFaint}>PRIVATE</Typography>
                            </View>
                            <TextInput
                                placeholder="Add a note about progress, obstacles, or wins"
                                placeholderTextColor={colors.textDim}
                                style={[styles.input, styles.inputMultiline]}
                                value={noteDraft}
                                onChangeText={setNoteDraft}
                                multiline
                            />
                            <Pressable
                                style={[styles.primaryButton, !noteDraft.trim() && styles.primaryButtonDisabled]}
                                onPress={handleSaveNote}
                                disabled={isSavingNote || !noteDraft.trim()}
                            >
                                <Typography style={styles.primaryButtonText}>{isSavingNote ? "SAVING..." : "SAVE NOTE"}</Typography>
                                <Ionicons name="document-text" size={16} color={colors.primaryText} />
                            </Pressable>

                            {coachNotes.length === 0 ? (
                                <Typography variant="label" color={colors.textDim}>No coach notes yet.</Typography>
                            ) : (
                                <View style={styles.noteList}>
                                    {coachNotes.slice(0, 4).map((note) => (
                                        <View key={note.id} style={styles.noteItem}>
                                            <View style={styles.noteDot} />
                                            <View style={styles.noteBody}>
                                                <Typography variant="body" style={styles.noteText}>{note.text}</Typography>
                                                <Typography variant="label" color={colors.textFaint} style={styles.noteMeta}>{formatTimestamp(note.createdAt)}</Typography>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </Surface>

                        <Surface tone="muted" style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Typography variant="h2">Accountability timeline</Typography>
                            </View>
                            {timelineItems.length === 0 ? (
                                <Typography variant="label" color={colors.textDim}>No timeline items yet.</Typography>
                            ) : (
                                <View style={styles.timelineList}>
                                    {timelineItems.map((item) => (
                                        <View key={item.id} style={styles.timelineItem}>
                                            <View style={[styles.timelineDot, item.type === "task" ? styles.timelineDotTask : styles.timelineDotNote]} />
                                            <View style={styles.timelineBody}>
                                                <Typography variant="h2" style={styles.timelineTitle}>{item.title}</Typography>
                                                <Typography variant="label" color={colors.textFaint} style={styles.timelineSubtitle}>{item.subtitle}</Typography>
                                            </View>
                                            <Typography variant="label" color={colors.textFaint} style={styles.timelineTime}>{formatTimestamp(item.createdAt)}</Typography>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </Surface>
                    </View>

                </ScrollView>
            )}

            {/*
              * The full-screen progress-photo viewer was removed with the rest
              * of the coach-side byte-loading path. Progress photos live on a
              * permanent public CDN URL that no rule or assignment change can
              * revoke, so V0 shows the coach metadata only. Restoring a viewer
              * requires private storage and short-lived signed URLs from the
              * custom backend.
              */}
        </ScreenShell>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 100, gap: 24, marginTop: 10 },
    loader: { paddingTop: 40, alignItems: "center" },

    dayBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.xl,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },
    dayNavBtn: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgDark,
    },
    dayNavBtnDisabled: { opacity: 0.4 },
    dayLabelBox: { alignItems: 'center', gap: 2 },
    dayLabelText: { fontSize: 16 },

    reviewBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginTop: -12,
    },
    reviewStatusBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    reviewButton: {
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewButtonBusy: { opacity: 0.7 },
    reviewButtonText: { color: colors.primaryText, fontWeight: '900', fontSize: 11 },
    plannedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },

    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(251, 191, 36, 0.08)',
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.warning,
    },
    errorBannerText: { flex: 1 },

    trendHint: { marginTop: -12, marginStart: 4 },
    waterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginStart: 4 },

    actionRow: { flexDirection: 'row', gap: 10 },
    primaryAction: { flex: 1, height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionText: { color: colors.primaryText, fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },

    section: { gap: spacing.lg },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginStart: 4 },
    sectionTitle: { letterSpacing: 1.4 },

    // Geometry now comes from <Surface tone="muted">; internal layout only.
    card: { gap: spacing.md },
    cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    countPill: { marginStart: "auto", backgroundColor: colors.primaryMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    countText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.md },

    input: { backgroundColor: colors.bgDark, borderRadius: radius.md, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.borderSubtle, fontSize: 13, fontWeight: "600" },
    inputMultiline: { minHeight: 90, textAlignVertical: "top" },
    primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: colors.primaryText, fontWeight: "900", fontSize: 12, letterSpacing: 0.6 },

    taskList: { gap: spacing.md },
    taskItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.bgDark, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle },
    taskInfo: { flex: 1, gap: 4 },
    taskTitle: { fontSize: 14 },
    taskDesc: { fontSize: 11, letterSpacing: 0.6 },
    taskDue: { fontSize: 11, letterSpacing: 0.6 },
    taskActions: { flexDirection: "row", gap: 8 },
    taskActionBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    taskActionComplete: { backgroundColor: colors.primary, borderColor: colors.primary },
    taskActionDismiss: { backgroundColor: "transparent", borderColor: colors.borderStrong },

    noteList: { gap: spacing.md },
    noteItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    noteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
    noteBody: { flex: 1, gap: 4 },
    noteText: { fontSize: 13 },
    noteMeta: { fontSize: 11, letterSpacing: 0.6 },

    timelineList: { gap: spacing.md },
    timelineItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
    timelineDotTask: { backgroundColor: colors.primary },
    timelineDotNote: { backgroundColor: colors.info },
    timelineBody: { flex: 1, gap: 4 },
    timelineTitle: { fontSize: 13 },
    timelineSubtitle: { fontSize: 11, letterSpacing: 0.6 },
    timelineTime: { fontSize: 11, letterSpacing: 0.6 },

});
