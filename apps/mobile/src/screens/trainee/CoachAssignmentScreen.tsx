import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { fetchCoaches, type Coach, type CoachRequestPayload } from "../../services/userSession";
import type { AssignmentStatus } from "../../state/types";

const CATEGORIES = ["All", "Powerlifting", "Bodybuilding", "Weight Loss", "Yoga", "Endurance"];

type CoachAssignmentScreenProps = {
  onSendRequest: (coach: CoachRequestPayload) => Promise<void>;
  assignmentStatus: AssignmentStatus;
  onRequestUnavailable: (status: "pending" | "assigned") => void;
};

export function CoachAssignmentScreen({
  onSendRequest,
  assignmentStatus,
  onRequestUnavailable,
}: CoachAssignmentScreenProps) {
  const [mode, setMode] = useState<"invite" | "discover" | "onboarding">("discover");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [introMessage, setIntroMessage] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSentName, setRequestSentName] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [coachesList, setCoachesList] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (assignmentStatus === "pending" || assignmentStatus === "assigned") {
      onRequestUnavailable(assignmentStatus);
    }
  }, [assignmentStatus, onRequestUnavailable]);

  useEffect(() => {
    const loadCoaches = async () => {
      try {
        const fetched = await fetchCoaches();
        setCoachesList(fetched);
      } catch (error) {
        console.error("Failed to load coaches:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCoaches();
  }, []);

  const filteredCoaches = useMemo(() => {
    return coachesList
      .filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === "All" ||
          c.specialties.some(s => s.toLowerCase() === selectedCategory.toLowerCase());
        return matchesSearch && matchesCategory;
      });
  }, [coachesList, searchQuery, selectedCategory]);

  const selectedCoach = useMemo(() => {
    if (mode === "invite") {
      return {
        id: coachCode.trim(),
        name: "Invited coach",
      };
    }
    const found = coachesList.find((coach) => coach.id === selectedCoachId);
    return found ? { id: found.id, name: found.name } : null;
  }, [coachCode, coachesList, mode, selectedCoachId]);

  const canSubmit = useMemo(() => {
    if (mode === "invite") {
      return coachCode.trim().length > 0;
    }
    return Boolean(selectedCoachId);
  }, [coachCode, coachEmail, mode, selectedCoachId]);

  const handleSendRequest = async () => {
    if (!selectedCoach || isSubmitting || assignmentStatus === "pending" || assignmentStatus === "assigned") return;

    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onSendRequest(selectedCoach);
      setRequestSentName(selectedCoach.name);
    } catch (error) {
      console.error("Failed to send coach request:", error);
      setErrorText(
        mode === "invite"
          ? "Could not send this request. Make sure the coach ID is correct."
          : "Could not send this request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Coaching"
      subtitle="The fastest way to reach your goals"
      contentStyle={styles.shellContent}
    >
      {requestSentName ? (
        <View style={styles.requestSentCard}>
          <View style={styles.requestSentIcon}>
            <Ionicons name="hourglass-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.requestSentTitle}>Request Sent</Text>
          <Text style={styles.requestSentText}>
            Waiting for {requestSentName} to approve your coaching request. You can keep logging workouts, meals, and progress while you wait.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loaderText}>Curating top experts...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* ONBOARDING PROMO */}
          {!searchQuery && selectedCategory === "All" && mode === "discover" && (
            <View style={styles.promoCard}>
              <View style={styles.promoIcon}>
                <Ionicons name="sparkles" size={24} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>Why get a coach?</Text>
                <Text style={styles.promoDesc}>
                  Users with a coach reach their goals 3x faster through personalized plans and real-time form checks.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, mode === "discover" && styles.tabActive]}
              onPress={() => setMode("discover")}
            >
              <Ionicons name="compass" size={16} color={mode === "discover" ? "#000" : colors.textMuted} />
              <Text style={[styles.tabText, mode === "discover" && styles.tabTextActive]}>Discover</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === "invite" && styles.tabActive]}
              onPress={() => setMode("invite")}
            >
              <Ionicons name="mail-open" size={16} color={mode === "invite" ? "#000" : colors.textMuted} />
              <Text style={[styles.tabText, mode === "invite" && styles.tabTextActive]}>Invite</Text>
            </Pressable>
          </View>

          {mode === "discover" ? (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  placeholder="Search coaches..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.coachList}>
                {filteredCoaches.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={48} color="#333" />
                    <Text style={styles.emptyText}>No experts found in {selectedCategory}.</Text>
                  </View>
                ) : (
                  filteredCoaches.map((coach) => {
                    const isSelected = selectedCoachId === coach.id;
                    return (
                      <Pressable
                        key={coach.id}
                        onPress={() => setSelectedCoachId(coach.id)}
                        style={[styles.coachCard, isSelected && styles.coachCardActive]}
                      >
                        <View style={styles.coachAvatar}>
                          {coach.profileImageUrl ? (
                            <Image
                              source={{ uri: coach.profileImageUrl }}
                              style={styles.avatarImage}
                              accessibilityLabel={`${coach.name}'s profile photo`}
                            />
                          ) : (
                            <Text style={styles.avatarText}>{coach.name[0]}</Text>
                          )}
                          {coach.verified && (
                            <View style={styles.verifiedIcon}>
                              <Ionicons name="checkmark-sharp" size={10} color="#000" />
                            </View>
                          )}
                        </View>

                        <View style={styles.coachInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.coachName}>{coach.name}</Text>
                            <View style={styles.ratingBox}>
                              <Ionicons name="star" size={12} color={colors.primary} />
                              <Text style={styles.ratingText}>{coach.rating}</Text>
                            </View>
                          </View>
                          <Text style={styles.specialties}>{coach.specialties.join(", ")}</Text>
                          <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                              <Text style={styles.metaText}>{coach.responseTime}</Text>
                            </View>
                            <View style={styles.metaItem}>
                              <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                              <Text style={styles.metaText}>{coach.clients}+ clients</Text>
                            </View>
                          </View>
                        </View>

                        {isSelected && (
                          <View style={styles.selectedMarker}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </>
          ) : (
            <View style={styles.inviteForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Coach ID</Text>
                <TextInput
                  placeholder="Enter the exact coach ID"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={coachCode}
                  onChangeText={setCoachCode}
                />
              </View>
              <View style={styles.dividerBox}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>EMAIL LOOKUP COMING LATER</Text>
                <View style={styles.dividerLine} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Coach Email</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Use discover or enter coach ID for now"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.disabledInput]}
                  value={coachEmail}
                  onChangeText={setCoachEmail}
                  editable={false}
                />
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.label}>Intro Message (optional)</Text>
            <TextInput
              multiline
              placeholder="Hi coach, I'm ready to transform my physique..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.messageInput]}
              value={introMessage}
              onChangeText={setIntroMessage}
            />

            <Pressable
              style={[styles.submitBtn, (!canSubmit || isSubmitting) && styles.submitBtnDisabled]}
              disabled={!canSubmit || isSubmitting}
              onPress={() => void handleSendRequest()}
            >
              {isSubmitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitBtnText}>SEND REQUEST</Text>}
              <Ionicons name="arrow-forward" size={18} color={colors.primaryText} />
            </Pressable>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          </View>
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingBottom: 0,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loaderText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: {
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#000",
  },
  promoCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
    marginTop: 10,
    alignItems: "center",
  },
  promoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoTitle: {
    color: "#000",
    fontSize: 18,
    fontWeight: "900",
  },
  promoDesc: {
    color: "rgba(0,0,0,0.7)",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  categoryScroll: {
    paddingBottom: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surfaceInset,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#000",
    fontWeight: "800",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  coachList: {
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  coachCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
    alignItems: "center",
    gap: 16,
  },
  coachCardActive: {
    borderColor: colors.primary,
    backgroundColor: "#1a1a10",
  },
  coachAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#333",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  verifiedIcon: {
    position: "absolute",
    bottom: 0,
    end: 0,
    backgroundColor: colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  coachInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coachName: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInset,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  ratingText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  specialties: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  selectedMarker: {
    marginStart: 4,
  },
  inviteForm: {
    gap: 20,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginStart: 2,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#000000",
    fontSize: 15,
    fontWeight: "600",
  },
  disabledInput: {
    opacity: 0.55,
  },
  dividerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceInset,
  },
  dividerText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "900",
  },
  footer: {
    gap: 12,
    marginTop: 20,
  },
  messageInput: {
    height: 100,
    textAlignVertical: "top",
    backgroundColor: colors.surfaceInset,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#333",
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: colors.primaryText,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 1,
  },
  requestSentCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  requestSentIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  requestSentTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  requestSentText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 21,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
