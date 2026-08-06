import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { BodyMetric, Meal } from "../../services/userSession";
import { toLocalDateKey } from "../../utils/dateKeys";

export function WeightTrendChart({ data }: { data: BodyMetric[] }) {
    if (data.length < 2) {
        return <View style={styles.chartEmpty}><Text style={styles.emptyText}>Need more data points (Min 2)</Text></View>;
    }

    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10);
    const weights = sorted.map(d => d.weight);
    const min = Math.min(...weights) - 0.5;
    const max = Math.max(...weights) + 0.5;
    const range = max - min;

    return (
        <View style={styles.lineChartContainer}>
            <View style={styles.lineChart}>
                {sorted.map((item, idx) => {
                    const bottom = ((item.weight - min) / range) * 60 + 10;
                    return (
                        <View key={item.id} style={styles.chartCol}>
                            <View style={[styles.trendDot, { bottom: bottom }]} />
                            {idx > 0 && (
                                <View style={[
                                    styles.trendLine,
                                    {
                                        bottom: bottom,
                                        height: 2,
                                        width: 30, // Rough estimate
                                    }
                                ]} />
                            )}
                        </View>
                    );
                })}
            </View>
            <View style={styles.chartLabels}>
                <Text style={styles.chartLabelText}>{sorted[0].weight}kg</Text>
                <Text style={[styles.chartLabelText, { color: colors.primary }]}>30D TREND</Text>
                <Text style={styles.chartLabelText}>{sorted[sorted.length - 1].weight}kg</Text>
            </View>
        </View>
    );
}

export function NutritionChart({ data, target }: { data: Meal[], target: number }) {
    const last7Days = useMemo(() => {
        const days: { [key: string]: number } = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days[toLocalDateKey(d)] = 0;
        }

        data.forEach(m => {
            if (days[m.date] !== undefined) {
                days[m.date] += m.calories;
            }
        });

        return Object.entries(days).reverse();
    }, [data]);

    return (
        <View style={styles.barChartContainer}>
            <View style={styles.barChart}>
                {last7Days.map(([date, calories]) => {
                    const percent = Math.min((calories / target) * 100, 100);
                    const isOver = calories > target * 1.1;
                    const isUnder = calories < target * 0.9 && calories > 0;
                    const isEmpty = calories === 0;

                    return (
                        <View key={date} style={styles.barItem}>
                            <View style={styles.barTrack}>
                                <View style={[
                                    styles.barFill,
                                    { height: isEmpty ? "0%" : `${percent}%` as any },
                                    isOver && { backgroundColor: "#ff4444" },
                                    isUnder && { backgroundColor: "#fbbf24" }
                                ]} />
                            </View>
                            <Text style={styles.barLabel}>{date.split("-")[2]}</Text>
                        </View>
                    );
                })}
            </View>
            <View style={styles.chartLegend}>
                <LegendItem color="#fbbf24" label="Under" />
                <LegendItem color={colors.primary} label="On Track" />
                <LegendItem color="#ff4444" label="Over" />
            </View>
        </View>
    );
}

export function LegendItem({ color, label }: any) {
    return (
        <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
        </View>
    )
}

export function StatCard({ label, value, icon }: any) {
    return (
        <View style={styles.statCard}>
            <Ionicons name={icon} size={20} color={colors.primary} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

export function CheckInBadge({ icon, value, max, color }: any) {
    return (
        <View style={styles.badge}>
            <Ionicons name={icon} size={12} color={color} />
            <Text style={[styles.badgeText, { color }]}>{value}/{max}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chartEmpty: {
        height: 100,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        color: colors.textDim,
        fontSize: 14,
        fontWeight: "600",
    },
    lineChartContainer: {
        height: 120,
        justifyContent: "flex-end",
    },
    lineChart: {
        height: 80,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingHorizontal: 10,
    },
    chartCol: {
        alignItems: "center",
        width: 20,
    },
    trendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        position: "absolute",
        zIndex: 2,
    },
    trendLine: {
        position: "absolute",
        backgroundColor: "#2c2c2e",
        zIndex: 1,
    },
    chartLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
        paddingHorizontal: 4,
    },
    chartLabelText: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: "800",
    },
    barChartContainer: {
        gap: 16,
    },
    barChart: {
        flexDirection: "row",
        height: 100,
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingHorizontal: 4,
    },
    barItem: {
        alignItems: "center",
        gap: 8,
    },
    barTrack: {
        width: 14,
        height: 80,
        backgroundColor: "#1c1c1e",
        borderRadius: 7,
        justifyContent: "flex-end",
        overflow: "hidden",
    },
    barFill: {
        width: "100%",
        backgroundColor: colors.primary,
        borderRadius: 7,
    },
    barLabel: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: "700",
    },
    chartLegend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 16,
        marginTop: 4,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: "600",
    },
    statCard: {
        flex: 1,
        backgroundColor: "#161616",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2c2c2e",
        alignItems: "center",
        gap: 4,
    },
    statValue: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "800",
        marginTop: 4,
    },
    statLabel: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#1c1c1e",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "800",
    },
});
