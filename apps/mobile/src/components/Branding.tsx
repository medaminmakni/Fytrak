import type { StyleProp, ViewStyle } from "react-native";
import { BrandLogo } from "./BrandLogo";

interface BrandingProps {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The full logo, for the launch screen.
 *
 * This used to `require` assets/branding/raster/logo_full_light.png — an
 * 8001×8001 PNG, 368KB on disk, decoded to roughly 256MB of bitmap in memory
 * to draw a 320×160 logo. It sat on the very first screen of the app, so every
 * cold start paid for it before anything else could render.
 *
 * It draws the vector instead, which is also what the brand kit requires:
 * "always SVG, never a PNG of the logo".
 *
 * The `variant` prop is gone with the raster pair. There was only ever one
 * call site and it used the default, and the brand has one rule for this —
 * yellow on dark. A light/dark switch was a choice nobody was making.
 */
export const AppLogo = ({ width = 180, height = 80, style }: BrandingProps) => (
  <BrandLogo width={width} height={height} style={style} />
);
