import type { CompositeNavigationProp } from "@react-navigation/native";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProgramSession } from "../services/programService";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  /**
   * The role is chosen on Welcome ("Create an account" = trainee, "I'm a coach"
   * = coach), so the signup form no longer asks. Reaching SignUp without a role
   * — the "Create an account" link on Login — defaults to trainee.
   */
  SignUp: { role?: "trainee" | "coach" } | undefined;
  CompleteProfile: undefined;
  CoachAssignment: undefined;
  PendingCoach: undefined;
  TraineeTabs: undefined;
  CoachTabs: undefined;
  Profile: undefined;
  TraineeDetail: { traineeId: string; traineeName: string; traineeTimezone?: string | null };
  PrescribeWorkout: { traineeId: string; traineeName: string };
  CreateProgram: { traineeId: string; traineeName: string };
  PrescribeMeal: { traineeId: string; traineeName: string };
  /**
   * The coach inbox passes the assignment-scoped thread document id. It is
   * required so a stale deep link cannot derive and reopen a legacy pair thread.
   */
  CoachChat: { traineeId: string; traineeName?: string; coachId: string; threadId: string };
  CreateTemplate: { type: "workout" | "meal"; template?: unknown };
  TemplateDetail: { templateId: string; type: "workout" | "meal" };
  EditCoachProfile: undefined;
};

export type CoachTabsParamList = {
  CoachHome: undefined;
  CoachClients: undefined;
  CoachLibrary: undefined;
  CoachInbox: undefined;
  CoachProfile: undefined;
};

export type TraineeTabsParamList = {
  Workouts: {
    autoLoadPrescriptionId?: string;
    programSession?: ProgramSession;
  } | undefined;
  Nutrition: undefined;
  Home: undefined;
  Progress: undefined;
  Chat: undefined;
};

export type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;

// Both tab navigators are material top tabs now — CoachTabs was the odd one
// out on bottom-tabs, which is why it had no swipe.
export type CoachHomeNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<CoachTabsParamList, "CoachHome">,
  NativeStackNavigationProp<RootStackParamList>
>;

export type TraineeHomeNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<TraineeTabsParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;
