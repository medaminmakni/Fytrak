import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { iconSize, radius, spacing, touchTarget } from "../theme/tokens";

type ViewerBackButtonProps = {
  onPress: () => void;
  /** Override when "Back" is ambiguous — "Back to photos", "Close comparison". */
  accessibilityLabel?: string;
};

/**
 * The leading dismiss control on a full-screen viewer.
 *
 * Both the photo viewer and the compare slider hand-rolled their own version of
 * this: a red X in a red-tinted circle, pinned to the top-right at a hardcoded
 * `top: 10` that ignored the status bar. Two problems with that:
 *
 * - `danger` is the colour of a destructive action in this system. Closing a
 *   viewer destroys nothing, and marking it red makes the one control on screen
 *   look like it deletes the photo.
 * - A trailing X reads as "dismiss a layer that appeared over your work". These
 *   viewers are a step forward in a flow you came from, so a leading back arrow
 *   matches the direction you actually travelled — and puts the control where
 *   the OS back gesture already lives.
 */
export function ViewerBackButton({ onPress, accessibilityLabel = "Back" }: ViewerBackButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { top: insets.top + spacing.sm },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    start: spacing.lg,
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    // Not a palette surface: this sits on an arbitrary photo, so it needs a
    // scrim dark enough to keep the glyph legible over a bright image.
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    zIndex: 100,
  },
  pressed: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
});
