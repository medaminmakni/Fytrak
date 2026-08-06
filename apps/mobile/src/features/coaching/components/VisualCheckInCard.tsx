import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import { toSafeDate } from "../../../utils/chartFilters";

/**
 * Coach-side progress photo status — METADATA ONLY. No image bytes.
 *
 * WHY THERE IS NO IMAGE HERE
 *
 * Progress photos are uploaded to Cloudinary with an unsigned preset, so the
 * stored `url` is a permanent, public, unauthenticated CDN link. Nothing about
 * it can be revoked: not ending an assignment, not deleting the Firestore
 * document, not any rule we could write. Once the bytes have been fetched they
 * are in the OS image cache and out of our control.
 *
 * This card used to mount <Image source={{ uri: photo.url }} /> automatically,
 * so opening a client's report silently pulled that client's body photo onto
 * the coach's device and into its cache.
 *
 * There is deliberately no "View once" button either. A button implies a
 * guarantee — that access is counted, limited, revocable — and on a public URL
 * fetched by an untrusted client, none of that is true. A false promise is
 * worse than a disabled feature.
 *
 * Secure coach viewing needs private storage plus short-lived server-signed
 * URLs. Deferred to the custom backend; see V0_RUNTIME_ARCHITECTURE.md.
 */
type VisualCheckInCardProps = {
  /**
   * Metadata only. Deliberately does NOT accept `url`, so the privacy boundary
   * cannot be crossed by accident — a caller passing a URL will not compile.
   */
  photo?: { createdAt?: unknown; date?: string } | null;
  /** Client-local day being reviewed, so the coach knows what this covers. */
  dayLabel?: string;
};

export function VisualCheckInCard({ photo, dayLabel = "today" }: VisualCheckInCardProps) {
  const loggedAt = photo?.createdAt ? toSafeDate(photo.createdAt) : null;
  const loggedAtLabel = loggedAt && !Number.isNaN(loggedAt.getTime())
    ? loggedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
          <Ionicons name="camera" size={14} color={colors.success} />
        </View>
        <Typography variant="label" color={colors.success} style={styles.title}>VISUAL CHECK-IN</Typography>
      </View>

      {photo ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Typography variant="body">Progress photo logged</Typography>
              <Typography variant="label" color={colors.textDim}>
                {photo.date ? `Client date ${photo.date}` : `Logged ${dayLabel}`}
                {loggedAtLabel ? ` · ${loggedAtLabel}` : ""}
              </Typography>
            </View>
          </View>
          <Typography variant="label" color={colors.textDim} style={styles.note}>
            Photos are not shown here. Ask your client to share it directly if you
            need to see it.
          </Typography>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Typography variant="label" color={colors.textDim}>No progress photo logged {dayLabel}</Typography>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginStart: 4 },
  iconBox: { width: 26, height: 26, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius["2xl"], padding: spacing.xl, borderWidth: 1, borderColor: colors.borderStrong, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  note: { lineHeight: 16 },
  emptyCard: { backgroundColor: colors.bgDark, borderRadius: radius.xl, padding: spacing["3xl"], alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: 'dashed' },
});
