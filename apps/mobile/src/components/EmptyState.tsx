import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { iconSize, radius, spacing } from "../theme/tokens";
import { Typography } from "./Typography";
import { PrimaryButton } from "./Button";

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={iconSize.lg} color={colors.primary} />
      </View>
      <Typography variant="h2" style={styles.title}>{title}</Typography>
      <Typography variant="body" color={colors.textSecondary} style={styles.message}>
        {message}
      </Typography>
      {actionLabel && onAction ? (
        <PrimaryButton title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    minWidth: 180,
    marginTop: spacing.sm,
  },
});
