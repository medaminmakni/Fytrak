import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "./Typography";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/tokens";
import { Surface } from "./Surface";

interface MetricCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  unit: string;
  color: string;
}

export const MetricCard = memo(({ icon, label, value, unit, color }: MetricCardProps) => {
  return (
    <Surface style={styles.metricCard}>
      <View style={styles.header}>
        <Ionicons name={icon} size={16} color={color} />
        <View style={styles.histogram}>
           {[6, 12, 8, 16, 10, 14].map((h, i) => (
             <View 
               key={i} 
               style={[
                 styles.bar, 
                 { height: h, backgroundColor: i === 4 ? color : colors.borderSubtle }
               ]} 
             />
           ))}
        </View>
      </View>
      <View style={styles.content}>
        <Typography variant="metric" color="#fff" style={styles.value}>
          {value} <Typography style={styles.unit}>{unit}</Typography>
        </Typography>
        <Typography variant="label" color={colors.textMuted} style={styles.label}>
          {label.toUpperCase()}
        </Typography>
      </View>
    </Surface>
  );
});

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  histogram: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-end',
    height: 16,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  content: {
    marginTop: 14,
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 12,
    color: colors.textFaint,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    marginTop: spacing.xxs,
    fontWeight: '800',
  },
});
