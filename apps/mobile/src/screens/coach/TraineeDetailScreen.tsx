import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, ActivityIndicator, Pressable, TextInput } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { DimensionValue } from "../../features/coach/dashboard/components/DimensionValue";
import { colors } from "../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth } from "../../config/firebase";
import { LOAD_TIMEOUT_MS, useTraineeDetailData, type DataStatus } from "../../hooks/useTraineeDetailData";
import { getForeignClientTodayDateKey } from "../../utils/dateKeys";
import { canStepBack, canStepForward, stepClientDay } from "../../features/coaching/dayNavigation";
import { combineDimensionStatus } from "../../features/coaching/dimensionStatus";
import { buildFortnight } from "../../features/coaching/fortnight";
import { buildSessionReview, resolveWorkoutReviewPlan } from "../../features/coaching/sessionReview";
import { SessionReviewCard } from "../../features/coaching/components/SessionReviewCard";
import { FortnightStrip } from "../../features/coach/dashboard/components/FortnightStrip";
import { subscribeToDailyReportRange } from "../../services/dailyReportService";
import { addDaysToDateKey } from "../../utils/dateKeys";
import { isDatedCandidateFor, isProgramCoveringDate } from "../../features/plans/planResolution";
import { isRetryBusy, selectRetryTargets } from "../../features/coaching/retryState";
import { VisualCheckInCard } from "../../features/coaching/components/VisualCheckInCard";
import { NutritionIntelligenceCard } from "../../features/coaching/components/NutritionIntelligenceCard";
import { TrainingIntelligenceCard } from "../../features/coaching/components/TrainingIntelligenceCard";
import { SessionCheckInCard } from "../../features/coaching/components/SessionCheckInCard";
import { ReviewStateBar } from "../../features/coaching/components/ReviewStateBar";
import { BioMarkersCard } from "../../features/coaching/components/BioMarkersCard";
import { Typography } from "../../components/Typography";
import { Surface } from "../../components/Surface";
import { describePlanSource, resolvePlanDimension } from "../../features/plans/planResolution";
import {
    toMealCandidates,
    toActiveScheduledPrograms,
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
    subscribeToPlanRevisions,
    type PlanRevision,
} from "../../services/planRevisionService";
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
        return subscribeToUserProfile(
            traineeId,
            (profile) => setTraineeTimezone(profile.timezone ?? null),
            /*
             * Audited caller. A failure leaves the timezone null, which is
             * already the "Client date unavailable" state — the screen does not
             * hang, and it does not fall back to the coach's date. Stated
             * explicitly rather than relied on implicitly.
             */
            () => setTraineeTimezone(null)
        );
    }, [routeTimezone, traineeId]);

    // The day being reviewed. Defaults to today but the coach can step back
    // through the week — "what did they do along the journey" is unanswerable
    // if the report can only ever show the current day.
    /*
     * The CLIENT's today, never this device's. `getClientTodayDateKey` falls
     * back to the device zone, which on a coach's phone answers "what day is it
     * here" — a coach in London reviewing a client in Auckland would be a full
     * day out on every "today" and every silence count.
     */
    const todayKey = getForeignClientTodayDateKey(traineeTimezone);
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
        retry,
    } = useTraineeDetailData(traineeId, selectedDate);

    const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
    const [planRevisions, setPlanRevisions] = useState<PlanRevision[]>([]);
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
    /*
     * The report is the SEVENTH dimension, and it was the only one without a
     * status of its own.
     *
     * `report === null` was carrying two different meanings at once: "the
     * listener has not answered yet" and "it answered, and no report exists for
     * this day". The photo card reads `report?.hasPhoto`, so both of those — and
     * a failed read — rendered identically as a day with no photo.
     */
    const [reportStatus, setReportStatus] = useState<DataStatus>("loading");

    /*
     * Its own retry token. This listener lives on the screen rather than in
     * `useTraineeDetailData`, so the hook's `retry()` could not reach it: a
     * coach whose report read failed had a Retry button that re-attached the
     * other six listeners and silently left the seventh broken.
     */
    const [reportRetryToken, setReportRetryToken] = useState(0);

    useEffect(() => {
        if (!traineeId || !selectedDate) return;
        setReportStatus("loading");
        setReportError(null);

        /*
         * The same timeout the hook applies to its six listeners. Without it a
         * report listener that never answers — and onSnapshot does not time
         * itself out — left the bar on "Loading review status…" permanently,
         * with no error, no banner and no Retry.
         */
        // A ref rather than reading state inside the timer: calling one setter
        // from inside another's updater double-fires under StrictMode, and an
        // updater is supposed to be pure.
        let settled = false;

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            setReportError("Could not load the review status for this day.");
            setReportStatus("error");
        }, LOAD_TIMEOUT_MS);

        const unsubscribe = subscribeToDailyReport(
            traineeId,
            selectedDate,
            (next) => {
                settled = true;
                clearTimeout(timeout);
                setReport(next);
                setReportStatus("loaded");
            },
            () => {
                settled = true;
                clearTimeout(timeout);
                setReportError("Could not load the review status for this day.");
                setReportStatus("error");
            }
        );

        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, [traineeId, selectedDate, reportRetryToken]);

    /*
     * ONE retry lifecycle over both loading mechanisms.
     *
     * The hook owns six listeners; the report/review listener above is the
     * seventh and lives here. Treating them as one map is what lets the control
     * stay busy for a report-only retry — the hook alone would have called that
     * retry finished the instant it started, since its own six were loaded.
     */
    /*
     * Fourteen days of logged sessions, as ONE bounded read.
     *
     * Keyed on the client's today rather than the selected day, so stepping
     * back through the week does not re-fetch: the strip is a fixed window
     * ending now.
     */
    const [loggedDateKeys, setLoggedDateKeys] = useState<string[]>([]);
    const [fortnightUnreadable, setFortnightUnreadable] = useState(false);

    useEffect(() => {
        if (!traineeId || !todayKey) return;
        setFortnightUnreadable(false);
        return subscribeToDailyReportRange(
            traineeId,
            addDaysToDateKey(todayKey, -13),
            todayKey,
            setLoggedDateKeys,
            () => setFortnightUnreadable(true),
        );
    }, [traineeId, todayKey]);

    /*
     * Planned and program days come from prescriptions and programs the screen
     * has ALREADY loaded, so the strip costs no additional plan reads.
     */
    const fortnight = useMemo(() => {
        if (!todayKey) return [];
        const planned = new Set<string>();
        const program = new Set<string>();
        const workoutCandidates = toWorkoutCandidates(prescribedWorkouts);
        // Per day, so a program that ended mid-fortnight stops contributing
        // on the day it ended rather than across the whole strip.
        const scheduledPrograms = (dateKey: string) => toActiveScheduledPrograms(programs, dateKey);

        for (let offset = 13; offset >= 0; offset -= 1) {
            const dateKey = addDaysToDateKey(todayKey, -offset);
            if (workoutCandidates.some((candidate) => isDatedCandidateFor(candidate, dateKey))) {
                planned.add(dateKey);
            }
            if (scheduledPrograms(dateKey).some((scheduled) => isProgramCoveringDate(scheduled, dateKey))) {
                program.add(dateKey);
            }
        }

        return buildFortnight({
            clientTodayDateKey: todayKey,
            loggedDateKeys: new Set(loggedDateKeys),
            plannedDateKeys: planned,
            programDateKeys: program,
        });
    }, [todayKey, loggedDateKeys, prescribedWorkouts, programs]);

    const combinedStatuses = useMemo(
        () => ({ ...status, report: reportStatus }),
        [status, reportStatus]
    );

    /**
     * The sources this retry is actually re-running, captured at the tap.
     *
     * Recording them matters as much as running them: busy is computed from
     * THESE, so a dimension the coach did not retry cannot hold the button
     * spinning, and a loaded one cannot end the retry early.
     */
    const [retryTargets, setRetryTargets] = useState<string[]>([]);

    const handleRetry = useCallback(() => {
        const targets = selectRetryTargets(combinedStatuses);
        if (targets.length === 0) return;
        setRetryTargets(targets);

        /*
         * Each source is touched only if it is a target.
         *
         * A loaded report is left completely alone — previously any retry
         * re-subscribed it, resetting a good report to `loading` and blanking
         * the review bar and photo card while an unrelated dimension refetched.
         */
        if (targets.some((id) => id !== "report")) retry();
        if (targets.includes("report")) {
            // Set synchronously, in the same batch as the targets, so the next
            // render already sees it loading and the button is never briefly
            // re-enabled between the tap and the effect.
            setReportStatus("loading");
            setReportError(null);
            setReportRetryToken((token) => token + 1);
        }
    }, [combinedStatuses, retry]);

    const isRetrying = isRetryBusy(retryTargets, combinedStatuses);

    // Clears the recorded targets once they have all settled, so a later tap
    // starts a fresh lifecycle rather than inheriting this one.
    useEffect(() => {
        if (retryTargets.length === 0) return;
        if (isRetryBusy(retryTargets, combinedStatuses)) return;
        setRetryTargets([]);
    }, [retryTargets, combinedStatuses]);

    /*
     * §6: only a day that is actually awaiting review can be marked reviewed.
     *
     * ReviewStateBar already offers the action for `pending_review` and
     * `reopened` only, but the handler itself accepted anything with a report
     * attached — so any future caller, or a stale tap landing after the state
     * changed, could close a `live` or `unknown` day. The bar decides what to
     * show; this decides what is permitted.
     */
    const canMarkReviewed =
        report?.reviewStatus === "pending_review" || report?.reviewStatus === "reopened";

    const handleMarkReviewed = async () => {
        if (!report || isReviewing || !canMarkReviewed) return;
        try {
            setIsReviewing(true);
            setReportError(null);
            const { alreadyReviewed, acknowledgedPain } = await markDailyReportReviewed(
                traineeId,
                selectedDate
            );
            /*
             * Acknowledging pain is stated explicitly. It is the only thing on
             * this screen that clears an item from the coach's queue, so it
             * should never happen silently.
             */
            ToastService.success(
                acknowledgedPain ? "Reviewed · pain acknowledged" : "Marked reviewed",
                acknowledgedPain
                    ? "The pain report for this day is off your queue."
                    : alreadyReviewed
                        ? "This day was already reviewed."
                        : "This day is off your queue."
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
        const unsubRevisions = subscribeToPlanRevisions(traineeId, setPlanRevisions);

        return () => {
            unsubNotes();
            unsubTasks();
            unsubRevisions();
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
        () => {
            const failed = (Object.keys(errors) as (keyof typeof errors)[])
                .filter((key) => !!errors[key])
                .map((key) => String(key));
            // The report listener is not in the hook's error map, so a failed
            // review read produced no banner and no Retry at all.
            if (reportError) failed.push("review status");
            return failed;
        },
        [errors, reportError]
    );

    /*
     * Pure date-key arithmetic. This previously built a `Date` from
     * `${selectedDate}T12:00:00`, called `setDate`, and formatted back through
     * `toLocalDateKey` — three device-timezone dependencies in four lines,
     * masked by the noon anchor. `stepClientDay` bounds the step against the
     * CLIENT's today and returns null when there is nowhere to go.
     */
    const stepDay = (deltaDays: number) => {
        const next = stepClientDay(selectedDate, deltaDays, todayKey);
        if (!next) return;
        setSelectedDate(next);
    };

    // Derived from the same function that performs the step, so a control can
    // never be enabled on a day it will refuse to leave.
    const canGoBack = canStepBack(selectedDate, todayKey);
    const canGoForward = canStepForward(selectedDate, todayKey);

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
        programs: toActiveScheduledPrograms(programs, selectedDate),
        toProgramPayload: (session) => session.payload,
    }), [selectedDate, prescribedWorkouts, programs]);

    const plannedNutrition = useMemo(() => resolvePlanDimension({
        dateKey: selectedDate,
        dailyCandidates: toMealCandidates(prescribedMeals),
        // Programs carry training sessions, not macros, so nutrition has no
        // program fallback. It resolves to "none" rather than borrowing the
        // workout's source.
    }), [selectedDate, prescribedMeals]);

      /*
     * Whether the SELECTED day is a programmed rest day.
     *
     * A rest day and a missed day look identical on this screen otherwise:
     * both show no workout, and all four check-in tiles empty. The design is
     * blunt about the cost — a coach reads four blank readiness tiles as
     * neglect. Nothing is missing on a rest day, and the screen has to say so.
     */
    const isRestDay = useMemo(() => {
        if (!selectedDate) return false;
        if (plannedWorkout.sourceType !== "none") return false;
        if (workouts.length > 0) return false;
        return toActiveScheduledPrograms(programs, selectedDate).some(
            (scheduled) => isProgramCoveringDate(scheduled, selectedDate)
        );
    }, [selectedDate, plannedWorkout.sourceType, workouts.length, programs]);

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
            /*
             * Plan changes belong in the same timeline as notes and tasks.
             * To a coach these are one thing — decisions I made about this
             * client — and a revision recorded somewhere the coach never looks
             * is the write-only data this screen was built to fix.
             */
            ...planRevisions.map((revision) => ({
                id: `revision-${revision.id}`,
                type: "revision" as const,
                title: revision.summary || `${revision.kind} plan changed`,
                subtitle: `From ${revision.effectiveFromDateKey} — ${revision.reason}`,
                createdAt: revision.createdAt,
            })),
        ];

        return items
            .filter((item) => !!item.createdAt)
            .sort((a, b) => toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime())
            .slice(0, 8);
    }, [coachNotes, checkInTasks, planRevisions]);

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
            onRightAction={() => {
                const coachId = auth.currentUser?.uid;
                const assignmentId = traineeProfile?.activeAssignmentId;
                if (!coachId || !assignmentId) {
                    ToastService.error("Conversation unavailable", "This client has no active conversation.");
                    return;
                }
                navigation.navigate("CoachTabs", {
                    screen: "CoachInbox",
                    params: {
                        screen: "CoachConversation",
                        params: {
                            traineeId,
                            traineeName,
                            coachId,
                            assignmentId,
                        },
                    },
                });
            }}
        >
            {/*
              * No whole-screen gate.
              *
              * This was `isLoading ? <ActivityIndicator/> : <ScrollView/>`,
              * where `isLoading` is true while ANY of the seven dimensions is
              * still loading. So the entire report — including the six that had
              * already arrived, the date selector and the review bar — was
              * hidden behind one spinner until the slowest listener responded,
              * and a single dimension that timed out held the screen blank for
              * twelve seconds. That defeated the per-dimension status model the
              * hook had been built around.
              *
              * The shell, the date selector and every section now render
              * immediately; each section states its own loading, empty or
              * failed condition inline.
              */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                    {/* DAY SELECTOR */}
                    <View style={styles.dayBar}>
                        <Pressable
                            style={[styles.dayNavBtn, !canGoBack && styles.dayNavBtnDisabled]}
                            accessibilityRole="button"
                            accessibilityLabel="Previous day"
                            accessibilityState={{ disabled: !canGoBack }}
                            disabled={!canGoBack}
                            onPress={() => stepDay(-1)}
                        >
                            <Ionicons name="chevron-back" size={18} color={canGoBack ? colors.textSecondary : colors.textDim} />
                        </Pressable>
                        <View style={styles.dayLabelBox}>
                            <Typography variant="h2" style={styles.dayLabelText}>
                                {isToday ? "Today" : dayLabel}
                            </Typography>
                            <Typography variant="label" color={colors.textFaint}>{selectedDate}</Typography>
                        </View>
                        {/*
                          Disabled from the same predicate that performs the
                          step, rather than from `isToday`. The two agreed only
                          by coincidence: `isToday` compares against the client's
                          today, but the guard inside the old `stepDay` compared
                          a device-derived key, so on a day where those differed
                          the button was enabled and did nothing.
                        */}
                        <Pressable
                            style={[styles.dayNavBtn, !canGoForward && styles.dayNavBtnDisabled]}
                            accessibilityRole="button"
                            accessibilityLabel="Next day"
                            accessibilityState={{ disabled: !canGoForward }}
                            disabled={!canGoForward}
                            onPress={() => stepDay(1)}
                        >
                            <Ionicons name="chevron-forward" size={18} color={canGoForward ? colors.textSecondary : colors.textDim} />
                        </Pressable>
                    </View>

                    {/*
                      * Review state. Deliberately factual: "reviewed" records
                      * only that the coach looked at this day — it is not a
                      * judgement on how the client performed, and nothing in
                      * the app infers one from it.
                      */}
                    <ReviewStateBar
                        status={report?.reviewStatus ?? null}
                        isLoading={reportStatus === "loading"}
                        hasError={Boolean(reportError)}
                        isBusy={isReviewing}
                        onMarkReviewed={handleMarkReviewed}
                    />

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
                            {/*
                              The retry the timeout message has always promised.
                              `errors` has said "Timed out. Pull to retry." since
                              this screen shipped, on a screen with no pull-to-
                              refresh and no retry control of any kind.

                              It re-attaches every listener for this client-day
                              rather than only the failed ones: a partial retry
                              would assemble the report out of two different
                              moments. Already-loaded sections keep their content
                              on screen while it runs.
                            */}
                            <Pressable
                                style={[styles.retryBtn, isRetrying && styles.retryBtnBusy]}
                                accessibilityRole="button"
                                accessibilityLabel="Retry loading this day"
                                accessibilityState={{ disabled: isRetrying, busy: isRetrying }}
                                disabled={isRetrying}
                                onPress={handleRetry}
                            >
                                {isRetrying ? (
                                    <ActivityIndicator size="small" color={colors.warning} />
                                ) : (
                                    <Typography variant="label" color={colors.warning}>Retry</Typography>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {/*
                      These four were yellow, green and red — three accent
                      surfaces on one screen, with colour marking category:
                      nutrition green, programs red. Both rules broken at once,
                      and red on "PROGRAM" read as destructive.

                      All four are now the same neutral surface; the icon and
                      the word carry the category. The single accent on this
                      screen belongs to clearing the review, which is the one
                      thing the coach is here to do.

                      "Adjust" closes the loop: review ends in a conclusion, and
                      until now there was nowhere to put it.
                    */}
                    <View style={styles.actionRow}>
                        <AuthoringAction
                            icon="barbell-outline"
                            label="Workout"
                            onPress={() => navigation.navigate("PrescribeWorkout", {
                                traineeId,
                                traineeName,
                                initialDateKey: selectedDate,
                            })}
                        />
                        <AuthoringAction
                            icon="restaurant-outline"
                            label="Nutrition"
                            onPress={() => navigation.navigate("PrescribeMeal", {
                                traineeId,
                                traineeName,
                                initialDateKey: selectedDate,
                            })}
                        />
                        <AuthoringAction
                            icon="calendar-outline"
                            label="Program"
                            onPress={() => navigation.navigate("CreateProgram" as any, {
                                traineeId,
                                traineeName,
                                initialDateKey: selectedDate,
                            })}
                        />
                        <AuthoringAction
                            icon="git-compare-outline"
                            label="Adjust"
                            onPress={() => navigation.navigate("AdjustPlan" as any, {
                                traineeId,
                                traineeName,
                                traineeTimezone,
                            })}
                        />
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
                                {/*
                                  A failed plan read rendered as "No workout plan
                                  provided" — the resolver returns `sourceType:
                                  "none"` when its inputs are empty, and an
                                  errored subscription leaves them empty. The
                                  coach was told this client had no plan when the
                                  truth was that we could not find out.
                                */}
                                <DimensionValue
                                    status={status.plannedWorkout}
                                    isEmpty={plannedWorkout.sourceType === "none"}
                                    emptyLabel="No workout planned for this day"
                                >
                                    {/* `payload` exists only on the non-"none"
                                        arm of the union, so the narrowing check
                                        stays even though `isEmpty` already
                                        governs whether this renders. */}
                                    {plannedWorkout.sourceType !== "none" ? (
                                        <>
                                            <Typography variant="body">
                                                {(plannedWorkout.payload as { title?: string })?.title || "Planned session"}
                                            </Typography>
                                            <Typography variant="label" color={colors.textDim}>
                                                {describePlanSource(plannedWorkout)}
                                            </Typography>
                                        </>
                                    ) : null}
                                </DimensionValue>
                            </View>
                        </View>

                        <View style={styles.plannedRow}>
                            <Ionicons name="nutrition-outline" size={16} color={colors.textSecondary} />
                            <View style={{ flex: 1 }}>
                                <Typography variant="label" color={colors.textSecondary}>NUTRITION</Typography>
                                {/*
                                  Now loads and fails independently of the
                                  workout plan. Nutrition has no program
                                  fallback, so it was the third of three
                                  subscriptions feeding one combined `plans`
                                  status: a failed MEAL plan read marked the
                                  workout plan unavailable too, and a slow
                                  programs query held this section blank long
                                  after its own data had arrived.
                                */}
                                <DimensionValue
                                    status={status.plannedNutrition}
                                    isEmpty={plannedNutrition.sourceType === "none"}
                                    emptyLabel="No nutrition plan for this day"
                                >
                                    {plannedNutrition.sourceType !== "none" ? (
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
                                    ) : null}
                                </DimensionValue>
                            </View>
                        </View>
                    </Surface>

                    {/*
                      MEALS ACTUALS. `totals` is a reduce over `meals`, so a
                      failed meals read produced 0 kcal / 0g of everything and
                      drew it in the rings as a real, precise day of eating
                      nothing. The card only renders once the read has
                      succeeded; failure and loading say so instead.

                      This card needs TWO reads: the bars come from `meals`, but
                      whether to draw targets at all comes from the trainee's
                      `profile`. Gating on `meals` alone meant that while the
                      profile was still in flight — or after it failed —
                      `hasTargets` was false and the card stated "no plan set",
                      a claim about the client's coaching setup made before the
                      document that answers it had arrived.
                    */}
                    <DimensionValue
                        status={combineDimensionStatus([status.meals, status.profile])}
                        isEmpty={meals.length === 0}
                        emptyLabel="No meals logged this day"
                    >
                        <NutritionIntelligenceCard
                            meals={meals}
                            targets={targets}
                            totals={totals}
                            hasTargets={hasTargets}
                        />
                    </DimensionValue>
                    {/*
                      The card owns all four workout states now. It previously
                      received only `hasError`, so during loading it fell
                      through to its own "No workout logged" branch.
                    */}
                    <TrainingIntelligenceCard
                        workouts={workouts}
                        status={status.workouts}
                        dayLabel={dayLabel}
                    />
                    {/*
                      THE FORTNIGHT. Shape, not a score — three misses in a row
                      or every Saturday blank is something a coach can act on,
                      and an adherence percentage averages exactly that away.
                    */}
                    <Surface tone="muted" style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Typography variant="h2">Last 14 days</Typography>
                        </View>
                        <FortnightStrip
                            days={fortnight}
                            emptyReason={
                                fortnightUnreadable
                                    ? "Unavailable — could not load the last 14 days."
                                    : "This client has no timezone yet, so their days cannot be placed."
                            }
                        />
                    </Surface>

                    {/*
                      REST DAY ≠ MISSED SESSION.
                      Without this, a coach sees no workout and four empty
                      check-in tiles and reads neglect. The check-in is only
                      asked AFTER a session, so on a rest day nothing is
                      missing — and silence has to say so out loud.
                    */}
                    {isRestDay ? (
                        <Surface tone="muted" style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="moon-outline" size={iconSize.md} color={colors.textSecondary} />
                                <Typography variant="h2">Rest day</Typography>
                            </View>
                            <Typography variant="label" color={colors.textSecondary}>
                                No check-in on rest days. Sleep, energy, mood and soreness are only
                                asked after a session — nothing is missing here.
                            </Typography>
                        </Surface>
                    ) : null}

                    {/*
                      PLANNED AGAINST PERFORMED, per session.
                      Summary depth — where the plan and the day diverged —
                      rather than a set-by-set dump that buries it.
                    */}
                    {status.workouts === "loaded"
                        ? workouts.map((workout, index) => {
                            const reviewPlan = resolveWorkoutReviewPlan(
                                workout,
                                programs,
                                selectedDate,
                                plannedWorkout.sourceType === "program"
                                    ? {
                                        programId: plannedWorkout.sourceId,
                                        sessionId: (plannedWorkout.payload as { id?: string })?.id,
                                    }
                                    : null,
                            );
                            return (
                                <SessionReviewCard
                                    key={`review-${workout.id}`}
                                    sourceLabel={reviewPlan.sourceLabel}
                                    sessionLabel={
                                        workouts.length > 1
                                            ? `Session ${index + 1} of ${workouts.length}`
                                            : undefined
                                    }
                                    review={buildSessionReview(
                                        workout.exercises ?? [],
                                        reviewPlan.plannedExercises,
                                    )}
                                />
                            );
                        })
                        : null}

                    {/*
                      Check-in cards, one per session, each still attached to
                      its own workout. They sit directly under the training
                      card: a check-in is the difference between a client who
                      missed a session because work ran late and one whose
                      shoulder is going.

                      This was wrapped in its own DimensionValue carrying
                      `emptyLabel="No workout logged this day"`, which printed a
                      SECOND identical empty message immediately beneath the
                      TrainingIntelligenceCard's. The card is the single owner of
                      that sentence. This block renders only once the workouts
                      read has actually succeeded, so a loading or failed read
                      shows neither check-ins nor a misleading absence.

                      The session label appears only when there is more than
                      one, so a normal day is not cluttered by "Session 1 of 1".
                    */}
                    {status.workouts === "loaded"
                        ? workouts.map((workout, index) => (
                            <SessionCheckInCard
                                key={workout.id}
                                checkIn={workout.checkIn}
                                sessionLabel={
                                    workouts.length > 1
                                        ? `Session ${index + 1} of ${workouts.length}`
                                        : undefined
                                }
                            />
                        ))
                        : null}
                    {/*
                      * Weight and body fat are shown ONLY if measured on the
                      * selected day. Falling back to the latest-on-record made
                      * a weeks-old measurement look like it belonged to this
                      * day, which is exactly the kind of quiet inaccuracy a
                      * coach would act on.
                      */}
                    {/*
                      A failed metrics read left `metricForDate` undefined,
                      which BioMarkersCard draws as blank measurements — the
                      same thing it draws for a day the client genuinely did not
                      weigh in. The trend hint below then confidently said "No
                      measurement on Tuesday", which we did not know.
                    */}
                    <DimensionValue
                        status={status.metrics}
                        isEmpty={!metricForDate}
                        emptyLabel="No measurement logged this day"
                    >
                        <BioMarkersCard weight={metricForDate?.weight} bodyFat={metricForDate?.bodyFat} />
                    </DimensionValue>
                    {status.metrics === "loaded" && !metricForDate && trend.latestWeight !== undefined && (
                        <Typography variant="label" color={colors.textDim} style={styles.trendHint}>
                            No measurement on {dayLabel}. Last recorded: {trend.latestWeight}kg
                            {trend.latestWeightDate ? ` on ${trend.latestWeightDate}` : ""}.
                        </Typography>
                    )}
                    {/* Photo presence comes from the URL-free daily report. */}
                    {/*
                      `isEmpty` is deliberately false: VisualCheckInCard already
                      renders its own "no photo" state, and §5 says that
                      behaviour is done. DimensionValue is here only to stop a
                      LOADING or FAILED report read from reaching that card,
                      where `report?.hasPhoto` would be falsy and draw the same
                      absence as a day the client genuinely posted nothing.
                    */}
                    <DimensionValue status={reportStatus} isEmpty={false}>
                        <VisualCheckInCard
                            photo={report?.hasPhoto
                                ? { createdAt: report.lastActivityAt, date: selectedDate }
                                : null}
                            dayLabel={isToday ? "today" : dayLabel}
                        />
                    </DimensionValue>

                    {/*
                      Water was the one dimension already distinguishing a
                      failed read — as the bare word "unavailable", which reads
                      as "the client drank nothing recordable". Every dimension
                      now says which of the three things happened, in the same
                      words and the same colours.
                    */}
                    <View style={styles.waterRow}>
                        <Ionicons name="water-outline" size={iconSize.sm} color={colors.info} />
                        <DimensionValue
                            status={status.water}
                            isEmpty={!waterMl}
                            emptyLabel="No water logged this day"
                        >
                            <Typography variant="label" color={colors.textSecondary}>
                                Water: {waterMl} ml
                            </Typography>
                        </DimensionValue>
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
                                            <View style={[
                                                styles.timelineDot,
                                                item.type === "task"
                                                    ? styles.timelineDotTask
                                                    : item.type === "revision"
                                                        ? styles.timelineDotRevision
                                                        : styles.timelineDotNote,
                                            ]} />
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

/** A neutral authoring entry. Category comes from the icon, never the colour. */
function AuthoringAction({
    icon,
    label,
    onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            style={styles.authoringAction}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name={icon} size={iconSize.md} color={colors.textSecondary} />
            <Typography style={styles.authoringLabel} numberOfLines={1}>{label}</Typography>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    scroll: { paddingBottom: 100, gap: 24, marginTop: 10 },

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

    // reviewBar / reviewStatusBox / reviewButton* moved into ReviewStateBar,
    // which owns all four states and the single action each one implies.
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
    retryBtn: {
        minHeight: touchTarget.min,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radius.nested,
        borderWidth: 1,
        borderColor: colors.warning,
    },
    retryBtnBusy: {
        opacity: 0.6,
    },
    errorBannerText: { flex: 1 },

    trendHint: { marginTop: -12, marginStart: 4 },
    waterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginStart: 4 },

    actionRow: { flexDirection: 'row', gap: spacing.sm },
    authoringAction: {
        flex: 1,
        minWidth: 0,
        minHeight: touchTarget.large,
        borderRadius: radius.nested,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
    },
    authoringLabel: { ...typography.label, color: colors.textSecondary },

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
    /*
     * Neutral, not accent. These are section commits — "save this note" — and
     * the one accent on this screen belongs to clearing the review. Four yellow
     * surfaces competing meant none of them read as the next action.
     */
    primaryButton: { backgroundColor: colors.surfaceInset, borderRadius: radius.nested, minHeight: touchTarget.large, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
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
    taskActionComplete: { backgroundColor: colors.surfaceInset, borderColor: colors.surfaceInset },
    taskActionDismiss: { backgroundColor: "transparent", borderColor: colors.borderStrong },

    noteList: { gap: spacing.md },
    noteItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    // Was yellow for notes and yellow for tasks — colour marking a category,
    // and two more accents on a screen that should have one.
    noteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary, marginTop: 6 },
    noteBody: { flex: 1, gap: 4 },
    noteText: { fontSize: 13 },
    noteMeta: { fontSize: 11, letterSpacing: 0.6 },

    timelineList: { gap: spacing.md },
    timelineItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
    timelineDotTask: { backgroundColor: colors.textTertiary },
    timelineDotNote: { backgroundColor: colors.info },
    // A plan change is a decision, not a status. Neutral, like the note dot —
    // the subtitle ("From 2025-08-05 — he missed Saturday...") carries it.
    timelineDotRevision: { backgroundColor: colors.textSecondary },
    timelineBody: { flex: 1, gap: 4 },
    timelineTitle: { fontSize: 13 },
    timelineSubtitle: { fontSize: 11, letterSpacing: 0.6 },
    timelineTime: { fontSize: 11, letterSpacing: 0.6 },

});
