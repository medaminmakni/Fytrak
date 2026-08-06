import type { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/tokens";

export type TypographyVariant =
  | "display"
  | "h1"
  | "h2"
  | "subtitle"
  | "body"
  | "bodyStrong"
  | "label"
  | "button"
  | "metric"
  /** @deprecated There is no 13px step. Use `label`. */
  | "bodySmall";

interface TypographyProps {
  children: ReactNode;
  variant?: TypographyVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityRole?: "text" | "header";
}

/*
 * The script-specific branching this component used to do is gone. It existed
 * because `label` and `button` were uppercase with positive letter-spacing, and
 * neither survives translation into Arabic — so an `isArabic` check swapped in
 * neutral variants. The scale itself is now sentence case with no
 * letter-spacing, which makes one set of styles correct in every language and
 * drops react-i18next out of a component that only renders text.
 */
const VARIANT_STYLE: Record<TypographyVariant, TextStyle> = {
  display: typography.display,
  h1: typography.title,
  h2: typography.heading,
  subtitle: { ...typography.body, color: colors.textSecondary },
  body: typography.body,
  bodyStrong: typography.bodyStrong,
  bodySmall: typography.label,
  label: typography.label,
  button: typography.button,
  metric: { ...typography.metric, color: colors.primary },
};

/** Headings announce themselves without every call site remembering to say so. */
const HEADING_VARIANTS = new Set<TypographyVariant>(["display", "h1", "h2"]);

export function Typography({
  children,
  variant = "body",
  color,
  style,
  numberOfLines,
  accessibilityRole,
}: TypographyProps) {
  return (
    <Text
      style={[styles.base, VARIANT_STYLE[variant], color ? { color } : null, style]}
      numberOfLines={numberOfLines}
      accessibilityRole={
        accessibilityRole ?? (HEADING_VARIANTS.has(variant) ? "header" : undefined)
      }
      allowFontScaling
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
});
