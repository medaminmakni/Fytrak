import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing, radius, touchTarget } from '../../theme/tokens';

type WelcomeScreenProps = {
  /** Primary path: create an account. */
  onStart: () => void;
  /** Returning user. Falls back to onStart until the route is wired. */
  onSignIn?: () => void;
  /** Coach signing up. Falls back to onStart until the route is wired. */
  onCoachStart?: () => void;
};

/**
 * First screen. Built to the approved redesign frame.
 *
 * Content sits at the bottom because that is where thumbs are, and it is flush
 * left rather than centred so the headline reads as a statement instead of a
 * poster. One sentence of promise, then three destinations ranked by how
 * likely each is — a returning user and a coach previously had to enter the
 * signup flow and find their way back out.
 *
 * Sentence case, no letter-spacing: both are Latin-only emphasis devices.
 * Arabic has no letter case, and tracking breaks its cursive joins.
 */
export function WelcomeScreen({ onStart, onSignIn, onCoachStart }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();

  const handleSignIn = onSignIn ?? onStart;
  const handleCoachStart = onCoachStart ?? onStart;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.block}>
        <View style={styles.mark}>
          <Ionicons name="barbell" size={30} color={colors.primaryText} />
        </View>

        <Text style={styles.headline} accessibilityRole="header">
          Train with a real coach.
        </Text>

        <Text style={styles.sub}>
          Programmes written for you, adjusted every week by someone who sees
          your numbers.
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.primaryText}>Create an account</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={handleSignIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in to an existing account"
          >
            <Text style={styles.secondaryText}>I already have one</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.tertiary, pressed && styles.pressed]}
            onPress={handleCoachStart}
            accessibilityRole="button"
            accessibilityLabel="Sign up as a coach"
            hitSlop={8}
          >
            <Text style={styles.tertiaryText}>I'm a coach</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    // Everything is anchored to the bottom; the empty space above is doing
    // work, not going to waste.
    justifyContent: 'flex-end',
  },
  block: {
    gap: spacing.md,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  headline: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  sub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  secondary: {
    backgroundColor: colors.surface,
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  tertiary: {
    // A bare Text has no reliable tap area; this guarantees the 44px minimum
    // even though the label is short.
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
