import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

import { BrandLogo } from "../../components/BrandLogo";

// PREMIUM SVG LOGOS
const GoogleLogo = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

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
    <ScreenShell
      centered
      title={<BrandLogo width={160} height={75} />}
      subtitle="Sign in to continue"
      titleStyle={styles.centeredHeader}
      subtitleStyle={styles.centeredHeader}
      contentStyle={styles.contentTight}
    >
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

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <Pressable onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.signupLink}>Sign up</Text>
          </Pressable>
        </View>
      </View>
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
  form: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  contentTight: {
    marginTop: 0,
    // See SignUpScreen: ScreenShell's `centered` mode gives the content area
    // flex: 0, so a tall form overflows and pushes the header off the top edge.
    flex: 1,
  },
  centeredHeader: {
    textAlign: "center",
    width: "100%",
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

