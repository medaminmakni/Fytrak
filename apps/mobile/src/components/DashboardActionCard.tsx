import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "./Typography";
import { colors } from "../theme/colors";
import { spacing, radius } from "../theme/tokens";
import type { DashboardAction } from "../hooks/useTraineeDashboard";

type DashboardActionCardProps = {
  action: DashboardAction;
  onPress: () => void;
};

export function DashboardActionCard({ action, onPress }: DashboardActionCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.iconBox}>
        <Ionicons name={action.icon} size={24} color={colors.primaryText} />
      </View>
      <View style={styles.content}>
        <Typography variant="label" color="rgba(0,0,0,0.62)">{action.eyebrow}</Typography>
        <Typography variant="h2" style={styles.title}>{action.title}</Typography>
        <Typography variant="label" color={colors.textFaint} style={styles.subtitle}>
          {action.subtitle}
        </Typography>
      </View>
      <View style={styles.cta}>
        <Typography style={styles.ctaText}>{action.actionLabel}</Typography>
        <Ionicons name="arrow-forward" size={16} color={colors.primaryText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: 22,
    color: colors.primaryText,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 11,
    // On colors.primary (yellow), 0.5 alpha gives 3.6:1 — fails for body text.
    // 0.72 clears 4.5:1. The eyebrow's 0.62 is fine at its weight and size.
    color: "rgba(0,0,0,0.72)",
    textTransform: "none",
    letterSpacing: 0,
  },
  cta: {
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.1)",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaText: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
