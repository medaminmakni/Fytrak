/**
 * Fytrak colour system.
 *
 * Three surfaces, three text steps, one accent, four status colours. That is
 * the whole palette. Every text step clears 4.5:1 on `bg`, so there is no
 * colour here that is unsafe for body copy.
 *
 * Two rules that the old palette broke and this one enforces:
 *
 * 1. Status colours mean state, never category. `success` = goal met.
 *    `warning` = due soon. `danger` = destructive or failing. `info` = neutral
 *    notice. `primary` = the one next action on the screen. None of them ever
 *    marks a category — that is what icons and titles are for.
 * 2. Space is the divider. Nothing in this system has a 1px border, so there
 *    are no border tokens below. Separation comes from a surface step or from
 *    spacing, not from an outline.
 */
export const colors = {
  // ---------------------------------------------------------------------------
  // Surfaces — three levels, no more
  // ---------------------------------------------------------------------------
  /** Page background. Nothing sits behind this. */
  bg: "#0b0b0b",
  /** A card, sheet, or bar lifted off the page. */
  surface: "#151515",
  /** A region nested inside a surface: an input well, a read-only row. */
  surfaceInset: "#1e1e1e",
  /**
   * The floating tab capsule, and nothing else.
   *
   * A fourth surface is a design smell, so this one is named for its single
   * permitted use. The capsule floats over scrolling content rather than
   * sitting on the page, and at `surface` it disappeared against cards passing
   * underneath it. The design sheet lists it separately for the same reason.
   */
  surfaceTabBar: "#1a1a1a",

  // ---------------------------------------------------------------------------
  // Text — three steps, all legible on bg
  // ---------------------------------------------------------------------------
  /** Primary copy, headings, values. 19.4:1 */
  text: "#ffffff",
  /** Supporting copy, labels, descriptions. 8.9:1 */
  textSecondary: "#a8adb8",
  /** Metadata, timestamps, captions. 4.7:1 — the floor, not a default. */
  textTertiary: "#757b87",

  // ---------------------------------------------------------------------------
  // Accent
  // ---------------------------------------------------------------------------
  /** The single next action on a screen. 13.0:1 */
  primary: "#ffcc00",
  /** Black, for text and icons sitting on a primary fill. */
  primaryText: "#000000",
  /** A primary wash — selected tabs, active chips. Never carries text alone. */
  primaryMuted: "rgba(255, 204, 0, 0.14)",

  // ---------------------------------------------------------------------------
  // Status — state, never category
  // ---------------------------------------------------------------------------
  /** Goal met. 11.4:1 */
  success: "#4ade80",
  /** Due soon. 11.4:1 */
  warning: "#fbbf24",
  /** Destructive or failing. 6.8:1 */
  danger: "#f87171",
  /** Neutral notice. 6.9:1 */
  info: "#60a5fa",

  /** Status washes. Backgrounds only — pair with the matching solid for text. */
  successMuted: "rgba(74, 222, 128, 0.16)",
  warningMuted: "rgba(251, 191, 36, 0.16)",
  dangerMuted: "rgba(248, 113, 113, 0.16)",

  // ---------------------------------------------------------------------------
  // Deprecated
  //
  // Aliases kept so the pre-migration screens keep compiling. Every one of
  // these resolves to a token above — the value has already changed, only the
  // name is outstanding. Do not use them in new code; replace them with their
  // target when the screen they live on is migrated, then delete the alias.
  // ---------------------------------------------------------------------------
  /** @deprecated Use `textSecondary`. */
  textMuted: "#a8adb8",
  /** @deprecated Use `textSecondary`. Was a duplicate of textMuted's value. */
  textFaint: "#a8adb8",
  /** @deprecated Use `textTertiary`. */
  textDim: "#757b87",
  /** @deprecated Use `textTertiary`. Icons need no separate step. */
  iconFaint: "#757b87",
  /** @deprecated Use `bg`. */
  bgDark: "#0b0b0b",
  /** @deprecated Use `surface`. */
  bgElevated: "#151515",
  /** @deprecated Use `surface`. */
  surfaceMuted: "#151515",
  /** @deprecated Use `surface`. */
  surfaceVariant: "#151515",
  /** @deprecated Use `surfaceInset`. */
  surfaceRaised: "#1e1e1e",

  /**
   * @deprecated Borders are not part of this system. On migration, delete the
   * `borderWidth`/`borderColor` pair outright and let a surface step or spacing
   * do the separating. These resolve to `surfaceInset` so that anything still
   * drawing one reads as a soft edge rather than a hard grey line.
   */
  border: "#1e1e1e",
  /** @deprecated See `border`. */
  borderSubtle: "#1e1e1e",
  /** @deprecated See `border`. */
  borderStrong: "#1e1e1e",
  /** @deprecated See `border`. */
  borderFaint: "#1e1e1e",

  /** @deprecated Text inputs use `surfaceInset` + `text`, like every other well. */
  inputBg: "#1e1e1e",
  /** @deprecated See `inputBg`. */
  inputText: "#ffffff",
};
