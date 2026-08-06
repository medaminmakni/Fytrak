import { ToastService } from "../../components/Toast";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, TextInput, type ListRenderItem } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
    toCoachClientSignals,
    fetchActiveAssignmentThreadId,
    subscribeToCoachTrainees,
    type CoachTrainee
} from "../../services/userSession";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { scoreCoachClient, type CoachClientRisk } from "../../features/coaching/coachIntelligence";

const keyExtractor = (trainee: CoachTrainee) => trainee.id;

export function CoachClientsScreen() {
    const [trainees, setTrainees] = useState<CoachTrainee[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<"all" | "needs" | "new">("all");
    const [sortMode, setSortMode] = useState<"priority" | "az">("priority");
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    const riskById = useMemo(() => {
        const map = new Map<string, CoachClientRisk>();
        clientSignals.forEach((signal) => {
            map.set(signal.traineeId, scoreCoachClient(signal).risk);
        });
        return map;
    }, [clientSignals]);

    const filtered = useMemo(() => {
        let list = trainees.filter((trainee) => {
            const name = trainee.name || "";
            const goal = trainee.profile?.goalText || trainee.profile?.goal || "";
            return `${name} ${goal}`.toLowerCase().includes(searchTerm);
        });

        if (activeFilter === "needs") {
            list = list.filter((trainee) => {
                const risk = riskById.get(trainee.id) || "low";
                return risk === "high" || risk === "medium";
            });
        }

        if (activeFilter === "new") {
            list = list.filter((trainee) => {
                const signal = clientSignals.find((item) => item.traineeId === trainee.id);
                return !signal?.lastWorkoutAt;
            });
        }

        if (sortMode === "priority") {
            const riskRank = { high: 0, medium: 1, low: 2 };
            list = [...list].sort((a, b) => {
                const aRisk = riskById.get(a.id) || "low";
                const bRisk = riskById.get(b.id) || "low";
                return riskRank[aRisk] - riskRank[bRisk];
            });
        } else {
            list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }

        return list;
    }, [activeFilter, clientSignals, riskById, searchTerm, sortMode, trainees]);

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
                navigation.navigate("CoachChat", {
                    traineeId: trainee.id,
                    traineeName: trainee.name || "Anonymous",
                    coachId: uid,
                    threadId,
                });
            })
            .catch(() => ToastService.error("Conversation unavailable", "Could not open the conversation. Please try again."));
    }, [navigation, uid]);

    const renderClientRow = useCallback<ListRenderItem<CoachTrainee>>(({ item }) => (
        <ClientRow
            trainee={item}
            risk={riskById.get(item.id) || "low"}
            onOpenDetail={openDetail}
            onOpenChat={openChat}
        />
    ), [riskById, openDetail, openChat]);

    return (
        <ScreenShell
            title="Clients"
            subtitle="Your active trainee roster"
            contentStyle={styles.shellContent}
        >
            <View style={styles.headerRow}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color={colors.iconFaint} />
                    <TextInput
                        placeholder="Search trainees..."
                        placeholderTextColor={colors.textMuted}
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{filtered.length}</Text>
                </View>
            </View>

            <View style={styles.filtersRow}>
                <View style={styles.filterGroup}>
                    <FilterChip label="All" active={activeFilter === "all"} onPress={() => setActiveFilter("all")} />
                    <FilterChip label="Needs Attention" active={activeFilter === "needs"} onPress={() => setActiveFilter("needs")} />
                    <FilterChip label="New Clients" active={activeFilter === "new"} onPress={() => setActiveFilter("new")} />
                </View>
                <Pressable style={styles.sortPill} onPress={() => setSortMode(sortMode === "priority" ? "az" : "priority")}>
                    <Ionicons name="swap-vertical" size={14} color={colors.primary} />
                    <Text style={styles.sortText}>{sortMode === "priority" ? "Priority" : "A-Z"}</Text>
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
    risk: CoachClientRisk;
    onOpenDetail: (trainee: CoachTrainee) => void;
    onOpenChat: (trainee: CoachTrainee) => void;
};

/**
 * Memoized so a roster snapshot that changes one client does not re-render
 * every other row. Props are primitives/stable callbacks for this reason.
 */
const ClientRow = memo(function ClientRow({ trainee, risk, onOpenDetail, onOpenChat }: ClientRowProps) {
    const unread = trainee.clientSummary?.unreadCoachCount ?? 0;
    const name = trainee.name || "Anonymous";

    return (
        <Pressable style={styles.clientCard} onPress={() => onOpenDetail(trainee)}>
            {unread ? <View style={styles.unreadDot} /> : null}
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(trainee.name || "?")[0]}</Text>
            </View>
            <View style={styles.info}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.goal}>{trainee.profile?.goalText || trainee.profile?.goal || "General Fitness"}</Text>
                </View>
            </View>
            <View style={styles.riskBadge}>
                <Text style={styles.riskText}>{risk.toUpperCase()}</Text>
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
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    shellContent: {
        paddingBottom: 0,
    },
    headerRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 20,
        marginTop: 10,
    },
    filtersRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 12,
    },
    filterGroup: {
        flexDirection: "row",
        gap: 8,
        flex: 1,
        flexWrap: "wrap",
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: "#161616",
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: "700",
    },
    filterTextActive: {
        color: colors.primaryText,
    },
    sortPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: "#161616",
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    sortText: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: "800",
    },
    searchBar: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#161616",
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        gap: 10,
    },
    searchInput: {
        flex: 1,
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "600",
    },
    countBadge: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.primary,
    },
    countText: {
        color: colors.primaryText,
        fontSize: 14,
        fontWeight: "900",
    },
    loader: {
        marginTop: 40,
    },
    list: {
        paddingBottom: 100,
        gap: 12,
    },
    clientCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#161616",
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        gap: 16,
    },
    unreadDot: {
        position: "absolute",
        top: 12,
        start: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    avatarText: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "800",
    },
    info: {
        flex: 1,
        gap: 4,
    },
    name: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "800",
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    goal: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: "600",
    },
    riskBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "#1c1c1e",
        borderWidth: 1,
        borderColor: "#333",
    },
    riskText: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 0.6,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1c1c1e",
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
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    unreadText: {
        color: "#000",
        fontSize: 11,
        fontWeight: "900",
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
