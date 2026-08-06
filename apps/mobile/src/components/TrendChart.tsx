/**
 * TrendChart — Wraps LineChart with the standard Fytrak chart configuration.
 * Optimized for both high-density "Capture" views and detailed "Insight" trends.
 */
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Typography } from "./Typography";
import { colors } from "../theme/colors";

type TrendChartProps = {
  data: any[];
  color: string;
  yAxisOffset?: number;
  height?: number;
  emptyLabel?: string;
  yAxisLabelSuffix?: string;
  variant?: "default" | "capture";
};

export function TrendChart({
  data,
  color,
  yAxisOffset = 0,
  height = 200,
  emptyLabel = "Log workouts to start the signal",
  yAxisLabelSuffix = "",
  variant = "default",
}: TrendChartProps) {
  const { width: windowWidth } = Dimensions.get("window");
  const isCapture = variant === "capture";
  
  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Typography variant="label" color={colors.textDim}>{emptyLabel}</Typography>
      </View>
    );
  }

  // SCALE CALCULATION (ROBUST FIX)
  const values = data.map(d => Number(d.value) || 0);
  const maxVal = Math.max(...values);
  const effectiveOffset = yAxisOffset > 0 ? yAxisOffset : 0;
  const range = Math.max(1, maxVal - effectiveOffset);
  const noOfSections = isCapture ? 2 : 3;

  const getNiceStep = (r: number) => {
    const rawStep = r / noOfSections;
    if (rawStep <= 1) return 1;
    if (rawStep <= 5) return 5;
    if (rawStep <= 10) return 10;
    if (rawStep <= 25) return 25;
    if (rawStep <= 50) return 50;
    if (rawStep <= 100) return 100;
    return Math.ceil(rawStep / 10) * 10;
  };

  const stepValue = getNiceStep(range);

  return (
    <View style={styles.container}>
      <LineChart
        areaChart
        data={data}
        // Sharp Technical Lines (Matches Profile Page preference)
        curved={false} 
        height={height}
        width={windowWidth - (isCapture ? 60 : 80)}
        initialSpacing={20}
        endSpacing={20}
        spacing={60}
        color={color}
        thickness={3}
        
        // Premium Gradient Fill
        startFillColor={color}
        endFillColor="transparent"
        startOpacity={0.35}
        endOpacity={0}
        
        // Scale Config
        yAxisOffset={effectiveOffset}
        noOfSections={noOfSections}
        stepValue={stepValue}
        yAxisLabelSuffix={yAxisLabelSuffix}
        
        // Rules & Axis
        rulesType="solid"
        rulesColor="rgba(255,255,255,0.05)"
        xAxisThickness={0}
        yAxisThickness={0}
        hideRules={isCapture}
        
        // Text Styles
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        yAxisTextNumberOfLines={1}
        xAxisLabelsVerticalShift={10}
        
        // Interaction
        hideDataPoints={false}
        dataPointsColor={color}
        dataPointsRadius={4}
        focusEnabled={!isCapture}
        showStripOnFocus={!isCapture}
        stripColor={`${color}33`}
        stripWidth={2}
        showTextOnFocus={!isCapture}
        focusedDataPointColor="#fff"
        focusedDataPointRadius={6}
        
        pointerConfig={
          isCapture
            ? undefined
            : {
                pointerStripColor: `${color}44`,
                pointerStripWidth: 1,
                pointerColor: "#fff",
                radius: 5,
                pointerLabelWidth: 80,
                pointerLabelHeight: 30,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: any) => (
                  <View style={styles.pointerBadge}>
                    <Text style={styles.pointerText}>{items[0].value}{yAxisLabelSuffix}</Text>
                  </View>
                ),
              }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginStart: -15,
    alignItems: "center",
  },
  axisText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
  },
  empty: {
    justifyContent: "center",
    alignItems: "center",
  },
  pointerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: "center",
  },
  pointerText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 12,
  },
});
