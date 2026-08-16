import { ToastService } from "../components/Toast";
import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import {
    savePrescribedWorkout,
    CoachTemplate,
    subscribeToCoachTemplates,
    WorkoutSetType
} from "../services/userSession";
import { ExerciseLibraryItem, t as tEx } from "../constants/exercises";
import { useExerciseSearch } from "./useExerciseSearch";
import { parseScheduleDateInput } from "../features/plans/scheduleInput";
import { saveAdjustment } from "../services/planRevisionService";
import type { PlanRevisionContext } from "../navigation/types";

export type PrescribedExerciseInput = {
    name: string;
    type: WorkoutSetType;
    targetSets: number;
    targetReps: string;
    restTime: string;
};

/**
 * @param revision Present only when the coach arrived through Adjust plan.
 *   When set, the schedule date is fixed to the day being replaced and the save
 *   writes the prescription and its revision record in one batch. When absent
 *   this hook behaves exactly as it did before — ordinary prescribing is
 *   untouched, including undated standing plans.
 */
export function useWorkoutPrescriptionBuilder(
    traineeId: string,
    navigation: any,
    revision?: PlanRevisionContext | null,
    initialDateKey?: string | null,
) {
    const [title, setTitle] = useState("");
    /*
     * Blank = unscheduled, which is the pre-Phase-D behaviour and stays valid.
     * An adjustment seeds it with the day being replaced and locks it: the
     * revision record and the prescription must name the same day, and a
     * free-text field the coach could edit is exactly how they diverge.
     */
    const [scheduledDate, setScheduledDate] = useState(
        revision?.effectiveFromDateKey ?? initialDateKey ?? ""
    );
    const isAdjustment = Boolean(revision);
    const [exercises, setExercises] = useState<PrescribedExerciseInput[]>([
        { name: "", type: "WEIGHT_REPS", targetSets: 4, targetReps: "10-12", restTime: "60s" }
    ]);
    const [templates, setTemplates] = useState<CoachTemplate[]>([]);
    const [libModalVisible, setLibModalVisible] = useState(false);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [libSearchQuery, setLibSearchQuery] = useState("");

    // EXERCISE LIBRARY STATES
    const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
    const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null);
    const [selectedExerciseInfo, setSelectedExerciseInfo] = useState<ExerciseLibraryItem | null>(null);
    const {
        query: exerciseSearchQuery,
        setQuery: setExerciseSearchQuery,
        isSearching,
        filteredExercises,
        findExerciseInfo,
    } = useExerciseSearch({ includeEquipment: true });

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(libSearchQuery.toLowerCase())
    );

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const unsubscribe = subscribeToCoachTemplates(user.uid, "workout", (data) => {
            setTemplates(data);
        });
        return () => unsubscribe();
    }, []);

    const applyTemplate = (t: CoachTemplate) => {
        setTitle(t.title);
        if (t.data.exercises) {
            setExercises(t.data.exercises);
        }
        setLibModalVisible(false);
    };

    const applyExerciseSelection = (exercise: ExerciseLibraryItem) => {
        const targetReps = exercise.defaultType === "TIME" ? "60" : "10-12";
        const next = {
            name: tEx(exercise.name),
            type: exercise.defaultType,
            targetSets: 4,
            targetReps: targetReps,
            restTime: "60s",
        };

        if (activeExerciseIndex === null) {
            setExercises((prev) => [...prev, next]);
            return;
        }

        const updated = [...exercises];
        updated[activeExerciseIndex] = { ...updated[activeExerciseIndex], ...next };
        setExercises(updated);
    };

    const addCustomExercise = (name: string) => {
        const customName = name.trim() || "Custom Exercise";
        const next = {
            name: customName,
            type: "WEIGHT_REPS" as WorkoutSetType,
            targetSets: 4,
            targetReps: "10-12",
            restTime: "60s",
        };

        if (activeExerciseIndex === null) {
            setExercises((prev) => [...prev, next]);
            return;
        }

        const updated = [...exercises];
        updated[activeExerciseIndex] = { ...updated[activeExerciseIndex], ...next };
        setExercises(updated);
    };

    const addExercise = () => {
        setExercises([...exercises, { name: "", type: "WEIGHT_REPS", targetSets: 4, targetReps: "10-12", restTime: "60s" }]);
    };

    const updateExercise = (index: number, field: string, value: any) => {
        const newEx = [...exercises];
        newEx[index] = { ...newEx[index], [field]: value };
        setExercises(newEx);
    };

    const removeExercise = (index: number) => {
        const newEx = exercises.filter((_, i) => i !== index);
        setExercises(newEx.length ? newEx : [{ name: "", type: "WEIGHT_REPS", targetSets: 4, targetReps: "10-12", restTime: "60s" }]);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            ToastService.error("Missing Title", "Please give this workout a name (e.g., Upper Body A)");
            return;
        }
        if (exercises.some(e => !e.name.trim())) {
            ToastService.error("Missing Exercise", "Please fill in all exercise names.");
            return;
        }

        // A blank date is valid and means unscheduled — the pre-Phase-D
        // behaviour. Only a malformed date is rejected, and it is rejected
        // BEFORE any write so a bad value never reaches Firestore.
        const schedule = parseScheduleDateInput(scheduledDate);
        if (!schedule.ok) {
            ToastService.error("Check the date", schedule.message);
            return;
        }

        /*
         * An adjustment must carry every field its revision record needs. A
         * half-populated route parameter is how a revision ends up pointing at
         * nothing, so it is refused here rather than written incomplete.
         */
        if (revision && (!revision.effectiveFromDateKey || !revision.reason.trim())) {
            ToastService.error("Missing adjustment details", "Start again from Adjust plan.");
            return;
        }

        try {
            setIsSubmitting(true);
            const user = auth.currentUser;
            if (!user) throw new Error("No coach session");

            const workoutDoc = {
                coachId: user.uid,
                coachName: user.displayName || "Your Coach",
                title: title.trim(),
                exercises: exercises,
                isCompleted: false
            };

            if (revision) {
                // One batch: the prescription and the revision that points at
                // it. Neither can exist without the other.
                await saveAdjustment(
                    {
                        traineeId,
                        kind: "workout",
                        effectiveFromDateKey: revision.effectiveFromDateKey,
                        reason: revision.reason,
                        summary: revision.summary,
                        traineeTimezone: revision.traineeTimezone,
                    },
                    { kind: "workout", workout: workoutDoc },
                );
            } else {
                await savePrescribedWorkout(traineeId, workoutDoc, schedule.scheduledDateKey);
            }

            if (saveAsTemplate && !revision) {
                const { saveCoachTemplate } = require("../services/userSession");
                await saveCoachTemplate(user.uid, {
                    title: title.trim(),
                    type: "workout",
                    data: { exercises }
                });
            }

            if (revision) {
                ToastService.success(
                    "Adjustment saved",
                    `Scheduled for ${revision.effectiveFromDateKey}. That day only — every other day is unchanged.`,
                );
            } else {
                ToastService.success("Workout assigned", schedule.scheduledDateKey
                    ? `Scheduled for ${schedule.scheduledDateKey}. It will appear on your client's plan for that day.`
                    : "Unscheduled — your client will see this as their next coach workout.");
            }
            if (revision) navigation.pop(2);
            else navigation.goBack();
        } catch (error) {
            console.error(error);
            ToastService.error(
                "Error",
                error instanceof Error ? error.message : "Failed to assign workout.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        title,
        setTitle,
        scheduledDate,
        setScheduledDate,
        isAdjustment,
        revision: revision ?? null,
        exercises,
        templates,
        libModalVisible,
        setLibModalVisible,
        saveAsTemplate,
        setSaveAsTemplate,
        isSubmitting,
        libSearchQuery,
        setLibSearchQuery,
        filteredTemplates,
        exerciseModalVisible,
        setExerciseModalVisible,
        exerciseSearchQuery,
        setExerciseSearchQuery,
        activeExerciseIndex,
        setActiveExerciseIndex,
        selectedExerciseInfo,
        setSelectedExerciseInfo,
        isSearching,
        filteredExercises,
        applyTemplate,
        findExerciseInfo,
        applyExerciseSelection,
        addCustomExercise,
        addExercise,
        updateExercise,
        removeExercise,
        handleSave
    };
}
