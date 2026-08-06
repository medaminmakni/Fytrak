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
import {
    buildCoachDashboardIntelligence,
    type CoachClientIntelligence
} from "../features/coaching/coachIntelligence";

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

    const dashboard = useMemo(() => buildCoachDashboardIntelligence(clientSignals), [clientSignals]);

    const clientIntelligenceById = useMemo(() => {
        return new Map<string, CoachClientIntelligence>(dashboard.clients.map((client) => [client.traineeId, client]));
    }, [dashboard.clients]);

    const atRiskClients = useMemo(() => {
        return dashboard.clients.filter((client) => client.risk !== "low");
    }, [dashboard.clients]);

    const recentActivity = useMemo(() => {
        return dashboard.clients
            .filter((client) => client.lastWorkoutAt)
            .sort((a, b) => {
                const aTime = a.lastWorkoutAt ? a.lastWorkoutAt.getTime() : 0;
                const bTime = b.lastWorkoutAt ? b.lastWorkoutAt.getTime() : 0;
                return bTime - aTime;
            })
            .slice(0, 4);
    }, [dashboard.clients]);

    const checkInsDue = useMemo(() => {
        return dashboard.clients.filter((client) => client.risk === "high").length;
    }, [dashboard.clients]);

    const unreadMessages = useMemo(() => {
        return threadSummaries.reduce((sum, thread) => sum + thread.unreadByCoach, 0);
    }, [threadSummaries]);

    const stats = useMemo(() => {
        return {
            totalClients: assigned.length,
            newLeads: pending.length,
            consistency: dashboard.avgCompliance,
        };
    }, [assigned.length, dashboard.avgCompliance, pending.length]);

    const insights = useMemo(() => {
        if (pending.length > 0) {
            return [
                {
                    title: "New Opportunity",
                    sub: `${pending.length} pending request${pending.length === 1 ? "" : "s"} waiting for your review.`,
                    icon: "mail-outline",
                    tone: "warning" as const,
                },
                ...dashboard.insights,
            ];
        }
        return dashboard.insights;
    }, [dashboard.insights, pending.length]);

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
        insights,
        unreadMessages,
        checkInsDue,
        atRiskClients,
        recentActivity,
        clientIntelligenceById,
        handleAction,
        handleReviewRequest,
    };
}
