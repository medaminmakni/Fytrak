/**
 * ChartFilterBar — Shared 1W/1M/3M/1Y/ALL filter row.
 * Extracted from ProgressScreen where it was duplicated 2x.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { Typography } from "./Typography";
import { colors } from "../theme/colors";
import type { ChartFilter } from "../utils/chartFilters";

const FILTERS: ChartFilter[] = ["1W", "1M", "3M", "1Y", "ALL"];

type ChartFilterBarProps = {
  value: ChartFilter;
  onChange: (filter: ChartFilter) => void;
};

export function ChartFilterBar({ value, onChange }: ChartFilterBarProps) {
  return (
    <View style={styles.container}>
      {FILTERS.map((f) => (
        <Pressable
          key={f}
          onPress={() => onChange(f)}
          style={[styles.btn, value === f && styles.btnActive]}
        >
          <Typography style={[styles.text, value === f && styles.textActive]}>
            {f.toUpperCase()}
          </Typography>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
  },
  btnActive: {
    backgroundColor: colors.primary,
  },
  text: {
    color: "#555",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  textActive: {
    color: "#000",
  },
});
