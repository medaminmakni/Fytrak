import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState } from "react";
import { CoachCompleteProfileScreen } from "../screens/coach/CoachCompleteProfileScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { CreateTemplateScreen } from "../screens/coach/CreateTemplateScreen";
import { EditCoachProfileScreen } from "../screens/coach/EditCoachProfileScreen";
import { PrescribeMealScreen } from "../screens/coach/PrescribeMealScreen";
import { TemplateDetailScreen } from "../screens/coach/TemplateDetailScreen";
import {
  loginWithEmailPassword,
  signInWithFacebook,
  signInWithGoogle,
  signUpWithEmailPassword,
} from "../services/auth";
import { CoachAssignmentScreen } from "../screens/trainee/CoachAssignmentScreen";
import { PendingCoachScreen } from "../screens/trainee/PendingCoachScreen";
import { TraineeTabs } from "./TraineeTabs";
import { CoachTabs } from "./CoachTabs";
import { ProfileScreen } from "../screens/trainee/ProfileScreen";
import { AdjustPlanScreen } from "../screens/coach/AdjustPlanScreen";
import { TraineeDetailScreen } from "../screens/coach/TraineeDetailScreen";
import { PrescribeWorkoutScreen } from "../screens/coach/PrescribeWorkoutScreen";
import { CreateProgramScreen } from "../screens/coach/CreateProgramScreen";
import { auth } from "../config/firebase";
import { SplashScreen } from "../screens/onboarding/SplashScreen";
import { WelcomeScreen } from "../screens/onboarding/WelcomeScreen";
import {
  ensureUserSession,
  saveCoachRequest,
  saveCompleteProfile,
  saveCoachProfile,
} from "../services/userSession";
import { calculateNutritionPlan } from '../utils/calculators';
import { useTimezoneCapture } from "../hooks/useTimezoneCapture";
import { OnboardingFlow } from "../screens/onboarding/OnboardingFlow";
import { useSessionState } from "../hooks/useSessionState";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function TimezoneCapture() {
  useTimezoneCapture();
  return null;
}

export function RootNavigator() {
  const { session, isBootstrapping } = useSessionState();
  const [isSplashAnimationFinished, setIsSplashAnimationFinished] = useState(false);

  const handleAuthSuccess = async (initialRole?: "trainee" | "coach") => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Authentication succeeded but no user user session was found.");
    }

    await ensureUserSession(user.uid, initialRole);
  };


  if (isBootstrapping || !isSplashAnimationFinished) {
    return (
      <SplashScreen
        canFinish={!isBootstrapping}
        onFinish={() => setIsSplashAnimationFinished(true)}
      />
    );
  }

  return (
    <NavigationContainer>
      {session.profileCompleted ? <TimezoneCapture /> : null}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session.isAuthenticated ? (
          /* AUTHENTICATION FLOW */
          <>
            {/*
              * Welcome navigates rather than unmounting itself. Keeping it in
              * the stack means Back from SignUp or Login returns here instead
              * of trapping the user in whichever form they picked.
              *
              * The role is decided by which button was pressed and travels as a
              * route param, so SignUp no longer has to ask.
              */}
            <Stack.Screen name="Welcome" options={{ animation: 'fade' }}>
              {({ navigation }) => (
                <WelcomeScreen
                  onStart={() => navigation.navigate("SignUp", { role: "trainee" })}
                  onSignIn={() => navigation.navigate("Login")}
                  onCoachStart={() => navigation.navigate("SignUp", { role: "coach" })}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login">
              {() => (
                <LoginScreen
                  onLogin={async ({ email, password }) => {
                    await loginWithEmailPassword(email, password);
                    await handleAuthSuccess();
                  }}
                  onGoogleLogin={async () => {
                    await signInWithGoogle();
                    await handleAuthSuccess();
                  }}
                  onFacebookLogin={async () => {
                    await signInWithFacebook();
                    await handleAuthSuccess();
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SignUp">
              {({ route }) => (
                <SignUpScreen
                  // Reached from Login's "Create an account" link there is no
                  // param; a trainee is the overwhelmingly common case.
                  role={route.params?.role ?? "trainee"}
                  onSignUp={async ({ name, email, password, role }) => {
                    await signUpWithEmailPassword(name, email, password, role);
                    await handleAuthSuccess(role);
                  }}
                  onGoogleLogin={async (role) => {
                    await signInWithGoogle();
                    await handleAuthSuccess(role);
                  }}
                  onFacebookLogin={async (role) => {
                    await signInWithFacebook();
                    await handleAuthSuccess(role);
                  }}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          /* APPLICATION FLOW */
          <>
            {!session.profileCompleted ? (
              <Stack.Screen name="CompleteProfile">
                {() =>
                  session.role === "coach" ? (
                    <CoachCompleteProfileScreen
                      onComplete={async (payload) => {
                        const user = auth.currentUser;
                        if (!user) {
                          throw new Error("Please login again to continue.");
                        }
                        await saveCoachProfile(user.uid, payload);
                      }}
                    />
                  ) : (
                    <OnboardingFlow
                      onComplete={async (payload) => {
                        const user = auth.currentUser;
                        if (!user) {
                          throw new Error("Please login again to continue.");
                        }
                        // Calculate expert-level nutrition plan
                        const nutritionPlan = calculateNutritionPlan(payload);

                        // Transition payload into saving service
                        await saveCompleteProfile(user.uid, {
                          ...payload,
                          goal: payload.goal || '',
                          macroTargets: {
                            calories: nutritionPlan.calories,
                            protein: nutritionPlan.protein,
                            carbs: nutritionPlan.carbs,
                            fats: nutritionPlan.fats
                          }
                        });
                      }}
                      onExit={() => {
                        auth.signOut();
                      }}
                    />
                  )
                }
              </Stack.Screen>
            ) : session.role === "coach" ? (
              <Stack.Screen name="CoachTabs">
                {() => <CoachTabs session={session} />}
              </Stack.Screen>
            ) : (
              /* TRAINEE FLOW - NO BLOCKER */
              <>
                <Stack.Screen name="TraineeTabs">
                  {() => <TraineeTabs session={session} />}
                </Stack.Screen>
                <Stack.Screen name="CoachAssignment">
                  {({ navigation }) => (
                    <CoachAssignmentScreen
                      assignmentStatus={session.assignmentStatus}
                      onRequestUnavailable={(status) => {
                        if (status === "pending") {
                          navigation.replace("PendingCoach");
                          return;
                        }
                        navigation.replace("TraineeTabs");
                      }}
                      onSendRequest={async (coach) => {
                        const user = auth.currentUser;
                        if (!user) throw new Error("Please login again.");
                        await saveCoachRequest(user.uid, coach);
                      }}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="PendingCoach">
                  {() => (
                    <PendingCoachScreen
                      coachName={session.selectedCoachName}
                    />
                  )}
                </Stack.Screen>
              </>
            )}
            <Stack.Screen name="Profile">
              {() => <ProfileScreen session={session} />}
            </Stack.Screen>
            <Stack.Screen name="TraineeDetail" component={TraineeDetailScreen} />
            <Stack.Screen name="AdjustPlan" component={AdjustPlanScreen} />
            <Stack.Screen name="PrescribeWorkout" component={PrescribeWorkoutScreen} />
            <Stack.Screen name="CreateProgram" component={CreateProgramScreen} />
            <Stack.Screen name="PrescribeMeal" component={PrescribeMealScreen} />
            <Stack.Screen name="CreateTemplate" component={CreateTemplateScreen} />
            <Stack.Screen name="TemplateDetail" component={TemplateDetailScreen} />
            <Stack.Screen name="EditCoachProfile" component={EditCoachProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
