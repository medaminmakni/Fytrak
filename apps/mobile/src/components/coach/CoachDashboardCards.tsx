import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import type { CoachClientIntelligence } from "../../features/coaching/coachIntelligence";

export function RiskCard({
    client,
    name,
    onOpen,
}: {
    client: CoachClientIntelligence;
    name: string;
    onOpen: () => void;
}) {
    const isHighRisk = client.risk === "high";

    return (
        <Pressable style={[styles.riskCard, isHighRisk && styles.riskCardHigh]} onPress={onOpen}>
            <View style={styles.riskHeader}>
                <View style={styles.riskIdentity}>
                    <View style={[styles.riskAvatar, isHighRisk && styles.riskAvatarHigh]}>
                        <Text style={styles.avatarTextSmall}>{name[0]?.toUpperCase() || "?"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{name}</Text>
                        <Text style={styles.goal}>{client.riskReason}</Text>
                    </View>
                </View>
                <View style={[styles.scorePill, isHighRisk && styles.scorePillHigh]}>
                    <Text style={[styles.scoreText, isHighRisk && styles.scoreTextHigh]}>{client.complianceScore}%</Text>
                </View>
            </View>
            <View style={styles.nudgeBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={isHighRisk ? "#ff7777" : colors.primary} />
                <Text style={styles.nudgeText}>{client.suggestedNudge}</Text>
            </View>
        </Pressable>
    );
}

export function QuickAction({
    label,
    icon,
    onPress,
}: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}) {
    return (
        <Pressable style={styles.quickActionCard} onPress={onPress}>
            <View style={styles.quickActionIcon}>
                <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickActionText}>{label}</Text>
        </Pressable>
    );
}

export function ActionQueueCard({
    label,
    value,
    tone,
    icon,
}: {
    label: string;
    value: number;
    tone: "warning" | "neutral" | "danger";
    icon: keyof typeof Ionicons.glyphMap;
}) {
    const toneStyles = {
        warning: { borderColor: "#3a2c12", backgroundColor: "#1a1409", color: "#fbbf24" },
        neutral: { borderColor: "#2c2c2e", backgroundColor: "#161616", color: colors.borderFaint },
        danger: { borderColor: "#3a1212", backgroundColor: "#1a0d0d", color: "#ff7777" },
    } as const;

    const toneStyle = toneStyles[tone];

    return (
        <View style={[styles.queueCard, { borderColor: toneStyle.borderColor, backgroundColor: toneStyle.backgroundColor }]}>
            <View style={styles.queueIcon}>
                <Ionicons name={icon} size={16} color={toneStyle.color} />
            </View>
            <Text style={[styles.queueValue, { color: toneStyle.color }]}>{value}</Text>
            <Text style={styles.queueLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    riskCard: {
        backgroundColor: "#161616",
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        gap: 14,
    },
    riskCardHigh: {
        borderColor: "#5a2222",
        backgroundColor: "#181212",
    },
    riskHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    riskIdentity: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    riskAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#333",
    },
    riskAvatarHigh: {
        borderColor: "#703030",
        backgroundColor: "#251414",
    },
    name: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 2,
    },
    goal: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: "500",
    },
    avatarTextSmall: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: "900",
    },
    scorePill: {
        minWidth: 52,
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: "#1c1c1e",
        borderWidth: 1,
        borderColor: "#2c2c2e",
    },
    scorePillHigh: {
        backgroundColor: "#251414",
        borderColor: "#5a2222",
    },
    scoreText: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: "900",
    },
    scoreTextHigh: {
        color: "#ff7777",
    },
    nudgeBox: {
        flexDirection: "row",
        gap: 10,
        backgroundColor: "#101010",
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: "#242424",
    },
    nudgeText: {
        flex: 1,
        color: "#c8c8c8",
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "600",
    },
    quickActionCard: {
        flex: 1,
        backgroundColor: "#161616",
        borderRadius: 18,
        paddingVertical: 12,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#2c2c2e",
        gap: 8,
    },
    quickActionIcon: {
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: "#1c1c1e",
        alignItems: "center",
        justifyContent: "center",
    },
    quickActionText: {
        color: "#ccc",
        fontSize: 11,
        fontWeight: "700",
        textAlign: "center",
    },
    queueCard: {
        flex: 1,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        gap: 6,
    },
    queueIcon: {
        width: 28,
        height: 28,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#111",
    },
    queueValue: {
        fontSize: 18,
        fontWeight: "900",
        color: "#fff",
    },
    queueLabel: {
        fontSize: 11,
        fontWeight: "800",
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
});
