/**
 * Fytrak spacing, radius, type and sizing scales.
 *
 * Every number a screen needs comes from here. If a layout wants a value that
 * is not on one of these scales, the layout is wrong — not the scale.
 */

/**
 * The spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40.
 *
 * Space is the divider in this system. A gap does the job an outline used to,
 * which is why the steps get coarse quickly — 24 and 32 are meant to be
 * reachable, not exceptional.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  /** @deprecated Not on the scale. Use `xs`. */
  xxs: 4,
};

/** Fixed layout measurements that are not free choices. */
export const layout = {
  /** Horizontal padding on every screen. Identical everywhere, no exceptions. */
  screenGutter: 20,
  /** Vertical gap between two sections of a screen. */
  sectionGap: 32,
};

/**
 * Three radii, matched to the three surfaces.
 *
 * `card` for anything sitting directly on the page, `nested` for a region
 * inside a card, `pill` for chips and round controls. Prefer these names over
 * the t-shirt sizes below.
 */
export const radius = {
  /** Top-level card, sheet, or bar. */
  card: 20,
  /** A surface nested inside another surface. */
  nested: 12,
  /** Chips, pills, avatars, round buttons. */
  pill: 999,
  /** The floating tab capsule. Larger than `card` so the ends read as round. */
  tabBar: 22,
  /** The active cell inside the capsule: `tabBar` minus the 5pt padding. */
  tabCell: 17,

  /** @deprecated Use `nested`. */
  xs: 12,
  /** @deprecated Use `nested`. */
  sm: 12,
  /** @deprecated Use `nested`. */
  md: 12,
  /** @deprecated Use `card`. */
  lg: 20,
  /** @deprecated Use `card`. */
  xl: 20,
  /** @deprecated Use `card`. */
  "2xl": 20,
};

/**
 * The type scale.
 *
 * Floor is 12px — nothing renders smaller. Sentence case throughout and no
 * letter-spacing: both were there to make small text look deliberate, and both
 * break the moment the string is translated into Arabic. Weights are capped at
 * 700 apart from `display`, so the scale reads as a hierarchy rather than as
 * shouting.
 *
 * Numerals in `metric` should be rendered with tabular figures
 * (`fontVariant: ["tabular-nums"]`) so counters do not jitter as they count.
 */
export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800" as const,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700" as const,
  },
  heading: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  /** Large numerals: a weight total, a calorie count, a streak. */
  metric: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums" as const],
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  /** Body copy that needs to carry emphasis without becoming a heading. */
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  /** The floor. Field labels, captions, metadata, chip text. */
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
  /** Button text. Reuses the `bodyStrong` step — buttons are not their own scale. */
  button: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600" as const,
  },

  /**
   * Tab bar labels only.
   *
   * A step below `label` because five of them share one 390pt row and the
   * longest ("Nutrition") has to fit a 70pt cell without truncating. It is the
   * one place a smaller size is a layout requirement rather than a decoration,
   * which is why it is a named token instead of an inline override.
   */
  tabLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600" as const,
  },

  /** @deprecated Use `label`. There is no 13px step. */
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
  /** @deprecated Use `label`. The uppercase variant no longer exists. */
  labelNeutral: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
  /** @deprecated Use `button`. */
  buttonNeutral: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
};

/** Icons come in three sizes. A fourth is a design mistake, not a requirement. */
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  /** @deprecated Not on the scale. Use `lg`. */
  xl: 24,
};

export const touchTarget = {
  /** 44×44, always. Anything tappable smaller than this needs `hitSlop`. */
  min: 44,
  comfortable: 48,
  large: 56,
};

export const motion = {
  fast: 140,
  standard: 220,
  slow: 320,
};
