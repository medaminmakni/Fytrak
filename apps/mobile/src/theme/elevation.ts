import type { ViewStyle } from "react-native";
import { colors } from "./colors";
import { radius } from "./tokens";

/**
 * Two card levels, not nine.
 *
 * The old palette had eleven surface and border tokens, which meant every
 * screen invented its own idea of what "a card" looked like. There are three
 * treatments here and no others:
 *
 * - `raised` — the single next action on the screen. At most one per screen.
 *   If two things are raised, neither reads as the next action.
 * - `flat`  — everything else. A surface step off the page, no outline.
 * - `inset` — a region nested inside a flat card. A background shift, nothing
 *   more: no outline, no shadow, no second radius language.
 *
 * None of these carry a border, and only `raised` carries a shadow — a drop
 * shadow on a flat card is decoration, and on a near-black background it is
 * decoration nobody can see.
 */
export const elevation = {
  raised: {
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  } satisfies ViewStyle,

  flat: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  } satisfies ViewStyle,

  inset: {
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
  } satisfies ViewStyle,
};

export type ElevationLevel = keyof typeof elevation;
