import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { radius, spacing, touchTarget, typography } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../components/Typography";
import { PrimaryButton } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { appEnv } from "../../config/env";
import { BrandLogo } from "../../components/BrandLogo";
import { GoogleLogo } from "../../components/GoogleLogo";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";

type SignUpScreenProps = {
  /**
   * Decided on Welcome, not here. Asking "trainee or coach?" mid-form made the
   * user answer a question they had already answered by choosing a button, and
   * it was the one field with no obvious default.
   */
  role: "trainee" | "coach";
  onSignUp: (payload: { name: string; email: string; password: string; role: "trainee" | "coach" }) => Promise<void>;
  onGoogleLogin: (role: "trainee" | "coach") => Promise<void>;
  onFacebookLogin: (role: "trainee" | "coach") => Promise<void>;
};

export function SignUpScreen({ role, onSignUp, onGoogleLogin, onFacebookLogin }: SignUpScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isCoach = role === "coach";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 1 &&
      email.includes("@") &&
      password.length >= 6 &&
      confirmPassword === password &&
      acceptedTerms
    );
  }, [acceptedTerms, confirmPassword, email, name, password]);

  const handleSignUp = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onSignUp({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Sign up failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!appEnv.google.webClientId) {
      setErrorText("Google Authentication is not configured.");
      return;
    }

    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onGoogleLogin(role);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onFacebookLogin(role);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Facebook sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Same as LoginScreen: the wordmark travels with the form rather than
    // being pinned to the top by the shell header.
    <ScreenShell contentStyle={styles.contentTight}>
      {/* Same shape as LoginScreen: centred when it fits, scrolls when it does not. */}
      <ScrollView
        contentContainerStyle={styles.formScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.brand}>
          <BrandLogo width={160} height={75} />
          {/*
            The role moved into this line from a separate pill below it.
            Trainee and coach see an identical form, so it still has to be
            named — but naming it here costs no height, where the banner cost
            a 44px row plus a gap and pushed the form into a scroll.
          */}
          <Text style={styles.brandSubtitle}>
            {isCoach ? "Create your coach account" : "Create your trainee account"}
          </Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Name"
            required
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            autoComplete="name"
            textContentType="name"
            editable={!isSubmitting}
          />

          <TextField
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            editable={!isSubmitting}
          />

          {/*
            The optional phone field lived here. It is collected in profile
            settings instead — asking for it during signup lengthened the one
            form standing between a user and the app, for a value nothing read.
          */}

          {/*
            Validation only speaks once the field has been touched. Showing
            "must be at least 6 characters" against an empty box tells the user
            they got something wrong before they have typed anything.
          */}
          <TextField
            label="Password"
            required
            password
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isSubmitting}
            errorText={
              password.length > 0 && password.length < 6
                ? "Must be at least 6 characters"
                : undefined
            }
          />

          <TextField
            label="Confirm password"
            required
            password
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-type your password"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isSubmitting}
            errorText={
              confirmPassword.length > 0 && confirmPassword !== password
                ? "Passwords do not match"
                : undefined
            }
          />

          {/*
            * The trainee/coach picker used to live here. It is gone: the choice
            * is made on Welcome, and repeating it mid-form asked the user to
            * re-answer something they had already decided.
            */}

          {/*
            The whole row is the target, not the 18px box: an 18px checkbox is
            well under the 44px minimum and was the smallest tappable thing in
            the app.
          */}
          <Pressable
            style={styles.termsRow}
            onPress={() => setAcceptedTerms((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="I understood the terms and policy"
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
              {acceptedTerms && (
                <Ionicons name="checkmark" size={14} color={colors.primaryText} />
              )}
            </View>
            <Text style={styles.termsText}>
              I understood the <Text style={styles.termsLink}>terms & policy</Text>
            </Text>
          </Pressable>

          {/* The last thing read before committing, so it names the role too. */}
          <PrimaryButton
            title={isCoach ? "Create coach account" : "Create trainee account"}
            disabled={!canSubmit}
            loading={isSubmitting}
            onPress={() => void handleSignUp()}
            style={styles.signupBtn}
          />

          {errorText ? (
            <Typography variant="label" color={colors.danger} style={styles.errorText}>
              {errorText}
            </Typography>
          ) : null}

          <Text style={styles.socialLabel}>or sign up with</Text>
          <View style={styles.socialRow}>
            <Pressable
              style={[styles.socialIconBtn, isSubmitting && styles.socialIconBtnDisabled]}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Google"
              onPress={() => void handleGoogleLogin()}
            >
              <GoogleLogo size={24} />
            </Pressable>
            <Pressable
              style={[styles.socialIconBtn, isSubmitting && styles.socialIconBtnDisabled]}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Facebook"
              onPress={() => void handleFacebookLogin()}
            >
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  /*
   * inputGroup / label / input are gone — TextField owns the well, the label,
   * the placeholder colour and the validation line, so four copies of each
   * collapsed into four component calls. primaryButton / primaryButtonText /
   * disabledButton went with them: they described a button this screen stopped
   * rendering when it moved to PrimaryButton, and were still hand-maintained.
   */
  contentTight: {
    // The shell renders no header here, so the content area takes the full
    // height and the ScrollView inside it handles both centring and overflow.
    marginTop: 0,
    flex: 1,
  },
  formScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
  },
  brand: {
    alignItems: "center",
    marginBottom: spacing["2xl"],
  },
  brandSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget.min,
  },
  checkbox: {
    width: 22,
    height: 22,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
  },
  termsText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
  // roleGrid / roleCard / roleIcon* / roleLabel* / roleSub removed with the
  // trainee-coach picker — the role now arrives as a prop from Welcome.
  // roleBanner / roleBannerTitle / roleBannerChange removed — the role is
  // stated in the brand subtitle now, and the button that commits the account
  // still names it ("Create coach account").
  signupBtn: {
    marginTop: spacing.sm,
  },
  errorText: {
    textAlign: "center",
  },
  socialLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
  },
  /*
   * White fill is Google's and Meta's brand requirement for their sign-in
   * controls, so these are the one pair in the app that do not take their
   * surface from the palette.
   */
  socialIconBtn: {
    width: touchTarget.large,
    height: touchTarget.large,
    borderRadius: radius.pill,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  // Not `opacity`, which multiplies against the page behind it — the brand
  // glyphs need to stay legible while a sign-up is in flight.
  socialIconBtnDisabled: {
    backgroundColor: colors.textSecondary,
  },
});
