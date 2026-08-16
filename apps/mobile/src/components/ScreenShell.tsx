import { PropsWithChildren, ReactNode, useState } from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, touchTarget, typography } from "../theme/tokens";
import { IconButton } from "./IconButton";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

type ScreenShellProps = PropsWithChildren<{
  /**
   * Omit to render no header at all. Auth screens have no page title — the
   * wordmark is the identity, and it belongs with the form rather than pinned
   * above it.
   */
  title?: ReactNode;
  /**
   * A plain string gets the standard subtitle style. Pass a node only when the
   * line needs structure the style cannot carry — the chat header's verified
   * badge, for example — and match `styles.subtitle` when you do.
   */
  subtitle?: ReactNode;
  /**
   * Non-interactive content pinned to the trailing edge of the title row: an
   * avatar, a status chip. Use `rightActionIcon` / `rightActionMenu` instead if
   * it is meant to be tapped.
   */
  headerAccessory?: ReactNode;
  centered?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  leftActionIcon?: keyof typeof Ionicons.glyphMap;
  onLeftAction?: () => void;
  rightActionIcon?: keyof typeof Ionicons.glyphMap;
  rightActionImageUri?: string;
  onRightAction?: () => void;
  rightActionMenu?: ContextMenuItem[];
}>;

export function ScreenShell({
  title,
  subtitle,
  headerAccessory,
  centered = false,
  titleStyle,
  subtitleStyle,
  contentStyle,
  leftActionIcon,
  onLeftAction,
  rightActionIcon,
  rightActionImageUri,
  onRightAction,
  rightActionMenu,
  children,
}: ScreenShellProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const hasHeader =
    title !== undefined ||
    subtitle !== undefined ||
    Boolean(leftActionIcon) ||
    Boolean(rightActionIcon) ||
    Boolean(rightActionImageUri) ||
    Boolean(headerAccessory);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.container, centered && styles.containerCentered]}>
        {hasHeader ? (
        <View style={[styles.header, centered && { alignItems: "center" }]}>
          <View style={[styles.headerTitleRow, centered && { justifyContent: "center", width: "100%" }]}>
            {leftActionIcon && onLeftAction && (
              <IconButton
                icon={leftActionIcon}
                onPress={onLeftAction}
                accessibilityLabel="Go back"
                style={styles.leftButton}
              />
            )}

            {typeof title === "string" ? (
              <Text
                numberOfLines={1}
                style={[styles.title, titleStyle, !centered && { flex: 1 }, centered && { textAlign: "center" }]}
              >
                {title}
              </Text>
            ) : (
              <View style={[!centered && { flex: 1 }, centered && { alignItems: "center", justifyContent: "center" }]}>
                {title}
              </View>
            )}

            {headerAccessory}

            {(rightActionIcon || rightActionImageUri) && (onRightAction || rightActionMenu) && (
              <Pressable
                onPress={rightActionMenu ? () => setMenuVisible(true) : onRightAction}
                accessibilityRole="button"
                accessibilityLabel={rightActionImageUri ? "Open profile" : "Open action"}
                hitSlop={8}
                style={[
                  styles.headerButton,
                  rightActionImageUri && styles.avatarButton,
                  rightActionMenu && styles.menuButton
                ]}
              >
                <View style={styles.rightActionContent}>
                  {rightActionImageUri ? (
                    <Image source={{ uri: rightActionImageUri }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name={rightActionIcon!} size={24} color={colors.primary} />
                  )}
                  {rightActionMenu && (
                    <Ionicons name="chevron-down" size={14} color={colors.primary} style={styles.chevron} />
                  )}
                </View>
              </Pressable>
            )}
          </View>
          {typeof subtitle === "string" ? (
            subtitle.trim() ? (
              <Text
                numberOfLines={2}
                style={[styles.subtitle, subtitleStyle, centered && { textAlign: "center" }]}
              >
                {subtitle}
              </Text>
            ) : null
          ) : (
            subtitle ?? null
          )}
        </View>
        ) : null}
        <View style={[styles.content, centered && styles.contentCentered, contentStyle]}>{children}</View>
      </View>
      {rightActionMenu && (
        <ContextMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          items={rightActionMenu}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  containerCentered: {
    justifyContent: "center",
  },
  header: {
    marginTop: spacing.xs,
    marginBottom: 0,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  leftButton: {
    width: 36,
    height: 36,
    marginEnd: spacing.md,
  },
  avatarButton: {
    borderWidth: 0,
    padding: 0,
    backgroundColor: "transparent",
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  menuButton: {
    width: "auto",
    paddingStart: spacing.xs,
    paddingEnd: spacing.xs,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  rightActionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chevron: {
    marginTop: 0,
  },
  /*
   * Screen titles were drifting: some screens passed "NUTRITION", some
   * "Progress", some "Edit Coach Profile", and the header rendered whatever it
   * was given plus 1.0 of letter-spacing. The casing is now fixed here rather
   * than trusted to each caller — `textTransform: "none"` stops a screen
   * re-uppercasing through `titleStyle`, and the letter-spacing is gone because
   * it does not survive translation into Arabic.
   */
  title: {
    ...typography.title,
    color: colors.primary,
    textTransform: "none",
    paddingEnd: spacing.sm,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    ...typography.body,
    textTransform: "none",
  },
  content: {
    flex: 1,
    marginTop: spacing.sm,
  },
  contentCentered: {
    flex: 0,
    marginTop: spacing.xl,
  },
});
