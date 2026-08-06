import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icons lead by default; a trailing icon should mean "this goes somewhere". */
  iconPosition?: "leading" | "trailing";
  disabled?: boolean;
  /**
   * Shows a spinner and blocks presses. Distinct from `disabled`: a loading
   * button is announced as busy rather than unavailable, and the caller does
   * not have to also pass `disabled` to prevent a second submit.
   */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * The one button in the app.
 *
 * `primary` is the single next action on a screen — if a screen has two, one of
 * them is really a `secondary`. Variants differ by fill only; none of them
 * carries an outline.
 */
export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  icon,
  iconPosition = "leading",
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const isBlocked = disabled || loading;
  const contentColor = isBlocked
    ? colors.textTertiary
    : variant === "primary"
      ? colors.primaryText
      : variant === "danger"
        ? colors.danger
        : colors.text;

  const glyph = icon ? (
    <Ionicons name={icon} size={iconSize.md} color={contentColor} />
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        isBlocked && variant !== "ghost" && styles.blocked,
        pressed && !isBlocked && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : (
        iconPosition === "leading" && glyph
      )}
      <Text style={[styles.label, { color: contentColor }]} numberOfLines={1}>
        {title}
      </Text>
      {!loading && iconPosition === "trailing" && glyph}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget.large,
    borderRadius: radius.nested,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceInset,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.dangerMuted,
  },
  /*
   * One blocked treatment for every filled variant. The old version kept each
   * variant's fill and added a border, so a disabled danger button still read
   * as an available red control.
   */
  blocked: {
    backgroundColor: colors.surfaceInset,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    ...typography.button,
    textAlign: "center",
  },
});
