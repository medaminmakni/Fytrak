import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "../../../theme/tokens";
import type { BodyMetric, WorkoutLog } from "../../../types/domain";
import { colors } from "../../../theme/colors";

type DailyBiomarkersReportProps = {
  todayMetric?: BodyMetric;
  todayWorkout?: WorkoutLog;
};

export function DailyBiomarkersReport({ todayMetric, todayWorkout }: DailyBiomarkersReportProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="body" size={18} color="#60a5fa" />
        <Text style={[styles.sectionTitle, { color: "#60a5fa" }]}>BIO-MARKERS</Text>
      </View>
      <View style={styles.metricsGrid}>
        <MetricBox
          label="Weight"
          value={todayMetric?.weight ? `${todayMetric.weight} kg` : "--"}
          icon="speedometer-outline"
          color="#60a5fa"
        />
        <MetricBox
          label="Body Fat"
          value={todayMetric?.bodyFat ? `${todayMetric.bodyFat}%` : "--"}
          icon="analytics-outline"
          color="#a855f7"
        />
      </View>
      <View style={[styles.metricsGrid, { marginTop: 12 }]}>
        <MetricBox
          label="Energy"
          value={todayWorkout?.checkIn?.energy ? `${todayWorkout.checkIn.energy}/5` : "--"}
          icon="flashlight-outline"
          color="#fbbf24"
        />
        <MetricBox
          label="Mood"
          value={todayWorkout?.checkIn?.mood ? `${todayWorkout.checkIn.mood}/5` : "--"}
          icon="happy-outline"
          color="#f472b6"
        />
      </View>
    </View>
  );
}

function MetricBox({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.metricBox}>
      <View style={[styles.metricIconBg, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginStart: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  metricsGrid: { flexDirection: 'row', gap: spacing.md },
  metricBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: "#222" },
  metricIconBg: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 2 },
  metricValue: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
