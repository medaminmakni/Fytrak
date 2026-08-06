import { ToastService } from "../../components/Toast";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
    subscribeToCoachThreadSummaries,
    subscribeToCoachTrainees,
    type CoachThreadSummary,
    type ChatThreadSummary,
    type CoachTrainee,
} from "../../services/userSession";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { subscribeWithCache } from "../../data/subscriptions/subscriptionCache";

const toTime = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }
    if (typeof value === "object" && "toDate" in value) {
        const maybeTimestamp = value as { toDate?: () => unknown };
        if (typeof maybeTimestamp.toDate !== "function") return 0;
        const parsed = maybeTimestamp.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
    }
    return 0;
};

const toTimeLabel = (value: unknown): string => {
    const time = toTime(value);
    return time > 0 ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
};

const keyExtractor = (trainee: CoachTrainee) => trainee.id;

export function CoachInboxScreen() {
    const [trainees, setTrainees] = useState<CoachTrainee[]>([]);
    const [summaries, setSummaries] = useState<Record<string, ChatThreadSummary | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [threadsReady, setThreadsReady] = useState(false);
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    // Firebase Auth rehydrates from AsyncStorage asynchronously, so reading
    // auth.currentUser at first mount returns null on a cold start and the
    // subscriptions below would never be created (permanent spinner).
    // useCurrentUser re-renders once auth resolves, and keying the effects on
    // uid also tears listeners down correctly on logout / account switch.
    const uid = useCurrentUser();

    useEffect(() => {
        if (!uid) {
            setTrainees([]);
            setSummaries({});
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const unsubscribe = subscribeToCoachTrainees(uid, (data) => {
            setTrainees(data.filter((t) => t.assignmentStatus === "assigned"));
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [uid]);

    useEffect(() => {
        if (!uid) return;

        setThreadsReady(false);
        return subscribeWithCache<CoachThreadSummary[]>(
            `coachThreads:${uid}`,
            (emit, onError) => subscribeToCoachThreadSummaries(uid, emit, onError),
            (threadSummaries) => {
                const next: Record<string, ChatThreadSummary> = {};
                threadSummaries.forEach((summary) => {
                    next[summary.traineeId] = summary;
                });
                setSummaries(next);
                setThreadsReady(true);
            }
        );
    }, [uid]);

    const rows = useMemo(() => {
        const sorted = [...trainees].sort((a, b) => {
            const aSummary = summaries[a.id];
            const bSummary = summaries[b.id];
            const aTime = toTime(aSummary?.lastMessageAt);
            const bTime = toTime(bSummary?.lastMessageAt);
            if (aTime !== bTime) return bTime - aTime;
            return (a.name || "").localeCompare(b.name || "");
        });
        return sorted;
    }, [summaries, trainees]);

    const openThread = useCallback((trainee: CoachTrainee) => {
        const threadId = summaries[trainee.id]?.threadId;
        if (!threadsReady || !threadId) {
            ToastService.error("Conversation unavailable", "The active conversation is still loading. Please try again.");
            return;
        }
        navigation.navigate("CoachChat", {
            traineeId: trainee.id,
            traineeName: trainee.name || "Anonymous",
            coachId: uid || "unknown",
            // The thread summary already carries the assignment-scoped id, so
            // pass it through rather than letting the chat screen re-derive one.
            threadId,
        });
    }, [navigation, uid, summaries, threadsReady]);

    const renderThreadRow = useCallback<ListRenderItem<CoachTrainee>>(({ item }) => {
        const summary = summaries[item.id];
        const threadSummary = summaries[item.id] as CoachThreadSummary | undefined;

        return (
            <ThreadRow
                trainee={item}
                preview={summary?.lastMessageText || "No messages yet"}
                timeLabel={toTimeLabel(summary?.lastMessageAt)}
                unreadCount={threadSummary?.unreadByCoach ?? 0}
                onPress={openThread}
            />
        );
    }, [summaries, openThread]);

    return (
        <ScreenShell
            title="Inbox"
            subtitle="Coach conversations"
            contentStyle={styles.shellContent}
        >
            {isLoading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={keyExtractor}
                    renderItem={renderThreadRow}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.list}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="chatbubbles-outline" size={32} color={colors.iconFaint} />
                            <Text style={styles.emptyText}>No conversations yet.</Text>
                        </View>
                    }
                />
            )}
        </ScreenShell>
    );
}

type ThreadRowProps = {
    trainee: CoachTrainee;
    preview: string;
    timeLabel: string;
    unreadCount: number;
    onPress: (trainee: CoachTrainee) => void;
};

/** Memoized so one thread update doesn't re-render the whole inbox. */
const ThreadRow = memo(function ThreadRow({ trainee, preview, timeLabel, unreadCount, onPress }: ThreadRowProps) {
    const name = trainee.name || "Anonymous";
    return (
        <Pressable
            style={styles.threadCard}
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${name}${unreadCount ? `, ${unreadCount} unread` : ""}`}
            onPress={() => onPress(trainee)}
        >
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(trainee.name || "?")[0]}</Text>
            </View>
            <View style={styles.threadBody}>
                <View style={styles.threadHeader}>
                    <Text style={styles.threadName}>{name}</Text>
                    <Text style={styles.threadTime}>{timeLabel}</Text>
                </View>
                <Text style={styles.threadPreview} numberOfLines={1}>
                    {preview}
                </Text>
            </View>
            {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.iconFaint} />
        </Pressable>
    );
});

const styles = StyleSheet.create({
    shellContent: { paddingBottom: 0 },
    loader: {
        marginTop: 40,
    },
    list: {
        paddingBottom: 100,
        gap: 12,
    },
    signalLoader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 4,
        marginBottom: 6,
    },
    signalText: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
    },
    threadCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#161616",
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        gap: 12,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    avatarText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
    },
    threadBody: {
        flex: 1,
        gap: 4,
    },
    threadHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    threadName: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },
    threadTime: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: "600",
    },
    threadPreview: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "600",
    },
    unreadBadge: {
        minWidth: 24,
        paddingHorizontal: 6,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    unreadText: {
        color: "#000",
        fontSize: 11,
        fontWeight: "900",
    },
    emptyBox: {
        padding: 40,
        alignItems: "center",
        gap: 12,
    },
    emptyText: {
        color: colors.textDim,
        fontSize: 14,
        fontWeight: "600",
    },
});
