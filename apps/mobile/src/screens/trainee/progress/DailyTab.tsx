import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, Text, Image, Modal, Pressable } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import { Typography } from "../../../components/Typography";
import { DailyNutritionReport } from "../../../features/progress/components/DailyNutritionReport";
import { DailyTrainingReport } from "../../../features/progress/components/DailyTrainingReport";
import { DailyBiomarkersReport } from "../../../features/progress/components/DailyBiomarkersReport";
import { DailyVisualReport } from "../../../features/progress/components/DailyVisualReport";
import { useWorkouts } from "../../../hooks/useWorkouts";
import { useBodyMetrics } from "../../../hooks/useBodyMetrics";
import { useDailyNutrition } from "../../../hooks/useDailyNutrition";
import { useUserProfile } from "../../../hooks/useUserProfile";
import { useDailyWater } from "../../../hooks/useDailyWater";
import { useProgressPhotos } from "../../../hooks/useProgressPhotos";
import { useClientDateKey } from "../../../hooks/useClientDateKey";

export function DailyTab() {
  const workouts = useWorkouts();
  const { metrics } = useBodyMetrics();
  const { profile: userProfile } = useUserProfile();
  const meals = useDailyNutrition(userProfile?.timezone);
  const waterMl = useDailyWater(userProfile?.timezone);
  const { photos } = useProgressPhotos();

  // One client-timezone date source for every section on the screen.
  const todayKey = useClientDateKey(userProfile?.timezone);

  const todayWorkout = useMemo(() => {
    return workouts.find(w => w.date === todayKey);
  }, [workouts, todayKey]);

  const todayPhoto = useMemo(() => {
    return photos.find(p => p.date === todayKey);
  }, [photos, todayKey]);

  const todayMetric = useMemo(() => {
    return metrics.find(m => m.date === todayKey);
  }, [metrics, todayKey]);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fats: acc.fats + (meal.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [meals]);

  // Never invent targets. A trainee with no plan yet was previously shown a
  // hardcoded 2100/160/220/65 as though their coach had set it, so their rings
  // measured adherence against a number nobody chose.
  const hasTargets = Boolean(userProfile?.macroTargets);
  const targets = userProfile?.macroTargets ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <View style={styles.dot} />
          <Typography variant="label" color={colors.primary} style={styles.eyebrow}>
            DAILY TRACKER
          </Typography>
        </View>
        <Typography variant="h2" style={styles.mainTitle}>
          Today, {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </Typography>
      </View>

      <View style={styles.section}>
        <DailyNutritionReport
          meals={meals}
          targets={targets}
          totals={totals}
          waterMl={waterMl}
          hasTargets={hasTargets}
        />
      </View>

      <View style={styles.section}>
        <DailyTrainingReport workout={todayWorkout} />
      </View>

      <View style={styles.section}>
        <DailyBiomarkersReport 
          todayMetric={todayMetric} 
          todayWorkout={todayWorkout} 
        />
      </View>

      <View style={styles.section}>
        <DailyVisualReport todayPhoto={todayPhoto} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
    gap: 4,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 11,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "900",
  },
  section: {
    marginBottom: 20,
  },
  // The following styles are for sub-components (Report components) that might use them
  card: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: radius["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
});
