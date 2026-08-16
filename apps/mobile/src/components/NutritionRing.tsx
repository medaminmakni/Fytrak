import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { colors } from "../theme/colors";
import { Typography } from "./Typography";
import { calculateNutritionProgress } from "../features/nutrition/nutritionTargets";

interface NutritionRingProps {
  current: number;
  /** Null when the trainee has no calorie target. */
  target: number | null;
}

export const NutritionRing = ({ current, target }: NutritionRingProps) => {
  const size = 100;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Same invented 2,000 denominator as MacroRing carried. Removed: with no
  // target there is nothing to be a proportion of.
  const { progress, percent } = calculateNutritionProgress(current, target);
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gradNut" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
            <Stop offset="1" stopColor="#d97706" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Circle stroke={colors.surfaceInset} cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" />
        <Circle
          stroke="url(#gradNut)"
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
      <View style={styles.overlay}>
        <Typography variant="h2" style={styles.percentage}>
          {percent === null ? "--" : `${percent}%`}
        </Typography>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    width: 100, 
    height: 100, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  overlay: { 
    position: 'absolute', 
    alignItems: 'center' 
  },
  percentage: { 
    fontSize: 18, 
    lineHeight: 22 
  },
});
