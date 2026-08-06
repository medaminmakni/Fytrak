import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import { NutritionRing } from "../../../components/NutritionRing";
import { MacroItem } from "../../../components/MacroItem";
import type { Meal, MacroTargets } from "../../../types/domain";

type NutritionIntelligenceCardProps = {
  meals: Meal[];
  targets: MacroTargets;
  totals: { calories: number; protein: number; carbs: number; fats: number };
  /** False when the trainee has no macro plan yet — never show invented targets. */
  hasTargets?: boolean;
};

export function NutritionIntelligenceCard({ meals, targets, totals, hasTargets = true }: NutritionIntelligenceCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 204, 0, 0.1)' }]}>
          <Ionicons name="stats-chart" size={14} color={colors.primary} />
        </View>
        <Typography variant="label" color={colors.primary} style={styles.title}>NUTRITION SUMMARY</Typography>
      </View>
      {!hasTargets ? (
        <View style={styles.card}>
          <Typography variant="bodySmall" color={colors.textMuted}>
            No macro plan set for this client yet. Prescribe a meal plan to set
            their daily targets.
          </Typography>
          <Typography variant="label" color={colors.textFaint} style={{ marginTop: spacing.sm }}>
            LOGGED TODAY: {totals.calories} KCAL · P {totals.protein} · C {totals.carbs} · F {totals.fats}
          </Typography>
        </View>
      ) : (
      <View style={styles.card}>
        <View style={styles.ringContainer}>
          <NutritionRing current={totals.calories} target={targets.calories} />
          <View style={styles.ringSideStats}>
            <View style={styles.macrosRow}>
              <MacroItem label="P" current={totals.protein} target={targets.protein} color={colors.success} icon="flash" />
              <MacroItem label="C" current={totals.carbs} target={targets.carbs} color={colors.primary} icon="restaurant" />
              <MacroItem label="F" current={totals.fats} target={targets.fats} color={colors.danger} icon="water" />
            </View>
          </View>
        </View>
        {meals.length > 0 && (
          <View style={styles.mealList}>
            {meals.slice(0, 3).map((meal) => (
              <View key={meal.id} style={styles.mealItem}>
                <Typography variant="h2" style={styles.mealName} numberOfLines={1}>{meal.name}</Typography>
                <Typography variant="label" color={colors.primary} style={styles.mealCals}>{meal.calories} kcal</Typography>
              </View>
            ))}
          </View>
        )}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginStart: 4 },
  iconBox: { width: 26, height: 26, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius["2xl"], padding: spacing.xl, borderWidth: 1, borderColor: colors.borderStrong },
  ringContainer: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringSideStats: { flex: 1 },
  macrosRow: { flexDirection: 'row', gap: 8 },
  mealList: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.lg, gap: spacing.md },
  mealItem: { flexDirection: 'row', alignItems: 'center' },
  mealName: { fontSize: 13, flex: 1 },
  mealCals: { fontSize: 11 },
});
