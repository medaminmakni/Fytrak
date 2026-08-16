import React, { useState } from "react";
import { ScrollView, StyleSheet, View, Pressable, Dimensions, Text } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import { Typography } from "../../../components/Typography";
import { ConsistencyCalendar } from "../../../components/ConsistencyCalendar";
import { MetricCard } from "../../../components/MetricCard";
import { TrendChart } from "../../../components/TrendChart";
import { ChartFilterBar } from "../../../components/ChartFilterBar";
import { BarChart } from "react-native-gifted-charts";
import { EXERCISE_LIBRARY } from "../../../constants/exercises";
import { useWorkouts } from "../../../hooks/useWorkouts";
import { useBodyMetrics } from "../../../hooks/useBodyMetrics";
import { useUserProfile } from "../../../hooks/useUserProfile";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import { useProgressCharts } from "../../../hooks/useProgressCharts";
import type { ChartFilter } from "../../../utils/chartFilters";

export function InsightsTab() {
  const workouts = useWorkouts();
  const { metrics } = useBodyMetrics();
  const { profile: userProfile } = useUserProfile();
  const meals = useDailyNutrition(userProfile?.timezone);

  const [chartFilter, setChartFilter] = useState<ChartFilter>("1M");
  const [selectedPrId, setSelectedPrId] = useState<string>("e1");

  const {
    weightChartData,
    volumeChartData,
    muscleDistributionData,
    prChartData,
    calculateBMI,
    weeklyConsistency,
    totalVolumeLifted,
    macroAdherence,
  } = useProgressCharts(workouts, metrics, meals, userProfile, chartFilter, selectedPrId);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {/* OVERVIEW METRICS (SAME AS PROFILE) */}
      <View style={styles.metricsHeader}>
        <View style={styles.metricsGrid}>
            <MetricBox label="FLOW" value={weeklyConsistency} unit="Days" />
            <MetricBox label="FUEL" value={macroAdherence ?? "--"} unit={macroAdherence === null ? "" : "%"} />
            <MetricBox label="BMI" value={calculateBMI} unit="" />
        </View>
      </View>

      <View style={styles.calendarSection}>
         <ConsistencyCalendar workouts={workouts} />
      </View>

      {/* WEIGHT TREND - CARDLESS PROFILE STYLE */}
      <View style={styles.chartSection}>
        <Text style={styles.eyebrow}>Weight Trend</Text>
        <View style={styles.valueRow}>
          <Text style={styles.valueText}>{metrics[0]?.weight || '--'}</Text>
          <Text style={styles.unitText}>kg</Text>
        </View>
        <View style={styles.chartFrame}>
          <TrendChart
            data={weightChartData.data}
            color={colors.primary}
            yAxisOffset={weightChartData.yAxisOffset}
            height={160}
          />
        </View>
        <View style={styles.filterRow}>
          <ChartFilterBar value={chartFilter} onChange={setChartFilter} />
        </View>
      </View>

      {/* VOLUME TREND - CARDLESS PROFILE STYLE */}
      <View style={styles.chartSection}>
        <Text style={styles.eyebrow}>Volume Progression</Text>
        <View style={styles.valueRow}>
          <Text style={styles.valueText}>
            {totalVolumeLifted >= 1000 ? (totalVolumeLifted / 1000).toFixed(1) : totalVolumeLifted}
          </Text>
          <Text style={styles.unitText}>{totalVolumeLifted >= 1000 ? "k kg" : "kg"}</Text>
        </View>
        <View style={styles.chartFrame}>
          <TrendChart
            data={volumeChartData.data}
            color="#f87171"
            height={160}
          />
        </View>
      </View>

      {/* STRENGTH PRs - CARDLESS PROFILE STYLE */}
      <View style={styles.chartSection}>
        <Text style={styles.eyebrow}>Strength Records</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prFilterRow}>
          {EXERCISE_LIBRARY.filter(ex => ex.muscleGroup === "Chest" || ex.muscleGroup === "Back" || ex.muscleGroup === "Legs").map(ex => (
            <Pressable
              key={ex.id}
              style={[styles.prFilterBtn, selectedPrId === ex.id && styles.prFilterBtnActive]}
              onPress={() => setSelectedPrId(ex.id)}
            >
              <Text style={[styles.prFilterText, selectedPrId === ex.id && styles.prFilterTextActive]}>
                {ex.name.en.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.chartFrame}>
          <TrendChart
            data={prChartData.data}
            color="#a855f7"
            yAxisOffset={prChartData.yAxisOffset}
            height={160}
          />
        </View>
      </View>

      {/* MUSCLE FOCUS - CARDLESS PROFILE STYLE */}
      <View style={styles.chartSection}>
        <Text style={styles.eyebrow}>Muscle Focus</Text>
        <View style={styles.distChartBox}>
          <BarChart
            data={muscleDistributionData}
            barWidth={32}
            spacing={20}
            noOfSections={3}
            barBorderRadius={8}
            frontColor={colors.primary}
            yAxisThickness={0}
            xAxisThickness={0}
            hideRules
            width={Dimensions.get("window").width - 100}
            yAxisTextStyle={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "700" }}
            xAxisLabelTextStyle={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800" }}
            isAnimated
            animationDuration={800}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function MetricBox({ label, value, unit }: { label: string; value: string | number; unit: string }) {
    return (
        <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
            {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 100,
  },
  metricsHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  metricBox: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  metricUnit: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  calendarSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  chartSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  eyebrow: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  valueText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },
  unitText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartFrame: {
    width: "100%",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterRow: {
    marginTop: spacing.md,
  },
  prFilterRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  prFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginEnd: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  prFilterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  prFilterText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "900",
  },
  prFilterTextActive: {
    color: "#000",
  },
  distChartBox: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
});
