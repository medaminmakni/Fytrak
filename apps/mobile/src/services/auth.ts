import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { AccessToken, LoginManager } from "react-native-fbsdk-next";
import { auth } from "../config/firebase";
import { appEnv } from "../config/env";
import { clearSubscriptionCache } from "../data/subscriptions/subscriptionCache";

GoogleSignin.configure({
  webClientId: appEnv.google.webClientId,
  offlineAccess: false,
});

const firebaseErrorMap: Record<string, string> = {
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/missing-password": "Password is required.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/email-already-in-use": "This email is already in use.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/account-exists-with-different-credential": "An account already exists with this email. Sign in with the original provider first.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/operation-not-allowed": "This sign-in provider is not enabled in Firebase.",
};

const mapAuthError = (error: unknown): Error => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: string }).code);
    const message = firebaseErrorMap[code] ?? "Authentication failed. Please try again.";
    return new Error(message);
  }

  return new Error("Authentication failed. Please try again.");
};

export const loginWithEmailPassword = async (email: string, password: string): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw mapAuthError(error);
  }
};

export const signUpWithEmailPassword = async (
  name: string,
  email: string,
  password: string,
  role: "trainee" | "coach"
): Promise<void> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    if (name.trim()) {
      await updateProfile(userCredential.user, {
        displayName: name.trim(),
      });
    }
  } catch (error) {
    throw mapAuthError(error);
  }
};

export const signInWithGoogle = async (): Promise<void> => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();

    if (!isSuccessResponse(result)) {
      throw new Error("Google sign-in was cancelled.");
    }

    const idToken = result.data.idToken;
    if (!idToken) {
      throw new Error("Google did not return a valid identity token.");
    }

    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  } catch (error) {
    if (error instanceof Error && !isErrorWithCode(error)) {
      throw error;
    }

    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error("Google sign-in was cancelled.");
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error("Google sign-in is already in progress.");
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Google Play Services is unavailable or needs an update.");
      }
    }

    throw mapAuthError(error);
  }
};

export const signInWithFacebook = async (): Promise<void> => {
  try {
    const result = await LoginManager.logInWithPermissions(["public_profile", "email"]);

    if (result.isCancelled) {
      throw new Error("Facebook sign-in was cancelled.");
    }

    const tokenData = await AccessToken.getCurrentAccessToken();
    if (!tokenData?.accessToken) {
      throw new Error("Facebook did not return a valid access token.");
    }

    const credential = FacebookAuthProvider.credential(tokenData.accessToken);
    await signInWithCredential(auth, credential);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Facebook ")) {
      throw error;
    }
    throw mapAuthError(error);
  }
};

export const logOut = async (): Promise<void> => {
  try {
    // Tear down every shared Firestore listener BEFORE signing out. Otherwise
    // listeners belonging to the previous account keep running against a
    // now-unauthenticated session, immediately start returning
    // permission-denied, and any screen still mounted caches that failure.
    clearSubscriptionCache();
    await auth.signOut();
    await GoogleSignin.signOut().catch(() => null);
    LoginManager.logOut();
  } catch (error) {
    console.error("[AuthService] Logout error:", error);
    throw mapAuthError(error);
  }
};
