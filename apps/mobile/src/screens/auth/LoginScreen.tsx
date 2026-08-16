import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { radius, spacing, touchTarget, typography } from "../../theme/tokens";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Typography } from "../../components/Typography";
import { PrimaryButton } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { appEnv } from "../../config/env";
import Svg, { Path, Circle } from "react-native-svg";
import { GoogleLogo } from "../../components/GoogleLogo";

import { BrandLogo } from "../../components/BrandLogo";

const FacebookLogo = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="12" fill="#1877F2" />
    <Path
      fill="#ffffff"
      d="M15.12 12.67l.43-2.8h-2.69V8.05c0-.77.38-1.53 1.59-1.53h1.23V4.13s-1.12-.19-2.19-.19c-2.23 0-3.69 1.35-3.69 3.8v2.12H7.33v2.8h2.47v6.79c.5.08 1 .12 1.51.12s1.01-.04 1.51-.12v-6.79h2.3z"
    />
  </Svg>
);

type LoginScreenProps = {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onFacebookLogin: () => Promise<void>;
};

export function LoginScreen({ onLogin, onGoogleLogin, onFacebookLogin }: LoginScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const canSubmit = useMemo(() => email.trim().includes("@") && password.trim().length >= 6, [email, password]);

  const handleLogin = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onLogin({ email: email.trim(), password: password.trim() });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!appEnv.google.webClientId) {
      setErrorText("Google Authentication is not configured.");
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onGoogleLogin();
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
      await onFacebookLogin();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Facebook sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    /*
     * No ScreenShell header. The wordmark used to be the shell's `title`, which
     * pinned it to the top of the screen while the form centred in the space
     * below — so the brand floated on its own, disconnected from the thing it
     * was introducing. It is part of the form block now, and the whole group
     * centres together.
     */
    <ScreenShell contentStyle={styles.contentTight}>
      {/*
        `flexGrow: 1` with `justifyContent: "center"` rather than a plain View.
        The form is shorter than the screen, so it used to stack from the top
        and leave a third of the display empty underneath; centring it inside
        the leftover space fills the screen. The ScrollView is what keeps that
        safe — on a short device, or with the keyboard open, the same content
        now scrolls instead of pushing the sign-in button off the bottom.
      */}
      <ScrollView
        contentContainerStyle={styles.formScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.brand}>
          <BrandLogo width={160} height={75} />
          <Text style={styles.brandSubtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="next"
          editable={!isSubmitting}
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          password
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void handleLogin()}
          editable={!isSubmitting}
        />

        {/*
          The "Forgot password?" control that sat here was a Pressable with no
          onPress — it looked tappable and did nothing, and there is no password
          reset flow anywhere in the app to wire it to. Removed rather than left
          as a dead affordance; see the report for the reset flow it needs.
        */}

        <PrimaryButton
          title="Log in"
          disabled={!canSubmit}
          loading={isSubmitting}
          onPress={() => void handleLogin()}
          style={styles.loginBtn}
        />

        {errorText ? (
          <Typography
            variant="label"
            color={colors.danger}
            style={styles.errorText}
          >
            {errorText}
          </Typography>
        ) : null}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={[styles.socialButton, isSubmitting && styles.socialButtonDisabled]}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          onPress={() => void handleGoogleLogin()}
        >
          <GoogleLogo />
          <Typography color="#000" variant="button">Sign in with Google</Typography>
        </Pressable>

        <Pressable
          style={[styles.socialButton, isSubmitting && styles.socialButtonDisabled]}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Continue with Facebook"
          onPress={() => void handleFacebookLogin()}
        >
          <FacebookLogo />
          <Typography color="#000" variant="button">Continue with Facebook</Typography>
        </Pressable>

          <Pressable
            style={styles.signupRow}
            onPress={() => navigation.navigate("SignUp")}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Text style={styles.signupLink}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

/*
 * Five style objects here were dead: socialText, primaryButton,
 * primaryButtonText, disabledButton, and the input/passwordWrap/eyeIcon trio
 * that TextField now owns. They described a button this screen stopped
 * rendering long ago and were still being maintained by hand.
 */
const styles = StyleSheet.create({
  formScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  contentTight: {
    marginTop: 0,
    flex: 1,
  },
  brand: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  brandSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  loginBtn: {
    marginTop: spacing.sm,
  },
  errorText: {
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceInset,
  },
  dividerText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  /*
   * White fill and a pill radius are Google's and Meta's brand requirements for
   * their sign-in buttons, so this is the one control in the app that does not
   * take its surface from the palette.
   */
  socialButton: {
    backgroundColor: "#ffffff",
    borderRadius: radius.pill,
    minHeight: touchTarget.large,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  socialButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
    minHeight: touchTarget.min,
  },
  signupText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  signupLink: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
