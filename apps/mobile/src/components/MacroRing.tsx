import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { colors } from "../theme/colors";
import { Typography } from "./Typography";

export const MacroRing = ({ current, target, label }: { current: number, target: number, label: string }) => {
  const size = 120;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeTarget = target > 0 ? target : 2000;
  const progress = Math.min(current / safeTarget, 1);
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
          <Circle stroke="#1c1c1e" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" />
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
          <Typography variant="label" style={{ color: '#888', fontSize: 11 }}>/ {target} kcal</Typography>
        </View>
      </View>
      <Typography variant="label" style={{ color: '#fff', fontSize: 14, marginTop: 8, fontWeight: '700' }}>{label}</Typography>
    </View>
  );
};
