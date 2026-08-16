import { AssignmentStatus, UserRole } from "../state/types";
import type { ClientDateMetadata } from "../../../../packages/shared/src";
import type { StoredCheckIn } from "../features/workouts/checkIn";

export type ProfileLevel = "Beginner" | "Intermediate" | "Advanced";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  profileImageUrl?: string;
  bio?: string;
  gender?: "male" | "female" | null;
  goal?: string;
  level?: ProfileLevel;
  injuries?: string;
  weight?: number;
  height?: number;
  birthDate?: string;
  activityLevel?: string;
  city?: string;
  country?: string;
  workoutProfileCompleted?: boolean;
  nutritionProfileCompleted?: boolean;
  isPremium?: boolean;
  lastTrainedDate?: string;
  assignmentStatus?: AssignmentStatus;
  selectedCoachId?: string | null;
  selectedCoachName?: string | null;
  /**
   * The client's IANA timezone, e.g. "Africa/Tunis". Null until captured.
   *
   * Every date key on this user's logs is anchored to this zone. No country
   * default is ever written — an uncaptured zone stays null so that inferred
   * dates remain distinguishable from confirmed ones.
   */
  timezone?: string | null;
  timezoneSource?: "captured" | null;
  timezoneCapturedAt?: unknown;
  /**
   * The current coaching relationship instance. Backend-written only — the
   * Firestore rules' hasOnly() allowlists exclude it, so a client cannot point
   * itself at another relationship's chat thread or records.
   */
  activeAssignmentId?: string | null;
  /**
   * Coach verification, as stored on the user document and already used to rank
   * the discovery list. Read here so the chat header can show a real badge
   * rather than a decorative one.
   */
  verified?: boolean;
  macroTargets?: MacroTargets;
  lifestyle?: Lifestyle;
  medical?: Medical;
  nutrition?: NutritionPreferences;
  work?: WorkEnvironment;
  coachProfile?: CoachProfile;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Lifestyle {
  smoker: boolean;
  cigarettesPerDay: number;
  coffeePerDay: number;
  alcoholPerDay: number;
  sleepHours: number;
  sleepTiming: string;
}

export interface Medical {
  allergies: string;
  medications: string;
}

export interface NutritionPreferences {
  specificDishes: string;
  supplements: string;
  regularEating: boolean;
}

export interface WorkEnvironment {
  toughness: number;
  timing: string;
  stress: number;
}

export interface CoachProfile {
  bio: string;
  specialties: string[];
  experience: number;
  rating?: number;
}

export interface Meal extends ClientDateMetadata {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  time: string;
  date: string;
  imageUrl?: string;
  createdAt?: any;
}

export interface PrescribedMeal {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  description?: string;
  macros: MacroTargets;
  isApplied: boolean;
  assignedAt: any;
}

export type WorkoutSetType = "WEIGHT_REPS" | "TIME" | "BODYWEIGHT" | "REPS_ONLY";

export interface WorkoutSet {
  type: WorkoutSetType;
  reps?: number;
  weight?: number;
  durationSec?: number;
  rpe?: string;
  isCompleted: boolean;
}

export interface WorkoutLog extends ClientDateMetadata {
  id: string;
  name: string;
  /**
   * What this log was performed AGAINST, when it was performed against
   * anything. Absent on a freely logged workout.
   *
   * Completion of a program session is derived from these four fields on the
   * LOG, never stored on the program: the program document is the coach's
   * prescription and the trainee must not be able to write to it. All four must
   * match for a session to count as done — a workout logged on the same day is
   * not the same thing as the session that was asked for.
   */
  sourceType?: "program";
  sourceProgramId?: string;
  sourceProgramSessionId?: string;
  sourceScheduledDateKey?: string;
  date?: string;
  exercises: {
    name: string;
    sets: WorkoutSet[];
  }[];
  duration?: number;
  totalVolume?: number;
  /**
   * How the session felt, captured immediately after it.
   *
   * This has been written since the check-in screen shipped and read by nothing
   * — not the coach dashboard, not the client's day, not the daily report. It
   * is the only subjective signal in the product, and the one a coach needs to
   * decide whether a missed session is fatigue, life, or an injury starting.
   *
   * `pain` is deliberately NOT a 1-5 scale like the others. Soreness at 5/5 is
   * a normal outcome of a hard session; pain at 5/5 is a stop signal. Putting
   * them on the same scale is how a coach reads "4" and moves on. A flag forces
   * a yes/no, and the note says where — which is what actually changes the next
   * prescription.
   *
   * `sleepHours` is hours, not a rating, for the same reason: "5 hours" tells a
   * coach what to do with tomorrow's volume; "sleep 2/5" does not.
   */
  checkIn?: StoredCheckIn;
  createdAt?: any;
}

export interface PrescribedWorkout {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  description?: string;
  exercises: {
    name: string;
    type?: WorkoutSetType;
    targetSets: number;
    targetReps: string;
    restTime?: string;
  }[];
  isCompleted: boolean;
  assignedAt: any;
}

export interface BodyMetric extends ClientDateMetadata {
  id: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  createdAt?: any;
}

/*
 * Program, ProgramWeek and ProgramSession used to be declared here as well.
 *
 * They were a stale duplicate: nothing wrote them, nothing outside this file
 * read them, and they had drifted from the real persisted shape — the local
 * ProgramSession declared `dayNumber`, a field no code in the repo has ever
 * written, while every actual document carries `sessionNumber`. The local
 * Program was also missing `durationWeeks` and `assignedAt`.
 *
 * The authoritative definitions live in services/programService.ts, which is
 * what CreateProgramScreen writes and what subscribeToTraineePrograms reads.
 * Import them from there (or via services/userSession).
 */
