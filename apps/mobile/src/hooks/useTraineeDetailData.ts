import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

/**
 * The dimensions of one client-day, each loading and failing independently.
 *
 * `plans` used to be ONE dimension fed by three subscriptions — daily workout
 * prescriptions, daily meal prescriptions and programs — combined two ways that
 * were both wrong:
 *
 * - it only became `loaded` once all three had responded, so a slow programs
 *   query hid a workout plan that had already arrived;
 * - any one of the three failing marked the whole thing `error`, so a failed
 *   MEAL plan read made the screen say the workout plan was unavailable.
 *
 * They are now split along the lines the UI actually renders: the planned
 * workout (daily prescriptions plus programs, which resolve together) and the
 * planned nutrition (daily meal prescriptions, which have no program fallback).
 */
export type TraineeDetailDimension =
    | "meals"
    | "workouts"
    | "water"
    | "metrics"
    | "profile"
    | "plannedWorkout"
    | "plannedNutrition";

type StatusMap = Record<TraineeDetailDimension, DataStatus>;

const ALL_DIMENSIONS: TraineeDetailDimension[] = [
    "meals",
    "workouts",
    "water",
    "metrics",
    "profile",
    "plannedWorkout",
    "plannedNutrition",
];

const initialStatus = (): StatusMap => ({
    meals: "loading",
    workouts: "loading",
    water: "loading",
    metrics: "loading",
    profile: "loading",
    plannedWorkout: "loading",
    plannedNutrition: "loading",
});

/**
 * A listener that never responds is a failure, not an eternal spinner.
 *
 * Exported so the daily-report listener on TraineeDetailScreen — the seventh
 * dimension, which lives on the screen rather than in this hook — times out on
 * the same budget. Two different limits would mean two different moments at
 * which the same stalled connection stops being called "loading".
 */
export const LOAD_TIMEOUT_MS = 12000;

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

    /*
     * Retry, without a new data layer.
     *
     * Bumping this token re-runs the subscription effect, which tears the old
     * listeners down and attaches fresh ones. The screen's timeout message has
     * said "Pull to retry" since it shipped while nothing was listening for a
     * pull; this is the mechanism that sentence always implied.
     */
    const [retryToken, setRetryToken] = useState(0);

    /*
     * Distinguishes a RETRY of the same client-day from navigating to a
     * different one. On a retry the already-loaded sections must keep their
     * content on screen — resetting every dimension to `loading` would blank a
     * report the coach is reading because one unrelated listener failed.
     */
    const loadKey = `${traineeId}|${dateKey}`;
    const loadKeyRef = useRef<string | null>(null);

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

        const isSameTarget = loadKeyRef.current === loadKey;
        loadKeyRef.current = loadKey;

        if (isSameTarget) {
            // Retry: only the dimensions that have nothing to show go back to
            // `loading`. Loaded ones keep their content and their status, and
            // their listeners re-deliver from cache almost immediately.
            setStatus((prev) => {
                const next = { ...prev };
                let changed = false;
                ALL_DIMENSIONS.forEach((d) => {
                    if (next[d] !== "loaded") {
                        next[d] = "loading";
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
            setErrors({});
        } else {
            setStatus(initialStatus());
            setErrors({});
        }

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

        /*
         * The only subscription here that had NO error callback. A failed
         * profile read left the dimension `loading` until the 12s timeout, and
         * `macroTargets` stayed undefined — which the nutrition card renders as
         * "no plan set". A failed read was therefore shown as a client with no
         * targets, which is a different fact entirely.
         */
        const unsubProfile = subscribeToUserProfile(
            traineeId,
            (data) => {
                setTraineeProfile(data);
                loaded("profile");
            },
            (error) => failed("profile", error)
        );

        // The PLANNED side of the report. Read-only here — resolution into a
        // specific day happens in the pure resolver, never in this hook.
        /*
         * The planned WORKOUT resolves from two sources — a daily prescription
         * overrides, a program supplies the rest — so it needs both before it
         * can honestly say "no workout planned". Either failing makes the
         * dimension unavailable, because a missing source is indistinguishable
         * from an empty one from the resolver's point of view.
         */
        const workoutPlanParts = new Set<"prescriptions" | "programs">();
        const workoutPlanPartLoaded = (part: "prescriptions" | "programs") => {
            workoutPlanParts.add(part);
            if (workoutPlanParts.size === 2) loaded("plannedWorkout");
        };
        const unsubPrescribedWorkouts = subscribeToPrescriptionHistory(
            traineeId,
            (data) => {
                setPrescribedWorkouts(data as ScheduledPrescribedWorkout[]);
                workoutPlanPartLoaded("prescriptions");
            },
            (error) => failed("plannedWorkout", error)
        );
        const unsubPrograms = subscribeToTraineePrograms(
            traineeId,
            (data) => {
                setPrograms(data as ScheduledProgramDoc[]);
                workoutPlanPartLoaded("programs");
            },
            (error) => failed("plannedWorkout", error)
        );

        // Nutrition has no program fallback, so it is a single source and
        // resolves on its own. It no longer waits on, or fails with, programs.
        const unsubPrescribedMeals = subscribeToPrescribedMealHistory(
            traineeId,
            (data) => {
                setPrescribedMeals(data as ScheduledPrescribedMeal[]);
                loaded("plannedNutrition");
            },
            (error) => failed("plannedNutrition", error)
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
                        if (prev[d] === "loading") nextErrors[d] = "Timed out. Tap Retry.";
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
    }, [traineeId, dateKey, loadKey, retryToken]);

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
     * Re-attaches every listener for the current client-day.
     *
     * Deliberately re-runs ALL of them rather than only the failed ones: the
     * failures are usually a single connectivity blip, and a partial retry
     * would leave the report assembled from two different moments.
     */
    const retry = useCallback(() => {
        /*
         * The status reset happens HERE, not in the effect.
         *
         * The effect runs after the next render, so for one frame the retried
         * dimensions were still `error` — long enough for a caller computing
         * "is anything loading?" to conclude the retry had already finished and
         * re-enable the control. Resetting in the same batch as the token means
         * the very next render already sees them as `loading`.
         *
         * Only non-`loaded` dimensions move. A dimension the coach can already
         * read stays exactly as it is, content and all.
         */
        setStatus((prev) => {
            const next = { ...prev };
            let changed = false;
            ALL_DIMENSIONS.forEach((d) => {
                if (next[d] !== "loaded") {
                    next[d] = "loading";
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
        setRetryToken((token) => token + 1);
    }, []);

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
        /*
         * The ACTION only. This hook no longer reports "am I retrying?":
         * the report/review listener lives on TraineeDetailScreen, so a hook
         * that only watches its own six dimensions declared a report-only retry
         * finished the moment it began. The combined lifecycle lives in
         * `features/coaching/retryState.ts`.
         */
        retry,
    };
}
