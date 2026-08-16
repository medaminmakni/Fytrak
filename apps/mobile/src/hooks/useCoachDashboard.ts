import { ToastService } from "../components/Toast";
import { useState, useEffect, useMemo, useCallback } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import {
    toCoachClientSignals,
    respondToTraineeRequest,
    subscribeToCoachTrainees,
    subscribeToCoachThreadSummaries,
    type CoachThreadSummary,
    subscribeToPendingCoachRequests,
    type CoachTrainee,
} from "../services/userSession";
import { useCurrentUser } from "./useCurrentUser";
import type { CoachClientSignal } from "../features/coaching/coachIntelligence";

export function useCoachDashboard() {
    const uid = useCurrentUser();
    const [trainees, setTrainees] = useState<CoachTrainee[]>([]);
    const [pendingRequests, setPendingRequests] = useState<CoachTrainee[]>([]);
    const [threadSummaries, setThreadSummaries] = useState<CoachThreadSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            setTrainees([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const unsubscribe = subscribeWithCache<CoachTrainee[]>(
            `coachTrainees:${uid}`,
            (emit, onError) => subscribeToCoachTrainees(uid, emit, onError),
            (data) => {
                setTrainees(data);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [uid]);

    useEffect(() => {
        if (!uid) {
            setThreadSummaries([]);
            return;
        }
        return subscribeWithCache<CoachThreadSummary[]>(
            `coachThreads:${uid}`,
            (emit, onError) => subscribeToCoachThreadSummaries(uid, emit, onError),
            setThreadSummaries
        );
    }, [uid]);

    useEffect(() => {
        if (!uid) {
            setPendingRequests([]);
            return;
        }

        const unsubscribe = subscribeWithCache<CoachTrainee[]>(
            `coachPendingRequests:${uid}`,
            (emit) => subscribeToPendingCoachRequests(uid, (requests) => {
                emit(requests.map((request) => ({
                    id: request.traineeId,
                    name: request.traineeName,
                    profile: {
                        goal: request.traineeGoal,
                        goalText: request.traineeGoal,
                    },
                    assignmentStatus: "pending",
                    selectedCoachId: uid,
                })));
            }),
            setPendingRequests
        );

        return () => unsubscribe();
    }, [uid]);

    const pending = pendingRequests;
    const assigned = useMemo(() => trainees.filter(t => t.assignmentStatus === "assigned"), [trainees]);

    // Pure projection over fields the roster snapshot already carries — no I/O.
    // Previously an async effect, which caused three renders and a spinner
    // flash on every Firestore snapshot for a microsecond computation.
    const clientSignals = useMemo(() => toCoachClientSignals(assigned), [assigned]);

    /*
     * The roster signals, keyed by trainee. Raw facts only.
     *
     * This used to be `buildCoachDashboardIntelligence(clientSignals)`, whose
     * output — `complianceScore`, a HIGH/MEDIUM/LOW `risk`, `riskReason`,
     * `suggestedNudge`, `avgCompliance` — reached the coach dashboard through
     * `atRiskClients`, `checkInsDue` and `stats.consistency`.
     *
     * None of it was provable. `complianceScore` is 55 points for workouts
     * logged, 25 for meals *logged* (a count, never compared against a target)
     * and 20 for protein, of which 12 are paid out for free to any client with
     * no protein target set. `risk` is that number thresholded, and `riskReason`
     * printed the result as though it were an observation.
     *
     * The scoring functions have since been deleted outright: once this
     * dashboard stopped reading them, a grep found no caller anywhere in the
     * app. Attention here is classified by `describeSignalActivity` alone, and
     * only its `silent` branch counts.
     */
    const clientSignalById = useMemo(() => {
        return new Map<string, CoachClientSignal>(
            clientSignals.map((signal) => [signal.traineeId, signal]),
        );
    }, [clientSignals]);

    const recentActivity = useMemo(() => {
        return clientSignals
            .filter((client) => client.lastWorkoutAt)
            .sort((a, b) => {
                const aTime = a.lastWorkoutAt ? a.lastWorkoutAt.getTime() : 0;
                const bTime = b.lastWorkoutAt ? b.lastWorkoutAt.getTime() : 0;
                return bTime - aTime;
            })
            .slice(0, 4);
    }, [clientSignals]);

    const unreadMessages = useMemo(() => {
        return threadSummaries.reduce((sum, thread) => sum + thread.unreadByCoach, 0);
    }, [threadSummaries]);

    const stats = useMemo(() => {
        // `consistency: dashboard.avgCompliance` was removed with the risk
        // engine. Both remaining values are counts of rows the coach can open.
        return {
            totalClients: assigned.length,
            newLeads: pending.length,
        };
    }, [assigned.length, pending.length]);

    const handleAction = useCallback(async (traineeId: string, name: string, accept: boolean) => {
        const action = accept ? "Accept" : "Reject";
        ToastService.confirm({
            title: `${action} request?`,
            message: `${name} is waiting for your coaching decision.`,
            confirmLabel: action,
            destructive: !accept,
            onConfirm: async () => {
                try {
                    await respondToTraineeRequest(traineeId, accept);
                } catch (error) {
                    console.error(`Failed to ${action} trainee:`, error);
                    ToastService.error("Error", `Could not ${action.toLowerCase()} request.`);
                }
            },
        });
    }, []);

    const handleReviewRequest = useCallback((traineeId: string, name: string) => {
        // Three outcomes — accept, reject, or decide later — so this is a
        // choice rather than a confirmation. Dismissing leaves the request
        // pending, which is the safe default for someone else's application.
        ToastService.choose({
            title: "Review client request",
            message: `${name} is waiting for your coaching decision.`,
            cancelLabel: "Decide later",
            options: [
                {
                    label: "Accept",
                    onPress: () => void respondToTraineeRequest(traineeId, true).catch((error) => {
                        console.error("Failed to accept trainee:", error);
                        ToastService.error("Error", "Could not accept request.");
                    }),
                },
                {
                    label: "Reject",
                    destructive: true,
                    onPress: () => void respondToTraineeRequest(traineeId, false).catch((error) => {
                        console.error("Failed to reject trainee:", error);
                        ToastService.error("Error", "Could not reject request.");
                    }),
                },
            ],
        });
    }, []);

    return {
        trainees,
        pending,
        assigned,
        isLoading,
        stats,
        unreadMessages,
        recentActivity,
        clientSignalById,
        handleAction,
        handleReviewRequest,
    };
}
