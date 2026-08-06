import { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../../../theme/colors";
import { radius, spacing, typography } from "../../../theme/tokens";
import type { UserProfile } from "../../../services/userSession";
import type { ProfileChartPoint, WeeklyChartData, WeeklyChartTotals } from "../hooks/useProfileOverview";
import { TrendChart } from "../../../components/TrendChart";

type IconName = keyof typeof Ionicons.glyphMap;

export function ProfileHero({
  profile,
  name,
  streakDays,
  weeklyWorkouts,
  totalVolume,
  isEditingName,
  onNameChange,
  onSaveName,
  onEditName,
  onPickImage,
  onShareProfile,
}: {
  profile: UserProfile | null;
  name: string;
  streakDays: number;
  weeklyWorkouts: number;
  totalVolume: number;
  isEditingName: boolean;
  onNameChange: (value: string) => void;
  onSaveName: () => void;
  onEditName: () => void;
  onPickImage: () => void;
  onShareProfile?: () => void;
}) {
  const initials = (profile?.name || "F").slice(0, 1).toUpperCase();
  const shareDisabled = !onShareProfile;
  const stats = [
    { label: "WORKOUTS", value: `${weeklyWorkouts}` },
    { label: "STREAK", value: `${streakDays}` },
    { label: "VOLUME", value: formatVolume(totalVolume) },
  ];

  return (
    <View style={styles.hero}>
      <Pressable style={styles.avatarButton} onPress={onPickImage} accessibilityRole="button" accessibilityLabel="Update profile photo">
        <View style={styles.avatarHaloOuter} />
        <View style={styles.avatarHaloInner} />
        {profile?.profileImageUrl ? (
          <Image source={{ uri: profile.profileImageUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </View>
        )}
        <View style={styles.cameraBadge}>
          <Ionicons name="camera" size={12} color={colors.primaryText} />
        </View>
      </Pressable>

      <View style={styles.identityBlock}>
        {isEditingName ? (
          <TextInput
            value={name}
            onChangeText={onNameChange}
            onSubmitEditing={onSaveName}
            onBlur={onSaveName}
            autoFocus
            style={styles.nameInput}
            placeholder="Your name"
            placeholderTextColor={colors.textDim}
          />
        ) : (
          <Pressable onPress={onEditName} style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.nameText}>{profile?.name || "Fytrak Athlete"}</Text>
            <View style={styles.editBubble}>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
            </View>
          </Pressable>
        )}

        <View style={styles.statsRow}>
          {stats.map((stat, idx) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {idx < stats.length - 1 ? <View style={styles.statDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <Pressable style={[styles.ctaButton, styles.ctaButtonMuted]} onPress={onEditName}>
            <Text style={styles.ctaText}>Edit profile</Text>
          </Pressable>
          <Pressable
            style={[styles.ctaButton, shareDisabled && styles.ctaButtonDisabled]}
            onPress={onShareProfile}
            disabled={shareDisabled}
          >
            <Text style={styles.ctaText}>Share profile</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CoachProfileHero({
  profile,
  name,
  traineeCount,
  templateCount,
  experience,
  isEditingName,
  onNameChange,
  onSaveName,
  onEditName,
  onPickImage,
}: {
  profile: UserProfile | null;
  name: string;
  traineeCount: number;
  templateCount: number;
  experience: number;
  isEditingName: boolean;
  onNameChange: (value: string) => void;
  onSaveName: () => void;
  onEditName: () => void;
  onPickImage: () => void;
}) {
  const initials = (profile?.name || "C").slice(0, 1).toUpperCase();
  const stats = [
    { label: "CLIENTS", value: `${traineeCount}` },
    { label: "TEMPLATES", value: `${templateCount}` },
    { label: "YEARS EXP", value: `${experience}` },
  ];

  return (
    <View style={styles.hero}>
      <Pressable style={styles.avatarButton} onPress={onPickImage} accessibilityRole="button" accessibilityLabel="Update profile photo">
        <View style={styles.avatarHaloOuter} />
        <View style={styles.avatarHaloInner} />
        {profile?.profileImageUrl ? (
          <Image source={{ uri: profile.profileImageUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </View>
        )}
        <View style={styles.cameraBadge}>
          <Ionicons name="camera" size={12} color={colors.primaryText} />
        </View>
      </Pressable>

      <View style={styles.identityBlock}>
        {isEditingName ? (
          <TextInput
            value={name}
            onChangeText={onNameChange}
            onSubmitEditing={onSaveName}
            onBlur={onSaveName}
            autoFocus
            style={styles.nameInput}
            placeholder="Your name"
            placeholderTextColor={colors.textDim}
          />
        ) : (
          <Pressable onPress={onEditName} style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.nameText}>{profile?.name || "Fytrak Coach"}</Text>
            <View style={styles.editBubble}>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
            </View>
          </Pressable>
        )}

        <View style={styles.statsRow}>
          {stats.map((stat, idx) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {idx < stats.length - 1 ? <View style={styles.statDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={styles.ctaRow}>
          <Pressable style={[styles.ctaButton, styles.ctaButtonMuted]} onPress={onEditName}>
            <Text style={styles.ctaText}>Edit profile</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ProfileSignalGrid({
  streakDays,
  weeklyWorkouts,
  workoutsCount,
  totalVolume,
}: {
  streakDays: number;
  weeklyWorkouts: number;
  workoutsCount: number;
  totalVolume: number;
}) {
  const streakProgress = Math.min(1, Math.max(0.08, streakDays / 7));
  return (
    <View style={styles.momentumSurface}>
      <View style={styles.momentumHero}>
        <ProgressRing progress={streakProgress} size={118} stroke={8} />
        <View style={styles.ringCenter}>
          <Text style={styles.ringValue}>{streakDays}</Text>
          <Text style={styles.ringLabel}>day streak</Text>
        </View>
      </View>

      <View style={styles.momentumCopy}>
        <Text style={styles.sectionLabel}>Momentum</Text>
        <Text style={styles.momentumTitle}>Consistency engine</Text>
        <Text style={styles.momentumBody}>
          {streakDays > 0 ? "Your rhythm is active. Keep the chain alive today." : "Start a streak and make the profile feel earned."}
        </Text>
        <View style={styles.miniSignalRow}>
          <MiniSignal value={`${weeklyWorkouts}`} label="week" />
          <MiniSignal value={`${workoutsCount}`} label="sessions" />
          <MiniSignal value={formatVolume(totalVolume)} label="volume" />
        </View>
      </View>
    </View>
  );
}

export function ProfileBioSection({
  bio,
  isEditing,
  value,
  onChange,
  onEdit,
  onSave,
}: {
  bio?: string;
  isEditing: boolean;
  value: string;
  onChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
}) {
  const displayBio = bio?.trim() || "Add bio...";

  return (
    <Pressable
      style={styles.bioInline}
      onPress={isEditing ? undefined : onEdit}
      accessibilityRole="button"
      accessibilityLabel={isEditing ? "Edit bio" : "Add bio"}
    >
      {isEditing ? (
        <View style={styles.bioEditRow}>
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onSave}
            autoFocus
            multiline
            maxLength={140}
            placeholder="Add bio..."
            placeholderTextColor={colors.textDim}
            style={styles.bioInlineInput}
          />
          <Pressable style={styles.bioSaveButton} onPress={onSave} accessibilityRole="button">
            <Text style={styles.bioSaveText}>Save</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bioDisplayRow}>
          <Text style={[styles.bioInlineText, !bio?.trim() && styles.bioInlinePlaceholder]}>
            {displayBio}
          </Text>
          <View style={styles.bioEditBubble}>
            <Ionicons name="create-outline" size={12} color={colors.primary} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function CoachExpertiseSection({ specialties }: { specialties?: string[] }) {
  if (!specialties || specialties.length === 0) return null;
  return (
    <View style={styles.expertiseSection}>
      <Text style={styles.sectionLabel}>EXPERTISE</Text>
      <View style={styles.tagGrid}>
        {specialties.map((s) => (
          <View key={s} style={styles.tag}>
            <Text style={styles.tagText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProfileSocialBar() {
  return (
    <View style={styles.socialBar}>
      <SocialAction icon="logo-instagram" label="Instagram" />
      <SocialAction icon="logo-youtube" label="YouTube" />
      <SocialAction icon="logo-tiktok" label="TikTok" />
      <SocialAction icon="link-outline" label="Link" />
    </View>
  );
}

export function ProfileProgressPanel({
  weeklyCharts,
  weeklyTotals,
}: {
  weeklyCharts: WeeklyChartData;
  weeklyTotals: WeeklyChartTotals;
}) {
  const [activeMetric, setActiveMetric] = useState<"duration" | "volume" | "workouts">("duration");
  const configs = {
    duration: {
      label: "Duration",
      icon: "time-outline" as IconName,
      unit: "min",
      axisSuffix: "min",
    },
    volume: {
      label: "Volume",
      icon: "barbell-outline" as IconName,
      unit: "kg",
      axisSuffix: "kg",
    },
    workouts: {
      label: "Workouts",
      icon: "fitness-outline" as IconName,
      unit: "",
      axisSuffix: "",
    },
  } as const;

  const config = configs[activeMetric];
  const totalValue = Math.round(weeklyTotals[activeMetric]);
  const unit = config.unit;
  const chartData = weeklyCharts[activeMetric];

  return (
    <View style={styles.weeklyChart}>
      <Text style={styles.weeklyEyebrow}>This week</Text>
      <View style={styles.weeklyValueRow}>
        <Text style={styles.weeklyValue}>{totalValue}</Text>
        {unit ? <Text style={styles.weeklyUnit}>{unit}</Text> : null}
      </View>

      <View style={styles.weeklyChartFrame}>
        <TrendChart
          data={chartData}
          color={colors.primary}
          height={140}
          emptyLabel="Log workouts to start the signal"
          yAxisLabelSuffix={config.axisSuffix || undefined}
          variant="capture"
        />
      </View>

      <View style={styles.metricToggleRow}>
        {(Object.keys(configs) as Array<keyof typeof configs>).map((key) => {
          const item = configs[key];
          const isActive = activeMetric === key;
          return (
            <Pressable
              key={item.label}
              style={[styles.metricToggle, isActive && styles.metricToggleActive]}
              onPress={() => setActiveMetric(key)}
            >
              <Ionicons
                name={item.icon}
                size={12}
                color={isActive ? colors.primary : colors.textDim}
              />
              <Text style={[styles.metricToggleText, isActive && styles.metricToggleTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProfileNextMove({
  profile,
  completionPercent,
}: {
  profile: UserProfile | null;
  completionPercent: number;
}) {
  const title = "Complete your athlete profile";
  const body = "A complete profile gives your coach better context and makes Fytrak feel more personal.";

  return (
    <View style={styles.nextMove}>
      <View style={styles.nextMoveIcon}>
        <Ionicons name={completionPercent < 100 ? "sparkles" : "checkmark-done"} size={22} color={colors.primary} />
      </View>
      <View style={styles.nextMoveContent}>
        <Text style={styles.nextMoveTitle}>{title}</Text>
        <Text style={styles.nextMoveBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
    </View>
  );
}

export function ProfileAccountPanel({
  profile,
  onLogout,
}: {
  profile: UserProfile | null;
  onLogout: () => void;
}) {
  return (
    <View style={styles.accountPanel}>
      <Pressable 
        style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]} 
        onPress={onLogout}
      >
        <View style={styles.accountButtonContent}>
          <View style={[styles.accountIconBox, { backgroundColor: colors.dangerMuted }]}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          </View>
          <Text style={[styles.accountButtonText, { color: colors.danger }]}>Sign out</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

function ProgressRing({ progress, size, stroke }: { progress: number; size: number; stroke: number }) {
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const dashOffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size} style={styles.ringSvg}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radiusValue}
        stroke={colors.bg}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radiusValue}
        stroke={colors.primary}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        rotation="-90"
        originX={size / 2}
        originY={size / 2}
      />
    </Svg>
  );
}

function MiniSignal({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.miniSignal}>
      <Text style={styles.miniSignalValue}>{value}</Text>
      <Text style={styles.miniSignalLabel}>{label}</Text>
    </View>
  );
}



function SocialAction({ icon, label, compact }: { icon: IconName; label: string; compact?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.socialAction, compact && styles.socialActionCompact, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

function ActionRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress?: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionRow, pressed && onPress && styles.pressed]} onPress={onPress} disabled={!onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null}
    </Pressable>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}m`;
  if (volume >= 1000) return `${Math.round(volume / 1000)}k`;
  return `${Math.round(volume)}`;
}

function formatGoal(goal?: string): string {
  if (!goal || goal === "Not set") return "Set a clear transformation goal";
  return goal.replace(/_/g, " ");
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0,
        shadowRadius: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  avatarButton: {
    position: "relative",
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHaloOuter: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatarHaloInner: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.bgDark,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },
  cameraBadge: {
    position: "absolute",
    end: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surfaceMuted,
  },
  identityBlock: {
    width: "100%",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: "100%",
  },
  nameText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    textAlign: "center",
    maxWidth: 245,
  },
  nameInput: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 0,
    minWidth: 180,
    textAlign: "center",
  },
  editBubble: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  statsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statDivider: {
    position: "absolute",
    end: 0,
    top: 4,
    bottom: 4,
    width: 1,
    backgroundColor: colors.borderSubtle,
  },
  ctaRow: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  ctaButton: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  ctaButtonMuted: {
    backgroundColor: colors.bg,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  bioInline: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bioInlineText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  bioInlinePlaceholder: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
  },
  bioDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  bioEditBubble: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  bioEditRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bioInlineInput: {
    flex: 1,
    minHeight: 36,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    textAlign: "center",
  },
  bioSaveButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  bioSaveText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  momentumSurface: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    padding: spacing.lg,
  },
  momentumHero: {
    width: 126,
    height: 126,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: {
    position: "absolute",
  },
  ringCenter: {
    alignItems: "center",
  },
  ringValue: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  ringLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  momentumCopy: {
    flex: 1,
  },
  momentumTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  momentumBody: {
    color: colors.textMuted,
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  miniSignalRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  miniSignal: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.lg,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  miniSignalValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  miniSignalLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  socialBar: {
    flexDirection: "row",
    alignSelf: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: -spacing.sm,
  },
  socialAction: {
    width: 48,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  socialActionCompact: {
    width: 40,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  weeklyChart: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "flex-start",
  },
  weeklyEyebrow: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  weeklyValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 0,
    marginTop: 2,
  },
  weeklyValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  weeklyUnit: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  weeklyChartFrame: {
    width: "100%",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    position: "relative",
  },
  metricToggleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgDark,
  },
  metricToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  metricToggleActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  metricToggleText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  metricToggleTextActive: {
    color: colors.primary,
  },
  nextMove: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 0,
    padding: spacing.md,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  nextMoveIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  nextMoveContent: {
    flex: 1,
  },
  nextMoveTitle: {
    color: colors.text,
    ...typography.heading,
  },
  nextMoveBody: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    ...typography.bodySmall,
  },
  logoutContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: "transparent",
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  actionRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  actionCopy: {
    flex: 1,
    marginStart: spacing.md,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  actionSubtitle: {
    marginTop: spacing.xxs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  logoutRow: {
    borderBottomWidth: 0,
  },
  logoutIcon: {
    backgroundColor: colors.dangerMuted,
  },
  logoutText: {
    color: colors.danger,
  },
  expertiseSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tagText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  accountPanel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  accountButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  accountIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  accountButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  accountDivider: {
    height: 4,
  },
});
