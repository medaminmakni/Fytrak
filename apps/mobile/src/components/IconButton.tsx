import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { iconSize, touchTarget } from "../theme/tokens";

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "default" | "primary" | "danger";
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "default",
  size = "md",
  style,
  disabled,
}: IconButtonProps) {
  const dimension = size === "lg" ? touchTarget.large : touchTarget.comfortable;
  const iconColor = disabled
    ? colors.textTertiary
    : tone === "primary"
      ? colors.primary
      : tone === "danger"
        ? colors.danger
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={[
        styles.base,
        styles[tone],
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize.lg} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  default: {
    backgroundColor: colors.surfaceInset,
  },
  primary: {
    backgroundColor: colors.primaryMuted,
  },
  danger: {
    backgroundColor: colors.dangerMuted,
  },
  /*
   * Not `opacity: 0.5`. Opacity multiplies against whatever is behind the
   * button, so the same disabled control looked different on `bg` than on a
   * card, and the glyph could drop below 4.5:1 on either. The icon colour
   * already carries the state.
   */
  disabled: {
    backgroundColor: colors.surfaceInset,
  },
});
