import React, { useState } from "react";
import { StyleSheet, View, Pressable, Text } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/tokens";
import { InsightsTab } from "./progress/InsightsTab";
import { MetricsTab } from "./progress/MetricsTab";
import { PhotosTab } from "./progress/PhotosTab";
import { DailyTab } from "./progress/DailyTab";

type TabType = "Daily" | "Insights" | "Metrics" | "Photos";

export function ProgressScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("Daily");



  return (
    <ScreenShell 
      title="Progress" 
      subtitle="Transformation tracking"
      contentStyle={styles.shellContent}
    >
      <View style={styles.tabBar}>
        <TabButton 
          label="DAILY" 
          active={activeTab === "Daily"} 
          onPress={() => setActiveTab("Daily")} 
        />
        <TabButton 
          label="INSIGHTS" 
          active={activeTab === "Insights"} 
          onPress={() => setActiveTab("Insights")} 
        />
        <TabButton 
          label="METRICS" 
          active={activeTab === "Metrics"} 
          onPress={() => setActiveTab("Metrics")} 
        />
        <TabButton 
          label="PHOTOS" 
          active={activeTab === "Photos"} 
          onPress={() => setActiveTab("Photos")} 
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: activeTab === "Daily" ? "flex" : "none" }}>
          <DailyTab />
        </View>
        <View style={{ flex: 1, display: activeTab === "Insights" ? "flex" : "none" }}>
          <InsightsTab />
        </View>
        <View style={{ flex: 1, display: activeTab === "Metrics" ? "flex" : "none" }}>
          <MetricsTab />
        </View>
        <View style={{ flex: 1, display: activeTab === "Photos" ? "flex" : "none" }}>
          <PhotosTab />
        </View>
      </View>
    </ScreenShell>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable 
      onPress={onPress} 
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {active && <View style={styles.activeLine} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingHorizontal: 0,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1e",
  },
  tabBtn: {
    paddingVertical: 12,
    marginEnd: 24,
    position: "relative",
  },
  tabBtnActive: {
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tabTextActive: {
    color: colors.primary,
  },
  activeLine: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
  },
});
