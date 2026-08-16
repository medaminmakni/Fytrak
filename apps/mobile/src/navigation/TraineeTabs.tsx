import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabScreenProps } from "@react-navigation/material-top-tabs";
import { useNavigation } from "@react-navigation/native";
import { FytrakTabBar } from "./FytrakTabBar";
import { CoachChatScreen } from "../screens/trainee/CoachChatScreen";
import { NutritionScreen } from "../screens/trainee/NutritionScreen";
import { ProgressScreen } from "../screens/trainee/ProgressScreen";
import { TraineeHomeScreen } from "../screens/trainee/TraineeHomeScreen";
import { WorkoutLogScreen } from "../screens/trainee/WorkoutLogScreen";
import { auth } from "../config/firebase";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { ScreenShell } from "../components/ScreenShell";

import { SessionState } from "../state/types";
import type { RootStackNavigation, TraineeTabsParamList } from "./types";

const Tab = createMaterialTopTabNavigator<TraineeTabsParamList>();

export function TraineeTabs({ session }: { session: SessionState }) {
  const navigation = useNavigation<RootStackNavigation>();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBarPosition="bottom"
      screenOptions={{
        lazy: true,
        /*
         * Root tabs support swipe navigation.
         *
         * The bar is bottom-positioned but this is a top-tab navigator, so it
         * ships with horizontal swipe between root destinations. Fytrak is full
         * of horizontal content — the client-day date stepper, chart filter
         * bars, the photo compare slider, exercise rows — and a horizontal drag
         * on those screens was ambiguous: scroll the strip, or change tab. The
         * swipe navigation is intentional and remains available alongside those controls.
         *
         * Tabs change by swiping or by pressing the bottom bar.
         */
        swipeEnabled: true,
      }}
      tabBar={(props) => <FytrakTabBar {...props} />}
    >
      <Tab.Screen name="Workouts" component={WorkoutLogScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Home">
        {(props: MaterialTopTabScreenProps<TraineeTabsParamList, "Home">) => (
          <TraineeHomeScreen
            onQuickAskCoach={() => props.navigation.navigate("Chat")}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen
        name="Chat"
        children={() =>
          session.assignmentStatus === "assigned" && session.selectedCoachId ? (
            <CoachChatScreen
              traineeId={auth.currentUser?.uid || "unknown"}
              coachId={session.selectedCoachId || "unknown"}
            />
          ) : (
            <ChatLockedScreen
              title={session.assignmentStatus === "pending" ? "Waiting for Approval" : "Coach Feature"}
              description={
                session.assignmentStatus === "pending"
                  ? "Direct messaging unlocks after your coach approves the request."
                  : "Connect with a certified coach to unlock direct messaging, personalized plans, and real-time feedback."
              }
              ctaLabel={session.assignmentStatus === "pending" ? "VIEW REQUEST" : "FIND A COACH"}
              onUnlock={() => navigation.navigate(session.assignmentStatus === "pending" ? "PendingCoach" : "CoachAssignment")}
            />
          )
        }
      />
    </Tab.Navigator>
  );
}

function ChatLockedScreen({
  title,
  description,
  ctaLabel,
  onUnlock,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  onUnlock: () => void;
}) {
  return (
    <ScreenShell title="Messages" subtitle="Coach communication" contentStyle={{ paddingBottom: 0 }}>
      <View style={lockedStyles.container}>
        <View style={lockedStyles.iconCircle}>
          <Ionicons name="lock-closed" size={40} color={colors.primary} />
        </View>
        <Text style={lockedStyles.title}>{title}</Text>
        <Text style={lockedStyles.desc}>{description}</Text>
        <Pressable style={lockedStyles.ctaBtn} onPress={onUnlock}>
          <Ionicons name="sparkles" size={18} color="#000" />
          <Text style={lockedStyles.ctaText}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </Pressable>
        <View style={lockedStyles.features}>
          {["Personalized workout plans", "Direct messaging with your coach", "Real-time form corrections", "Custom nutrition guidance"].map((f, i) => (
            <View key={i} style={lockedStyles.featureRow}>
              <View style={lockedStyles.checkCircle}><Ionicons name="checkmark" size={12} color="#000" /></View>
              <Text style={lockedStyles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

const lockedStyles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingBottom: 120, gap: 16 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surfaceInset, marginBottom: 8 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 0.5 },
  desc: { color: colors.textMuted, fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  ctaBtn: { backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, paddingHorizontal: 36, borderRadius: 20, marginTop: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  features: { marginTop: 20, gap: 12, alignSelf: "stretch" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  featureText: { color: "#aaa", fontSize: 13, fontWeight: "600" },
});
