import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenShell } from "../../components/ScreenShell";
import { uploadChatImage } from "../../services/cloudinaryUpload";
import { ChatMessage } from "../../types/chat";
import { colors } from "../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import {
  sendChatMessage,
  subscribeToAssignmentThreadId,
  subscribeToChatMessages,
} from "../../services/chatService";
import { useUserProfile } from "../../hooks/useUserProfile";
import { clearCoachUnread, subscribeToUserProfile } from "../../services/userSession";
import { useCurrentUser } from "../../hooks/useCurrentUser";

const formatTime = (value: string): string => {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const keyExtractor = (item: ChatMessage) => item.id;

const isSameCalendarDay = (a: string, b: string): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toDateString() === db.toDateString();
};

/**
 * "Today" / "Yesterday" / a date. Uses the reader's own device day, which is
 * correct here: unlike a client's logged workout, a message separator is about
 * when the reader is looking, not about whose calendar the data belongs to.
 */
const formatDayLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
};

type CoachChatScreenProps = {
  traineeId: string;
  coachId: string;
  traineeName?: string;
  /** Assignment-scoped thread id, supplied by the coach inbox when known. */
  threadId?: string;
};

export function CoachChatScreen({ traineeId, coachId, traineeName, threadId: threadIdProp }: CoachChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const insets = useSafeAreaInsets();
  /*
   * How much of endCoordinates.height the safe area has already covered differs
   * by platform, and getting this wrong clips the composer:
   *
   * - iOS reports the keyboard from the bottom of the *window*, so the height
   *   already includes the home-indicator inset that SafeAreaView also pads.
   *   Subtract it or the composer floats above the keyboard.
   * - Android under edge-to-edge draws the keyboard over the gesture-nav area,
   *   and SafeAreaView's bottom inset is not additive with it. Subtracting
   *   insets.bottom here left the composer sitting ~24dp behind the keyboard.
   *   Use the raw height.
   */
  const keyboardPadding = !isKeyboardVisible
    ? 0
    : Platform.OS === "ios"
      ? Math.max(keyboardHeight - insets.bottom, 0)
      : keyboardHeight;
  const [resolvedThreadId, setResolvedThreadId] = useState<string | null>(threadIdProp || null);
  const currentUid = useCurrentUser();

  /*
   * The composer is lifted by measuring the keyboard, not by KeyboardAvoidingView.
   *
   * The manifest already sets windowSoftInputMode="adjustResize", which used to
   * be enough — but Expo SDK 54 enforces Android edge-to-edge, and under that
   * the window no longer resizes for the keyboard. The app keeps its full
   * height and simply draws behind it, so a padding-based
   * KeyboardAvoidingView has nothing to react to and the composer stays put
   * under the keyboard.
   *
   * Reading endCoordinates.height and padding by exactly that much works on
   * both platforms and needs no extra dependency.
   */
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // The coach arrives with the active thread id from the inbox. The trainee
  // resolves assignment.threadId from the backend-owned activeAssignmentId.
  // Pair-derived fallback is intentionally prohibited after the migration.
  const { profile } = useUserProfile();
  useEffect(() => {
    if (threadIdProp) {
      setResolvedThreadId(threadIdProp);
      return;
    }
    if (currentUid !== traineeId || !profile?.activeAssignmentId) {
      setResolvedThreadId(null);
      return;
    }
    return subscribeToAssignmentThreadId(
      profile.activeAssignmentId,
      setResolvedThreadId,
      () => setErrorText("Could not resolve the active conversation.")
    );
  }, [currentUid, profile?.activeAssignmentId, threadIdProp, traineeId]);

  useEffect(() => {
    setMessages([]);
    if (!resolvedThreadId) return;
    setErrorText(null);
    return subscribeToChatMessages(
      resolvedThreadId,
      setMessages,
      () => setErrorText("Could not load chat messages.")
    );
  }, [resolvedThreadId]);

  const isCoach = currentUid === coachId;

  // The person on the other end of this thread, loaded so the header can show
  // their real name and — for a coach — their real verification status rather
  // than a decorative badge.
  const [counterpart, setCounterpart] = useState<{
    name: string;
    verified: boolean;
    photoUrl: string | null;
  } | null>(null);
  useEffect(() => {
    const otherId = isCoach ? traineeId : coachId;
    if (!otherId) return;
    return subscribeToUserProfile(otherId, (p) => {
      setCounterpart({
        name: p.name || "",
        verified: p.verified === true,
        photoUrl: p.profileImageUrl || null,
      });
    });
  }, [isCoach, traineeId, coachId]);

  const counterpartName =
    counterpart?.name || (isCoach ? traineeName : "") || (isCoach ? "Your client" : "Your coach");
  const counterpartRole = isCoach ? "Your client" : "Your coach";

  // `inverted` renders index 0 at the bottom, so the newest message must come
  // first. subscribeToChatMessages returns oldest-first (orderBy asc).
  const orderedMessages = useMemo(() => [...messages].slice().reverse(), [messages]);

  useEffect(() => {
    if (!isCoach || !resolvedThreadId) return;
    // Re-runs when `messages` changes, not only on mount: a message arriving
    // while the coach is actively reading the thread would otherwise increment
    // unreadByCoach and leave a phantom badge for messages already on screen.
    clearCoachUnread(traineeId, resolvedThreadId).catch((error) => {
      console.error("Failed to clear unread count:", error);
    });
  }, [isCoach, traineeId, resolvedThreadId, messages.length]);

  const sendTextMessage = async () => {
    if (!draft.trim() || !resolvedThreadId) return;

    const text = draft.trim();
    setDraft("");
    setErrorText(null);

    try {
      await sendChatMessage({
        threadId: resolvedThreadId,
        traineeId,
        coachId,
        type: "text",
        text,
      });
    } catch (error) {
      console.error("Send failed:", error);
      setErrorText("Failed to send message.");
    }
  };

  const pickAndUploadImage = async () => {
    setErrorText(null);
    if (!resolvedThreadId) {
      setErrorText("The active conversation is not available yet.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorText("Gallery permission is required to send images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setIsUploading(true);
      const uploaded = await uploadChatImage(result.assets[0].uri);

      await sendChatMessage({
        threadId: resolvedThreadId,
        traineeId,
        coachId,
        type: "image",
        text: "",
        image: {
          url: uploaded.secureUrl,
          publicId: uploaded.publicId,
          width: uploaded.width,
          height: uploaded.height,
          format: uploaded.format,
          bytes: uploaded.bytes,
        },
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ScreenShell
      /*
       * Plain string title and subtitle, so this header is rendered by exactly
       * the same styles as every other screen. It used to pass a custom node
       * that re-declared its own `headerName` and `headerRole` — copies of
       * ScreenShell's title and subtitle that immediately drifted to a smaller
       * size. The counterpart's name IS this screen's title; nothing about it
       * needs to be special.
       */
      title={counterpartName}
      subtitle={
        /*
         * The badge is shown only when the loaded profile actually says
         * verified. Rendering it unconditionally would make it decoration, and
         * this is exactly the signal a trainee uses to decide whether to trust
         * a coach. It is a node rather than a string only because it carries an
         * icon — the text style still matches the standard subtitle.
         */
        counterpart?.verified ? (
          <View style={styles.headerMetaRow}>
            <Ionicons name="shield-checkmark" size={iconSize.sm} color={colors.success} />
            <Text style={styles.headerVerified}>Verified coach</Text>
          </View>
        ) : (
          counterpartRole
        )
      }
      headerAccessory={
        <View style={styles.avatar}>
          {counterpart?.photoUrl ? (
            <Image
              source={{ uri: counterpart.photoUrl }}
              style={styles.avatarImage}
              accessibilityLabel={`${counterpartName}'s profile photo`}
            />
          ) : (
            <Ionicons name="person" size={iconSize.md} color={colors.textSecondary} />
          )}
        </View>
      }
      contentStyle={styles.shellContent}
    >
      <View style={[styles.container, { paddingBottom: keyboardPadding }]}>
        <FlatList
          style={{ flex: 1 }}
          // `inverted` + reversed data renders newest-at-bottom and, crucially,
          // keeps the viewport pinned to the latest message: incoming and sent
          // messages appear immediately instead of off-screen. Previously the
          // list opened scrolled to the OLDEST of the 100 fetched messages.
          inverted
          data={orderedMessages}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          /*
           * `removeClippedSubviews` is deliberately NOT set here.
           *
           * On Android it is broken in combination with `inverted`: cells get
           * detached and re-attached at the wrong offsets, so a tall message
           * renders with another row's background painted inside it — which is
           * the dark panel that was appearing inside long outgoing bubbles.
           * The windowing props above already bound how much is mounted.
           */
          renderItem={({ item, index }) => {
            const mine = item.senderId === currentUid;
            // The list is inverted, so the message rendered ABOVE this one is
            // the next index (chronologically earlier). A day label belongs
            // above the first message of each day, which means rendering it
            // after the bubble whenever the previous message is on another day.
            const earlier = orderedMessages[index + 1];
            const showDaySeparator =
              !earlier || !isSameCalendarDay(earlier.createdAt, item.createdAt);

            return (
              <View>
                {showDaySeparator && (
                  <View style={styles.daySeparator}>
                    <Text style={styles.daySeparatorText}>{formatDayLabel(item.createdAt)}</Text>
                  </View>
                )}

                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}>
                  {item.type === "text" ? (
                    <Text style={[styles.messageText, mine ? styles.textMine : styles.textCoach]}>
                      {item.text}
                    </Text>
                  ) : null}

                  {item.type === "image" && item.image ? (
                    <Image source={{ uri: item.image.url }} style={styles.imagePreview} resizeMode="cover" />
                  ) : null}

                  <Text style={[styles.metaText, mine ? styles.metaMine : styles.metaCoach]}>
                    {formatTime(item.createdAt)}
                    {mine && item.status === "read" ? " · Read" : ""}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.composerWrapper}>
          <View style={styles.composerRow}>
            <Pressable
              style={styles.attachButton}
              disabled={isUploading || !resolvedThreadId}
              onPress={() => void pickAndUploadImage()}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="image" size={iconSize.lg} color={colors.primary} />
              )}
            </Pressable>

            <TextInput
              placeholder={
                resolvedThreadId
                  ? `Message ${counterpart?.name?.split(" ")[0] || (isCoach ? "your client" : "your coach")}`
                  : "Conversation unavailable"
              }
              placeholderTextColor={colors.textTertiary}
              value={draft}
              onChangeText={setDraft}
              style={styles.input}
              multiline
              editable={Boolean(resolvedThreadId)}
            />

            <Pressable
              style={[styles.sendButton, (!draft.trim() || !resolvedThreadId) && styles.sendButtonDisabled]}
              onPress={sendTextMessage}
              disabled={!draft.trim() || !resolvedThreadId}
            >
              <Ionicons name="send" size={20} color={colors.primaryText} />
            </Pressable>
          </View>
        </View>
        {/* Clears the floating tab bar, which is only in the way when the
            keyboard is closed. */}
        {!isKeyboardVisible && <View style={{ height: 80 }} />}
      </View>
    </ScreenShell>
  );
}

/**
 * Meta text on the yellow fill.
 *
 * The one colour on this screen that is not a palette token, and deliberately
 * so: `textSecondary` is tuned for contrast against `bg`, and on `primary` it
 * is unreadable. Black at 0.72 alpha clears 4.5:1 on the yellow, which matters
 * now that this line carries the read receipt as a word rather than a tick.
 */
const ON_PRIMARY_MUTED = "rgba(0, 0, 0, 0.72)";

const styles = StyleSheet.create({
  shellContent: {
    paddingBottom: 0,
  },
  container: {
    flex: 1,
  },
  /*
   * headerRow / headerText / headerName / headerRole are gone. They were local
   * copies of ScreenShell's title and subtitle, which is why this header ended
   * up 19px against every other screen's 26px.
   */
  /*
   * Sized to the title's line height, not to `touchTarget.min`.
   *
   * The header row has no fixed height, so its tallest child sets it. A 44px
   * avatar next to a 32px title line made the row 44px, which pushed the
   * subtitle down and opened a gap under the name that no other screen has.
   * The avatar is not tappable, so the 44px minimum does not apply to it.
   * Reading the value off the type scale means it cannot drift if the title
   * step is ever retuned.
   */
  avatar: {
    width: typography.title.lineHeight,
    height: typography.title.lineHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  // Matches styles.subtitle in ScreenShell — same step, same line height.
  headerVerified: {
    ...typography.body,
    color: colors.success,
  },
  daySeparator: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  daySeparatorText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  messagesList: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: radius.xs,
  },
  bubbleCoach: {
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
    borderBottomLeftRadius: radius.xs,
    // Border removed: against the near-black background it read as an outline
    // around every incoming message, which is a lot of chrome for a screen that
    // is mostly incoming messages. The fill alone separates it.
  },
  messageText: {
    ...typography.body,
  },
  textMine: {
    color: colors.primaryText,
  },
  textCoach: {
    color: colors.text,
  },
  // Was 11px, below the 12px floor, on the smallest text in the app.
  metaText: {
    ...typography.label,
  },
  metaMine: {
    color: ON_PRIMARY_MUTED,
  },
  metaCoach: {
    color: colors.textSecondary,
  },
  imagePreview: {
    width: 240,
    height: 240,
    borderRadius: radius.nested,
    backgroundColor: colors.surfaceInset,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  composerWrapper: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    // Keeps the controls off the keyboard's top edge instead of flush against it.
    paddingBottom: spacing.md,
    // Was "#000" against an app background of #0b0b0b, which showed as a black
    // band behind the composer. The screen background already sits behind it,
    // so no fill is needed here at all.
  },
  /*
   * Three separate 44px controls rather than one pill containing everything.
   * All three share `radius.pill` — the attach button was a 14px rounded square
   * next to two circles, which made the row look assembled from spare parts.
   */
  composerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  attachButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceInset,
  },
  input: {
    flex: 1,
    minHeight: touchTarget.min,
    maxHeight: 100,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.pill,
  },
  sendButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  // Not `opacity: 0.5` over a grey — that made the glyph fall below 4.5:1.
  sendButtonDisabled: {
    backgroundColor: colors.surfaceInset,
  },
});

