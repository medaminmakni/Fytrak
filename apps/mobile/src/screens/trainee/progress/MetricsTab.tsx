import { ToastService } from "../../../components/Toast";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View, Pressable, TextInput, Modal, ActivityIndicator, FlatList } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/tokens";
import { Typography } from "../../../components/Typography";
import { Ionicons } from "@expo/vector-icons";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { useBodyMetrics } from "../../../hooks/useBodyMetrics";
import { useUserProfile } from "../../../hooks/useUserProfile";
import { saveBodyMetric } from "../../../services/userSession";
import { BFRow } from "../../../components/BFRow";

export function MetricsTab() {
  const uid = useCurrentUser();
  const { metrics, isLoading } = useBodyMetrics();
  const { profile: userProfile } = useUserProfile();

  const [newWeight, setNewWeight] = useState("");
  const [newBodyFat, setNewBodyFat] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isBFModalVisible, setIsBFModalVisible] = useState(false);

  const calculateBMI = () => {
    if (!metrics[0]?.weight || !userProfile?.height) return "--";
    const heightInM = userProfile.height / 100;
    return (metrics[0].weight / (heightInM * heightInM)).toFixed(1);
  };

  const handleLogMetric = async () => {
    if (!newWeight || isNaN(Number(newWeight))) {
      ToastService.error("Invalid", "Please enter weight.");
      return;
    }
    if (!uid) return;
    try {
      setIsSaving(true);
      await saveBodyMetric(
        uid,
        { weight: Number(newWeight), bodyFat: newBodyFat ? Number(newBodyFat) : undefined },
        userProfile?.timezone
      );
      setNewWeight(""); setNewBodyFat("");
    } catch (error) { console.error(error); } finally { setIsSaving(false); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Typography variant="h2">Metrics</Typography>
        <Typography variant="bodySmall" color={colors.textMuted}>Body composition logs</Typography>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Typography variant="h2">Log Today's Entry</Typography>
          <Pressable onPress={() => setIsBFModalVisible(true)} hitSlop={10}>
            <Typography variant="label" color={colors.primary} style={styles.helpLink}>Estimate BF%</Typography>
          </Pressable>
        </View>
        <View style={styles.metricInputRow}>
          <View style={styles.stepperContainer}>
            <Typography variant="label" color={colors.textMuted} style={styles.inputLabel}>Weight (kg)</Typography>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setNewWeight(prev => (Math.max(0, (Number(prev) || Number(metrics[0]?.weight) || 70) - 0.5)).toString())}>
                <Ionicons name="remove" size={18} color="#fff" />
              </Pressable>
              <TextInput
                style={styles.stepInput}
                keyboardType="decimal-pad"
                value={newWeight}
                onChangeText={setNewWeight}
                placeholder={metrics[0]?.weight?.toString() || "0.0"}
                placeholderTextColor={colors.textDim}
              />
              <Pressable style={styles.stepBtn} onPress={() => setNewWeight(prev => ((Number(prev) || Number(metrics[0]?.weight) || 70) + 0.5).toString())}>
                <Ionicons name="add" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
          <Pressable style={[styles.mainSaveBtn, isSaving && { opacity: 0.6 }]} onPress={handleLogMetric} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="checkmark" size={24} color="#000" />}
          </Pressable>
        </View>

        <View style={styles.secondaryInputRow}>
          <Typography variant="label" color={colors.textDim}>BODY FAT UPDATE (OPTIONAL)</Typography>
          <View style={styles.smallStepper}>
            <Pressable onPress={() => setNewBodyFat(prev => (Math.max(0, (Number(prev) || 15) - 0.5)).toString())}>
              <Ionicons name="remove-circle-outline" size={20} color={colors.iconFaint} />
            </Pressable>
            <TextInput
              style={styles.smallStepInput}
              keyboardType="decimal-pad"
              value={newBodyFat}
              onChangeText={setNewBodyFat}
              placeholder="0.0%"
              placeholderTextColor="#333"
            />
            <Pressable onPress={() => setNewBodyFat(prev => ((Number(prev) || 15) + 0.5).toString())}>
              <Ionicons name="add-circle-outline" size={20} color={colors.iconFaint} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Typography variant="label" color={colors.textMuted}>BMI Index</Typography>
          <Typography variant="metric">{calculateBMI()}</Typography>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Typography variant="label" color={colors.textMuted}>Body Fat</Typography>
          <Typography variant="metric">{metrics[0]?.bodyFat ? `${metrics[0].bodyFat}%` : '--'}</Typography>
        </View>
      </View>

      <View style={styles.historyCard}>
        <Typography variant="h2" style={{ marginBottom: 16 }}>History</Typography>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : (
          metrics.map((item, idx) => (
            <View key={item.id || idx} style={styles.historyRow}>
              <View>
                <Typography variant="body" style={{ fontWeight: "700" }}>{item.weight} kg</Typography>
                <Typography variant="label" color={colors.textMuted}>{new Date(item.date).toLocaleDateString()}</Typography>
              </View>
              {item.bodyFat && (
                <View style={styles.historyBf}>
                  <Typography variant="label" color={colors.primary}>{item.bodyFat}% BF</Typography>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      <Modal visible={isBFModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.estimateBox}>
            <View style={styles.modalHeader}>
              <Typography variant="h2">Estimate Body Fat</Typography>
              <Pressable onPress={() => setIsBFModalVisible(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>
            <Typography variant="bodySmall" color={colors.textMuted} style={{ marginBottom: 20 }}>
              Select the category that best describes your look:
            </Typography>
            <ScrollView style={{ maxHeight: 400 }}>
              <BFRow label="Athletic" male="6-13%" female="14-20%" desc="Abs are very visible, muscle definition is sharp." onSelect={() => { setNewBodyFat("10"); setIsBFModalVisible(false); }} />
              <BFRow label="Fit" male="14-17%" female="21-24%" desc="Abs are faint or visible in right light." onSelect={() => { setNewBodyFat("15"); setIsBFModalVisible(false); }} />
              <BFRow label="Acceptable" male="18-24%" female="25-31%" desc="Flat stomach but no abs. Healthy look." onSelect={() => { setNewBodyFat("20"); setIsBFModalVisible(false); }} />
              <BFRow label="High" male="25%+" female="32%+" desc="Soft look, no muscle definition visible." onSelect={() => { setNewBodyFat("30"); setIsBFModalVisible(false); }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.sm,
    paddingTop: 0,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  helpLink: {
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  metricInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  stepperContainer: {
    flex: 1,
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginStart: 4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInset,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    height: 56,
  },
  stepBtn: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  stepInput: {
    flex: 1,
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  mainSaveBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryInputRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceInset,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smallStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallStepInput: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    width: 40,
    textAlign: "center",
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: "100%",
    backgroundColor: colors.surfaceInset,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    marginBottom: 16,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceInset,
  },
  historyBf: {
    backgroundColor: colors.surfaceInset,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 24,
  },
  estimateBox: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
});
