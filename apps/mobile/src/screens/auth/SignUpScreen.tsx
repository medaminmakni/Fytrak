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
  const [phone, setPhone] = useState("");
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
    <ScreenShell
      centered
      title={<BrandLogo width={160} height={75} />}
      subtitle="Create your account"
      titleStyle={styles.centeredHeader}
      subtitleStyle={styles.centeredHeader}
      contentStyle={styles.contentTight}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.form}>
          {/*
            * The trainee and coach forms are identical, so without this banner
            * the only evidence of which account you are creating is the button
            * you tapped a screen ago. It states the role and offers a way back
            * — saying "you are creating a coach account" with no escape would
            * just be a dead end.
            */}
          <View style={styles.roleBanner}>
            <Ionicons
              name={isCoach ? "trophy-outline" : "fitness-outline"}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.roleBannerTitle} numberOfLines={1}>
              {isCoach ? "Coach account" : "Trainee account"}
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Welcome")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Change account type"
            >
              <Text style={styles.roleBannerChange}>Change</Text>
            </Pressable>
          </View>

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

          <TextField
            label="Phone"
            helperText="Optional"
            value={phone}
            onChangeText={setPhone}
            placeholder="99 000 555"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            editable={!isSubmitting}
          />

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
              <Ionicons name="logo-google" size={24} color="#4285F4" />
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
  contentTight: {
    marginTop: 0,
    // ScreenShell's `centered` mode gives the content area flex: 0, so a long
    // form contributes its FULL height to the layout instead of scrolling
    // inside a bounded box. Once that exceeds the screen, the container's
    // justifyContent: "center" splits the overflow top and bottom and shoves
    // the header off the top edge — which is what was clipping the logo.
    //
    // flex: 1 hands the leftover height to the scroll area, so the header stays
    // put at full size and the form scrolls within what remains.
    flex: 1,
  },
  centeredHeader: {
    textAlign: "center",
    width: "100%",
  },

  /*
   * inputGroup / label / input are gone — TextField owns the well, the label,
   * the placeholder colour and the validation line, so five copies of each
   * collapsed into five component calls.
   */
  form: {
    marginTop: spacing.xl,
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
  roleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primaryMuted,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  roleBannerTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginEnd: 4,
  },
  roleBannerChange: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signupBtn: {
    marginTop: 10,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: "800",
    fontSize: 18,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: colors.danger,
    textAlign: "center",
    fontSize: 13,
  },
  socialLabel: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 10,
    fontSize: 14,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  socialIconBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  socialIconBtnDisabled: {
    opacity: 0.55,
  },
});

