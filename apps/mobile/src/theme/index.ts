/**
 * The design system's single entry point.
 *
 * Prefer `import { colors, spacing } from "../../theme"` over reaching into
 * `theme/colors` or `theme/tokens` directly.
 */
export { colors } from "./colors";
export {
  spacing,
  layout,
  radius,
  typography,
  iconSize,
  touchTarget,
  motion,
} from "./tokens";
export { elevation, type ElevationLevel } from "./elevation";
