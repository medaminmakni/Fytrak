import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import { Surface } from "../../../components/Surface";
import type { TodayMission, TodayMissionItemId } from "../todayMission";

type TodayMissionCardProps = {
  mission: TodayMission;
  onAction: (id: TodayMissionItemId) => void;
};

export function TodayMissionCard({ mission, onAction }: TodayMissionCardProps) {
  const isComplete = mission.completionPercent === 100;

  return (
    <Surface tone="default" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <View style={styles.dot} />
          <Typography variant="label" color={colors.primary} style={styles.eyebrow}>
            TODAY'S MISSION
          </Typography>
        </View>
        <View style={[styles.badge, isComplete && styles.badgeComplete]}>
          <Typography style={[styles.badgeText, isComplete && styles.badgeTextComplete]}>
            {mission.completionPercent}%
          </Typography>
        </View>
      </View>

      <View style={styles.trackArea}>
        <View style={styles.track}>
          <View style={[styles.progress, { width: `${mission.completionPercent}%` }]} />
        </View>
      </View>

      <View style={styles.list}>
        {mission.items.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.item, 
              item.isComplete && styles.itemComplete,
              pressed && styles.pressed
            ]}
            onPress={() => onAction(item.id)}
          >
            <View style={[styles.iconBox, item.isComplete && styles.iconBoxComplete]}>
              <Ionicons 
                name={item.isComplete ? "checkmark" : (item.icon as any)} 
                size={18} 
                color={item.isComplete ? "#000" : colors.primary} 
              />
            </View>
            <View style={styles.itemContent}>
              <Typography variant="h2" style={styles.itemTitle}>
                {item.title}
              </Typography>
              <Typography variant="label" color={colors.textDim} style={styles.itemSubtitle}>
                {item.subtitle}
              </Typography>
            </View>
            <Ionicons 
              name={item.isComplete ? "checkmark-circle" : "chevron-forward"} 
              size={18} 
              color={item.isComplete ? colors.primary : colors.textDim} 
            />
          </Pressable>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -4,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgDark,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  badgeComplete: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  badgeTextComplete: {
    color: "#000",
  },
  trackArea: {
    height: 4,
  },
  track: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  progress: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  itemComplete: {
    backgroundColor: "rgba(255,204,0,0.04)",
    borderColor: "rgba(255,204,0,0.1)",
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxComplete: {
    backgroundColor: colors.primary,
  },
  itemContent: {
    flex: 1,
    gap: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  itemSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textDim,
  },
});
