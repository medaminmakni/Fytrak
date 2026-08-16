import type { CompositeNavigationProp, NavigatorScreenParams } from "@react-navigation/native";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProgramSession } from "../services/programService";

/**
 * The adjustment a prescription form is fulfilling.
 *
 * Passed through navigation rather than held in a store: the coach authors the
 * replacement in the existing editor, and this is the only extra context that
 * editor needs. Every field is required — a partial revision context is how a
 * revision ends up pointing at nothing.
 */
export type PlanRevisionContext = {
  /** The single client-local day being replaced. */
  effectiveFromDateKey: string;
  reason: string;
  summary: string;
  traineeTimezone: string | null;
};

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
  CoachTabs: NavigatorScreenParams<CoachTabsParamList> | undefined;
  Profile: undefined;
  TraineeDetail: { traineeId: string; traineeName: string; traineeTimezone?: string | null };
  /**
   * `revision` is present only when the coach arrived via Adjust plan. It
   * carries the day being replaced and the reason, and it locks the schedule
   * field. Absent means the ordinary prescribing flow, unchanged.
   */
  PrescribeWorkout: {
    traineeId: string;
    traineeName: string;
    /** Client-local day selected in the report that opened this flow. */
    initialDateKey?: string;
    revision?: PlanRevisionContext;
  };
  CreateProgram: {
    traineeId: string;
    traineeName: string;
    /** Client-local day selected in the report that opened this flow. */
    initialDateKey?: string;
  };
  PrescribeMeal: {
    traineeId: string;
    traineeName: string;
    /** Client-local day selected in the report that opened this flow. */
    initialDateKey?: string;
    revision?: PlanRevisionContext;
  };
  CreateTemplate: { type: "workout" | "meal"; template?: unknown };
  TemplateDetail: { templateId: string; type: "workout" | "meal" };
  AdjustPlan: { traineeId: string; traineeName: string; traineeTimezone?: string | null };
  EditCoachProfile: undefined;
};

export type CoachTabsParamList = {
  CoachHome: undefined;
  CoachClients: undefined;
  CoachLibrary: undefined;
  CoachInbox: NavigatorScreenParams<CoachInboxStackParamList> | undefined;
  CoachProfile: undefined;
};

export type CoachConversationParams = {
  traineeId: string;
  traineeName?: string;
  coachId: string;
  /** Resolved by the Inbox list when its thread summary is already loaded. */
  threadId?: string;
  /** Resolved through assignments/{assignmentId} from other coach surfaces. */
  assignmentId?: string;
};

export type CoachInboxStackParamList = {
  InboxList: undefined;
  CoachConversation: CoachConversationParams;
};

export type TraineeTabsParamList = {
  Workouts: {
    autoLoadPrescriptionId?: string;
    programSession?: ProgramSession;
    /**
     * Which program the session belongs to, and the client-local day it was
     * scheduled for. Both are required to open a program session: they become
     * the log's source metadata, and without them a finished workout cannot be
     * matched back to the prescription that asked for it.
     */
    programId?: string;
    programScheduledDateKey?: string;
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
