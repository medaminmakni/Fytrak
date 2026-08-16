/*
 * DEPRECATED — no callers.
 *
 * Replaced on Trainee Today by `TodayTargets`, which draws a bar only against a
 * real target instead of a ring that needed a denominator to exist at all.
 * Retained pending device validation of the new Today; see DashboardActionCard.
 */
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { colors } from "../theme/colors";
import { Typography } from "./Typography";

export const MacroRing = ({ current, target, label }: { current: number, target: number | null, label: string }) => {
  const size = 120;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  /*
   * `const safeTarget = target > 0 ? target : 2000` was here — a second
   * invented denominator, and a different number from the 2,100 elsewhere, so
   * the ring and the text under it disagreed about the same missing target.
   * With no target there is no proportion; the arc stays empty.
   */
  const hasTarget = typeof target === "number" && Number.isFinite(target) && target > 0;
  const progress = hasTarget ? Math.min(Math.max(current / (target as number), 0), 1) : 0;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
              <Stop offset="1" stopColor="#d97706" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Circle stroke={colors.surfaceInset} cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" />
          <Circle
            stroke="url(#grad)"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Typography variant="h2" style={{ fontSize: 24, lineHeight: 28 }}>{current}</Typography>
          <Typography variant="label" style={{ color: '#888', fontSize: 11 }}>
            {hasTarget ? `/ ${target} kcal` : "kcal logged"}
          </Typography>
        </View>
      </View>
      <Typography variant="label" style={{ color: '#fff', fontSize: 14, marginTop: 8, fontWeight: '700' }}>{label}</Typography>
    </View>
  );
};
