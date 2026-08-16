import React, { useState } from "react";
import { View, StyleSheet, Text, Image, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "../../../theme/tokens";
import { Typography } from "../../../components/Typography";
import { toSafeDate } from "../../../utils/chartFilters";
import type { ProgressPhoto } from "../../../services/userSession";
import { colors } from "../../../theme/colors";

type DailyVisualReportProps = {
  todayPhoto?: ProgressPhoto;
};

export function DailyVisualReport({ todayPhoto }: DailyVisualReportProps) {
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="camera" size={18} color="#10b981" />
        <Text style={[styles.sectionTitle, { color: "#10b981" }]}>VISUAL CHECK-IN</Text>
      </View>
      {todayPhoto ? (
        <View style={styles.card}>
          <Pressable onPress={() => setViewerPhoto(todayPhoto.url)}>
            <Image source={{ uri: todayPhoto.url }} style={styles.todayPhoto} resizeMode="cover" />
          </Pressable>
          <View style={styles.photoMeta}>
            <Typography variant="label" color={colors.textMuted}>
              Snapshot logged at {toSafeDate(todayPhoto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Typography variant="label" color={colors.textDim}>No progress photo logged today</Typography>
        </View>
      )}

      <Modal visible={!!viewerPhoto} transparent={true} animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerPhoto(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </Pressable>
          {viewerPhoto && (
            <Image source={{ uri: viewerPhoto }} style={styles.viewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginStart: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: "#222" },
  todayPhoto: { width: "100%", height: 260, borderRadius: radius.lg, backgroundColor: colors.surface },
  photoMeta: { marginTop: spacing.md, alignItems: 'center' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing["4xl"], alignItems: 'center', borderWidth: 1, borderColor: "#222", borderStyle: "dashed" },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8 },
  viewerImage: { width: "100%", height: "80%" },
});
