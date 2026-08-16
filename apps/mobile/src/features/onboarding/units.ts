/**
 * Metric and imperial, for display only.
 *
 * Height is always STORED in centimetres and weight in kilograms, whichever
 * unit the person is reading. Converting on the way in and out of storage would
 * accumulate rounding error every time someone toggled — 178cm → 5'10" → 178cm
 * is lossy, and a profile that drifts a centimetre per visit is worse than one
 * that never offered feet at all.
 *
 * So the slider always moves centimetres; these functions only decide how that
 * number is spelled.
 */

export type UnitSystem = "metric" | "imperial";

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const LB_PER_KG = 2.20462;

/** Centimetres as whole feet and inches. */
export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  if (!Number.isFinite(cm) || cm <= 0) return { feet: 0, inches: 0 };
  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return { feet, inches };
};

/**
 * The height, spelled for the chosen system.
 *
 * Imperial renders as `5'10"` rather than a decimal — nobody says "5.83 feet",
 * and a decimal foot is the kind of number that looks like a bug.
 */
export const formatHeight = (cm: number, system: UnitSystem): string => {
  if (!Number.isFinite(cm) || cm <= 0) return "—";
  if (system === "metric") return `${Math.round(cm)}`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
};

/** The unit suffix, so the value and its unit can be styled separately. */
export const heightUnitLabel = (system: UnitSystem): string => (system === "metric" ? "cm" : "");

export const kgToPounds = (kg: number): number =>
  Number.isFinite(kg) && kg > 0 ? Math.round(kg * LB_PER_KG) : 0;

export const formatWeight = (kg: number, system: UnitSystem): string => {
  if (!Number.isFinite(kg) || kg <= 0) return "—";
  return system === "metric" ? `${Math.round(kg)}` : `${kgToPounds(kg)}`;
};

export const weightUnitLabel = (system: UnitSystem): string => (system === "metric" ? "kg" : "lb");

/**
 * The range each metric may take, in stored units.
 *
 * Bounds rather than free entry: a slider that reaches 0 or 400cm produces a
 * calorie budget that is arithmetically valid and physically nonsense, and this
 * screen feeds exactly that calculation.
 */
export const HEIGHT_RANGE_CM = { min: 120, max: 220 } as const;
export const WEIGHT_RANGE_KG = { min: 30, max: 200 } as const;

export const clampHeightCm = (cm: number): number =>
  Math.round(Math.min(Math.max(cm, HEIGHT_RANGE_CM.min), HEIGHT_RANGE_CM.max));

export const clampWeightKg = (kg: number): number =>
  Math.round(Math.min(Math.max(kg, WEIGHT_RANGE_KG.min), WEIGHT_RANGE_KG.max));

/**
 * How large to draw the figure, 0–1 across the height range.
 *
 * The illustration is a proportion, not a measurement: it tells someone their
 * drag registered. It is deliberately compressed into a narrow band so a 120cm
 * person is not rendered as a third of the frame, which would read as mockery
 * rather than feedback.
 */
export const figureScaleForHeight = (cm: number): number => {
  const clamped = clampHeightCm(cm);
  const position = (clamped - HEIGHT_RANGE_CM.min) / (HEIGHT_RANGE_CM.max - HEIGHT_RANGE_CM.min);
  return 0.82 + position * 0.18;
};

/** Width multiplier from weight, on the same principle. */
export const figureWidthForWeight = (kg: number): number => {
  const clamped = clampWeightKg(kg);
  const position = (clamped - WEIGHT_RANGE_KG.min) / (WEIGHT_RANGE_KG.max - WEIGHT_RANGE_KG.min);
  return 0.9 + position * 0.2;
};
