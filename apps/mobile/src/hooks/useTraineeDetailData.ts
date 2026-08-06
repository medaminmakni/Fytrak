import { useState, useEffect, useMemo, useRef } from "react";
import {
    subscribeToDailyMeals,
    subscribeToDailyWorkouts,
    subscribeToLatestMetrics,
    subscribeToUserProfile,
    subscribeToPrescriptionHistory,
    subscribeToPrescribedMealHistory,
    subscribeToTraineePrograms,
    type Meal,
    type WorkoutLog,
    type BodyMetric,
    type UserProfile
} from "../services/userSession";
import { subscribeToDailyWater } from "../services/waterService";
import type {
    ScheduledPrescribedMeal,
    ScheduledPrescribedWorkout,
    ScheduledProgramDoc,
} from "../features/plans/planAdapters";

/**
 * Per-dimension load state.
 *
 * A coaching report must never present "we could not read this" as "the client
 * did nothing" — those lead to opposite decisions. Every dimension therefore
 * carries its own status instead of collapsing into one screen-level spinner.
 */
export type DataStatus = "loading" | "loaded" | "error";

export type TraineeDetailDimension =
    | "meals"
    | "workouts"
    | "water"
    | "metrics"
    | "profile"
    | "plans";

type StatusMap = Record<TraineeDetailDimension, DataStatus>;

const ALL_DIMENSIONS: TraineeDetailDimension[] = [
    "meals",
    "workouts",
    "water",
    "metrics",
    "profile",
    "plans",
];

const initialStatus = (): StatusMap => ({
    meals: "loading",
    workouts: "loading",
    water: "loading",
    metrics: "loading",
    profile: "loading",
    plans: "loading",
});

/** A listener that never responds is a failure, not an eternal spinner. */
const LOAD_TIMEOUT_MS = 12000;

/**
 * Loads one client's activity for one specific day.
 *
 * `dateKey` ('YYYY-MM-DD') is required and drives every query. It is the
 * client's local day, not the coach's — the two can differ by a calendar date
 * around midnight or whenever they are in different timezones, and attributing
 * a workout to the wrong day silently corrupts any adherence judgement built
 * on top of it.
 */
export function useTraineeDetailData(traineeId: string, dateKey: string) {
    const [meals, setMeals] = useState<Meal[]>([]);
    const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
    const [waterMl, setWaterMl] = useState(0);
    const [recentMetrics, setRecentMetrics] = useState<BodyMetric[]>([]);
    const [traineeProfile, setTraineeProfile] = useState<UserProfile | null>(null);
    const [prescribedWorkouts, setPrescribedWorkouts] = useState<ScheduledPrescribedWorkout[]>([]);
    const [prescribedMeals, setPrescribedMeals] = useState<ScheduledPrescribedMeal[]>([]);
    const [programs, setPrograms] = useState<ScheduledProgramDoc[]>([]);

    const [status, setStatus] = useState<StatusMap>(initialStatus);
    const [errors, setErrors] = useState<Partial<Record<TraineeDetailDimension, string>>>({});

    // Avoids re-creating the status setters on every render.
    const markRef = useRef<{
        loaded: (d: TraineeDetailDimension) => void;
        failed: (d: TraineeDetailDimension, message: string) => void;
    }>({ loaded: () => { }, failed: () => { } });

    markRef.current.loaded = (dimension) => {
        setStatus((prev) => (prev[dimension] === "loaded" ? prev : { ...prev, [dimension]: "loaded" }));
        setErrors((prev) => {
            if (!prev[dimension]) return prev;
            const next = { ...prev };
            delete next[dimension];
            return next;
        });
    };

    markRef.current.failed = (dimension, message) => {
        setStatus((prev) => (prev[dimension] === "error" ? prev : { ...prev, [dimension]: "error" }));
        setErrors((prev) => ({ ...prev, [dimension]: message }));
    };

    useEffect(() => {
        if (!traineeId || !dateKey) {
            setMeals([]);
            setWorkouts([]);
            setWaterMl(0);
            setRecentMetrics([]);
            setTraineeProfile(null);
            setPrescribedWorkouts([]);
            setPrescribedMeals([]);
            setPrograms([]);
            setStatus(initialStatus());
            setErrors({});
            return;
        }

        setStatus(initialStatus());
        setErrors({});

        const loaded = (d: TraineeDetailDimension) => markRef.current.loaded(d);
        const failed = (d: TraineeDetailDimension, e: unknown) =>
            markRef.current.failed(d, e instanceof Error ? e.message : "Could not load this section.");

        const unsubMeals = subscribeToDailyMeals(
            traineeId,
            dateKey,
            (data) => { setMeals(data); loaded("meals"); },
            (error) => failed("meals", error)
        );

        // All workouts for the day. A client can train twice (strength +
        // cardio); showing only the first would understate what they did.
        const unsubWorkouts = subscribeToDailyWorkouts(
            traineeId,
            dateKey,
            (data) => { setWorkouts(data); loaded("workouts"); },
            (error) => failed("workouts", error)
        );

        const unsubWater = subscribeToDailyWater(
            traineeId,
            dateKey,
            (ml) => { setWaterMl(ml); loaded("water"); },
            (error) => failed("water", error)
        );

        // Metrics are fetched as a recent window and narrowed to the selected
        // day below, rather than queried per-date. That keeps them on
        // the existing single-field indexes — a `where(date) + orderBy(createdAt)`
        // query would need two new composite indexes deployed first. The
        // trade-off is that day selection cannot reach further back than this
        // window; revisit if date-range browsing is added.
        const unsubMetrics = subscribeToLatestMetrics(
            traineeId,
            (data) => { setRecentMetrics(data); loaded("metrics"); },
            (error) => failed("metrics", error)
        );

        const unsubProfile = subscribeToUserProfile(traineeId, (data) => {
            setTraineeProfile(data);
            loaded("profile");
        });

        // The PLANNED side of the report. Read-only here — resolution into a
        // specific day happens in the pure resolver, never in this hook.
        const loadedPlanParts = new Set<"workouts" | "meals" | "programs">();
        const planPartLoaded = (part: "workouts" | "meals" | "programs") => {
            loadedPlanParts.add(part);
            if (loadedPlanParts.size === 3) loaded("plans");
        };
        const planFailed = (error: Error) => failed("plans", error);
        const unsubPrescribedWorkouts = subscribeToPrescriptionHistory(
            traineeId,
            (data) => {
                setPrescribedWorkouts(data as ScheduledPrescribedWorkout[]);
                planPartLoaded("workouts");
            },
            planFailed
        );
        const unsubPrescribedMeals = subscribeToPrescribedMealHistory(
            traineeId,
            (data) => {
                setPrescribedMeals(data as ScheduledPrescribedMeal[]);
                planPartLoaded("meals");
            },
            planFailed
        );
        const unsubPrograms = subscribeToTraineePrograms(
            traineeId,
            (data) => {
                setPrograms(data as ScheduledProgramDoc[]);
                planPartLoaded("programs");
            },
            planFailed
        );

        const timeout = setTimeout(() => {
            setStatus((prev) => {
                const next = { ...prev };
                let changed = false;
                ALL_DIMENSIONS.forEach((d) => {
                    if (next[d] === "loading") {
                        next[d] = "error";
                        changed = true;
                    }
                });
                if (!changed) return prev;
                setErrors((prevErrors) => {
                    const nextErrors = { ...prevErrors };
                    ALL_DIMENSIONS.forEach((d) => {
                        if (prev[d] === "loading") nextErrors[d] = "Timed out. Pull to retry.";
                    });
                    return nextErrors;
                });
                return next;
            });
        }, LOAD_TIMEOUT_MS);

        return () => {
            clearTimeout(timeout);
            unsubMeals();
            unsubWorkouts();
            unsubWater();
            unsubMetrics();
            unsubProfile();
            unsubPrescribedWorkouts();
            unsubPrescribedMeals();
            unsubPrograms();
        };
    }, [traineeId, dateKey]);

    /** The body metric recorded on the selected day, or undefined. */
    const metricForDate = useMemo(
        () => recentMetrics.find((m) => m.date === dateKey),
        [recentMetrics, dateKey]
    );

    const totals = useMemo(
        () =>
            meals.reduce(
                (acc, meal) => ({
                    calories: acc.calories + (meal.calories || 0),
                    protein: acc.protein + (meal.protein || 0),
                    carbs: acc.carbs + (meal.carbs || 0),
                    fats: acc.fats + (meal.fats || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fats: 0 }
            ),
        [meals]
    );

    const isLoading = useMemo(
        () => ALL_DIMENSIONS.some((d) => status[d] === "loading"),
        [status]
    );

    const hasAnyError = useMemo(
        () => ALL_DIMENSIONS.some((d) => status[d] === "error"),
        [status]
    );

    /**
     * Trend figures across the recent window. Explicitly NOT day-scoped —
     * `latestWeight` is the most recent measurement on record, which may be
     * weeks old, so it must never be rendered as the selected day's weight.
     */
    const trend = useMemo(() => {
        const latestWeight = recentMetrics.length > 0 ? recentMetrics[0].weight : undefined;
        const latestWeightDate = recentMetrics.length > 0 ? recentMetrics[0].date : undefined;
        return { latestWeight, latestWeightDate };
    }, [recentMetrics]);

    return {
        // Day-scoped
        meals,
        workouts,
        waterMl,
        metricForDate,
        totals,
        // Context
        traineeProfile,
        prescribedWorkouts,
        prescribedMeals,
        programs,
        recentMetrics,
        trend,
        // Load semantics
        status,
        errors,
        isLoading,
        hasAnyError,
    };
}
