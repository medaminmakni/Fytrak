import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { saveAssignmentStatus } from "../../services/userSession";
import { auth } from "../../config/firebase";
import { ToastService } from "../../components/Toast";
import { logOut } from "../../services/auth";

type PendingCoachScreenProps = {
  coachName: string | null;
};

export function PendingCoachScreen({ coachName }: PendingCoachScreenProps) {
  const handleLogout = async () => {
    try {
      await logOut();
      ToastService.info("Signed out", "Your Fytrak session has been closed.");
    } catch (error) {
      ToastService.error("Sign out failed", "Please try again.");
    }
  };

  const handleCancelRequest = () => {
    ToastService.confirm({
      title: "Cancel request",
      message: "Are you sure you want to cancel your coach assignment request?",
      cancelLabel: "Keep it",
      confirmLabel: "Cancel request",
      destructive: true,
      onConfirm: async () => {
        if (auth.currentUser) {
          await saveAssignmentStatus(auth.currentUser.uid, "unassigned");
          ToastService.info("Request cancelled", "You can choose another coach anytime.");
        }
      },
    });
  };

  return (
    <ScreenShell
      title="Request sent"
      subtitle="Waiting for coach approval"
      contentStyle={styles.shellContent}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.statusBadge}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.statusText}>PENDING APPROVAL</Text>
          </View>

          <Text style={styles.title}>Your request is with {coachName ?? "your coach"}</Text>
          <Text style={styles.description}>
            While your coach reviews your profile, you can still use these features to stay on track.
          </Text>

          <View style={styles.featureGrid}>
            <FeatureItem icon="chatbubbles" label="Direct Chat" sub="Unlocks after coach approval" />
            <FeatureItem icon="nutrition" label="Macro Tracking" sub="Log your meals as usual" />
            <FeatureItem icon="stats-chart" label="Daily Metrics" sub="Track weight and activity" />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
            <Text style={styles.logoutBtnText}>LOG OUT</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={handleCancelRequest}>
            <Ionicons name="close-circle-outline" size={20} color="#ff4444" />
            <Text style={styles.cancelBtnText}>CANCEL REQUEST</Text>
          </Pressable>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Once approved, your workout plans and advanced tracking will unlock automatically.
          </Text>
        </View>
      </View>
    </ScreenShell>
  );
}

function FeatureItem({ icon, label, sub }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.featureInfo}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingBottom: 20,
  },
  container: {
    paddingTop: 10,
    gap: 20,
  },
  card: {
    backgroundColor: "#161616",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2c2c2e",
    alignItems: "center",
    gap: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22251a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#3a401c",
  },
  statusText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 10,
  },
  featureGrid: {
    width: "100%",
    gap: 16,
    marginTop: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#1c1c1e",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2c2c2e",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
    justifyContent: "center",
  },
  featureInfo: {
    flex: 1,
    gap: 2,
  },
  featureLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  featureSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  actions: {
    gap: 12,
  },
  logoutBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#1c1c1e",
    borderWidth: 1,
    borderColor: "#2c2c2e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  logoutBtnText: {
    color: colors.textMuted,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  cancelBtnText: {
    color: "#ff4444",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161616",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2c2c2e",
  },
  infoText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
});
