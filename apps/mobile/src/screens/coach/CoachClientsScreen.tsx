import { ToastService } from "../../components/Toast";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View, TextInput, type ListRenderItem } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
    toCoachClientSignals,
    fetchActiveAssignmentThreadId,
    subscribeToCoachTrainees,
    type CoachTrainee
} from "../../services/userSession";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CoachTabsParamList, RootStackParamList } from "../../navigation/types";
import {
    activitySortRank,
    describeSignalActivity,
    type ClientActivityState,
} from "../../features/coaching/coachIntelligence";
import {
    ClientActivityLine,
    formatClientActivity,
} from "../../features/coach/dashboard/components/ClientActivityLine";

const keyExtractor = (trainee: CoachTrainee) => trainee.id;

/** "Karim Haddad" -> "KH". Falls back to one letter for a single-word name. */
const initialsFor = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function CoachClientsScreen() {
    const [trainees, setTrainees] = useState<CoachTrainee[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<"all" | "needs" | "new">("all");
    const [sortMode, setSortMode] = useState<"priority" | "az">("priority");
    const navigation = useNavigation<CompositeNavigationProp<
        MaterialTopTabNavigationProp<CoachTabsParamList, "CoachClients">,
        NativeStackNavigationProp<RootStackParamList>
    >>();
    // See CoachInboxScreen: auth.currentUser is null on a cold start while
    // AsyncStorage persistence rehydrates, so this must react to uid.
    const uid = useCurrentUser();

    useEffect(() => {
        if (!uid) {
            setTrainees([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const unsubscribe = subscribeToCoachTrainees(uid, (data) => {
            const assigned = data.filter((t) => t.assignmentStatus === "assigned");
            setTrainees(assigned);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [uid]);

    // Pure projection over data the roster snapshot already carries — no I/O,
    // so no effect and no loading state (this previously ran as an async
    // effect that flashed a spinner on every snapshot).
    const clientSignals = useMemo(() => toCoachClientSignals(trainees), [trainees]);

    const searchTerm = search.trim().toLowerCase();

    /*
     * The roster's only signal. `scoreCoachClient` no longer runs on this
     * screen at all: it does not decide the order, the filter, the counts or
     * the row text. It survives elsewhere only where something still consumes
     * it, and nothing coach-facing does.
     */
    const activityById = useMemo(() => {
        const map = new Map<string, ClientActivityState>();
        clientSignals.forEach((signal) => {
            map.set(signal.traineeId, describeSignalActivity(signal));
        });
        return map;
    }, [clientSignals]);

    /*
     * Chip counts are computed over the FULL roster, not the filtered list —
     * a count that shrank as you typed in the search box would be counting
     * something other than what its label says.
     */
    const counts = useMemo(() => {
        let needs = 0;
        let fresh = 0;
        for (const trainee of trainees) {
            if (activityById.get(trainee.id)?.kind === "silent") needs += 1;
            if (activityById.get(trainee.id)?.kind === "never_logged") fresh += 1;
        }
        return { needs, new: fresh };
    }, [activityById, trainees]);

    const filtered = useMemo(() => {
        let list = trainees.filter((trainee) => {
            const name = trainee.name || "";
            const goal = trainee.profile?.goalText || trainee.profile?.goal || "";
            return `${name} ${goal}`.toLowerCase().includes(searchTerm);
        });

        if (activeFilter === "needs") {
            // "Needs attention" = actually quiet, not a composite score.
            list = list.filter(
                (trainee) => activityById.get(trainee.id)?.kind === "silent",
            );
        }

        if (activeFilter === "new") {
            list = list.filter((trainee) => {
                const signal = clientSignals.find((item) => item.traineeId === trainee.id);
                return !signal?.lastWorkoutAt;
            });
        }

        if (sortMode === "priority") {
            /*
             * Sorted by how long each client has been quiet — which is what the
             * label above the list has always claimed. It previously ordered by
             * `risk`, derived from `complianceScore`: workouts, meals LOGGED,
             * and a protein guess that pays out for clients with no target. The
             * roster said one thing and did another.
             */
            list = [...list].sort((a, b) => {
                const aRank = activitySortRank(activityById.get(a.id) ?? { kind: "never_logged" });
                const bRank = activitySortRank(activityById.get(b.id) ?? { kind: "never_logged" });
                // Name breaks ties so the order is stable between snapshots.
                return aRank - bRank || (a.name || "").localeCompare(b.name || "");
            });
        } else {
            list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }

        return list;
    }, [activeFilter, activityById, clientSignals, searchTerm, sortMode, trainees]);

    const openDetail = useCallback((trainee: CoachTrainee) => {
        navigation.navigate("TraineeDetail", {
            traineeId: trainee.id,
            traineeName: trainee.name || "Anonymous",
            traineeTimezone: trainee.timezone ?? null,
        });
    }, [navigation]);

    const openChat = useCallback((trainee: CoachTrainee) => {
        if (!uid || !trainee.activeAssignmentId) {
            ToastService.error("Conversation unavailable", "This client has no active conversation.");
            return;
        }
        void fetchActiveAssignmentThreadId(trainee.activeAssignmentId)
            .then((threadId) => {
                if (!threadId) {
                    ToastService.error("Conversation unavailable", "This client has no active conversation.");
                    return;
                }
                navigation.navigate("CoachInbox", {
                    screen: "CoachConversation",
                    params: {
                        traineeId: trainee.id,
                        traineeName: trainee.name || "Anonymous",
                        coachId: uid,
                        threadId,
                    },
                });
            })
            .catch(() => ToastService.error("Conversation unavailable", "Could not open the conversation. Please try again."));
    }, [navigation, uid]);

    const renderClientRow = useCallback<ListRenderItem<CoachTrainee>>(({ item }) => (
        <ClientRow
            trainee={item}
            activity={activityById.get(item.id) ?? { kind: "never_logged" }}
            onOpenDetail={openDetail}
            onOpenChat={openChat}
        />
    ), [activityById, openDetail, openChat]);

    return (
        <ScreenShell
            title="Clients"
            // The roster size belongs beside the word it counts, not in a pill
            // floating next to the search field where it read as a result count.
            headerAccessory={<Text style={styles.headerCount}>{trainees.length}</Text>}
            contentStyle={styles.shellContent}
        >
            <View style={styles.searchBar}>
                <Ionicons name="search" size={iconSize.md} color={colors.textTertiary} />
                <TextInput
                    placeholder="Search name or goal"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                />
            </View>

            {/*
              Counts live on the chips. A coach should know what is behind a
              filter before tapping it — "Needs attention · 3" answers the
              question the tap was going to ask.
            */}
            <View style={styles.filterGroup}>
                <FilterChip
                    label="All"
                    active={activeFilter === "all"}
                    onPress={() => setActiveFilter("all")}
                />
                <FilterChip
                    label="Needs attention"
                    count={counts.needs}
                    active={activeFilter === "needs"}
                    onPress={() => setActiveFilter("needs")}
                />
                <FilterChip
                    label="New"
                    count={counts.new}
                    active={activeFilter === "new"}
                    onPress={() => setActiveFilter("new")}
                />
            </View>

            <View style={styles.sortRow}>
                <Text style={styles.sortHint}>
                    {sortMode === "priority"
                        ? "Sorted by who has been quiet longest"
                        : "Sorted by name"}
                </Text>
                <Pressable
                    style={styles.sortPill}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort order: ${sortMode === "priority" ? "priority" : "A to Z"}. Tap to change.`}
                    onPress={() => setSortMode(sortMode === "priority" ? "az" : "priority")}
                >
                    <Text style={styles.sortText}>{sortMode === "priority" ? "Priority" : "A–Z"}</Text>
                    <Ionicons name="chevron-down" size={iconSize.sm} color={colors.primary} />
                </Pressable>
            </View>

            {isLoading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={keyExtractor}
                    renderItem={renderClientRow}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.list}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="people-outline" size={28} color={colors.iconFaint} />
                            <Text style={styles.emptyText}>
                                {trainees.length === 0 ? "No clients assigned yet." : "No clients match this view."}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {trainees.length === 0 ? "Accepted client requests will appear here." : "Try another search or filter."}
                            </Text>
                        </View>
                    }
                />
            )}
        </ScreenShell>
    );
}

type ClientRowProps = {
    trainee: CoachTrainee;
    activity: ClientActivityState;
    onOpenDetail: (trainee: CoachTrainee) => void;
    onOpenChat: (trainee: CoachTrainee) => void;
};

/**
 * Memoized so a roster snapshot that changes one client does not re-render
 * every other row. Props are primitives/stable callbacks for this reason.
 */
const ClientRow = memo(function ClientRow({ trainee, activity, onOpenDetail, onOpenChat }: ClientRowProps) {
    const unread = trainee.clientSummary?.unreadCoachCount ?? 0;
    const name = trainee.name || "Anonymous";

    return (
        <Pressable
            style={styles.clientCard}
            onPress={() => onOpenDetail(trainee)}
            accessibilityRole="button"
            accessibilityLabel={`${name}. ${formatClientActivity(activity)}.`}
        >
            {unread ? <View style={styles.unreadDot} /> : null}
            {/* Two letters, as in the design — one initial is ambiguous on a
                roster where several clients can share a first letter. */}
            <View style={styles.avatar}>
                {trainee.profileImageUrl ? (
                    <Image source={{ uri: trainee.profileImageUrl }} style={styles.avatarImage} accessibilityLabel={`${name}'s profile photo`} />
                ) : (
                    <Text style={styles.avatarText}>{initialsFor(name)}</Text>
                )}
            </View>
            {/*
              The HIGH / MEDIUM / LOW pill that sat on the right is gone. A grade
              is not actionable — a coach cannot do anything with the word
              "medium". "Silent 9 days" is the raw fact the roster snapshot has
              always carried, and it tells them whether to send a message today.
              One coloured line per row, so the list scans as a gradient of
              urgency instead of a wall of pills.
            */}
            <View style={styles.info}>
                <Text style={styles.name}>{name}</Text>
                <ClientActivityLine state={activity} />
                <Text style={styles.goal} numberOfLines={1}>
                    {trainee.profile?.goalText || trainee.profile?.goal || "General fitness"}
                </Text>
            </View>
            <Pressable
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={`Message ${name}${unread ? `, ${unread} unread` : ""}`}
                onPress={() => onOpenChat(trainee)}
            >
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
                {unread ? (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{unread}</Text>
                    </View>
                ) : null}
            </Pressable>
            <Ionicons name="chevron-forward" size={20} color="#333" />
        </Pressable>
    );
});

function FilterChip({
    label,
    count,
    active,
    onPress,
}: {
    label: string;
    /** Omitted on "All", where the header already shows the roster size. */
    count?: number;
    active: boolean;
    onPress: () => void;
}) {
    const text = count === undefined ? label : `${label} · ${count}`;
    return (
        <Pressable
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={text}
        >
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{text}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    shellContent: {
        paddingBottom: 0,
    },
    headerCount: {
        ...typography.heading,
        color: colors.textSecondary,
        marginStart: "auto",
    },
    filterGroup: {
        flexDirection: "row",
        gap: spacing.sm,
        flexWrap: "wrap",
        marginTop: spacing.lg,
    },
    filterChip: {
        minHeight: touchTarget.min,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
    },
    // Selection state, not the next action — a chosen filter is where you
    // are, not what to do. Surface step instead of the accent.
    filterChipActive: {
        backgroundColor: colors.surfaceInset,
    },
    filterText: {
        ...typography.label,
        color: colors.textSecondary,
    },
    filterTextActive: {
        color: colors.primaryText,
    },
    sortRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    sortHint: {
        ...typography.label,
        color: colors.textTertiary,
        flexShrink: 1,
    },
    sortPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        minHeight: touchTarget.min,
        paddingStart: spacing.md,
    },
    sortText: {
        ...typography.label,
        color: colors.primary,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: touchTarget.large,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.nested,
        backgroundColor: colors.surface,
        marginTop: spacing.md,
    },
    searchInput: {
        flex: 1,
        ...typography.body,
        color: colors.text,
    },
    // countBadge / countText removed — the roster size is `headerCount` now.
    loader: {
        marginTop: 40,
    },
    list: {
        paddingBottom: 100,
        gap: 12,
    },
    /*
     * A row, not a card. Fifteen bordered cards stacked down a scroll made the
     * roster read as fifteen equally-important objects; the list is the
     * structure, and the silence line is what differentiates one row from the
     * next.
     */
    clientCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
        paddingVertical: spacing.md,
    },
    /*
     * An unread message is a neutral notice, not the next action. Yellow is
     * reserved for the one thing to do on a screen, and a roster has none —
     * it is a list you scan, and every row shouting would defeat that.
     */
    unreadDot: {
        position: "absolute",
        top: spacing.md,
        start: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.info,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceInset,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarText: {
        ...typography.label,
        color: colors.textSecondary,
    },
    info: {
        flex: 1,
        minWidth: 0,
        gap: spacing.xs,
    },
    name: {
        ...typography.bodyStrong,
        color: colors.text,
    },
    /*
     * statusRow / statusDot / riskBadge / riskText are gone with the grade.
     * The dot was always `colors.primary` regardless of state — decoration
     * pretending to be a status light.
     */
    goal: {
        ...typography.label,
        color: colors.textSecondary,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceInset,
        borderWidth: 1,
        borderColor: "#333",
    },
    unreadBadge: {
        position: "absolute",
        top: -6,
        end: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.info,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    // Black on `info` is 8.26:1 — the count stays legible on the blue.
    unreadText: {
        ...typography.label,
        color: colors.primaryText,
    },
    emptyBox: {
        padding: 40,
        alignItems: "center",
        gap: 8,
    },
    emptyText: {
        color: colors.textDim,
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
    },
    emptySubtext: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    }
});
