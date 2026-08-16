/**
 * Program Service — Multi-week training program hierarchy.
 * Part of Feature-Sliced Design (FSD) refactoring.
 */
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { isValidDateKey } from "../utils/dateKeys";
import type { WorkoutSetType } from "./workoutService";
import type { ProgramLevel } from "../features/programs/programSchedule";

export type ProgramSuggestedSet = {
  type: WorkoutSetType;
  targetReps?: number;
  targetWeight?: number;
  targetDurationSec?: number;
};

export type ProgramSessionExercise = {
  /** Stable identity. Never array position — reordering must not re-identify. */
  id?: string;
  name: string;
  instructions?: string;
  restTimeSec?: number;
  suggestedSets: ProgramSuggestedSet[];
};

export type ProgramSession = {
  id: string;
  /**
   * Display ordinal within its week. NOT calendar placement — a program that
   * skips or reorders sessions would land on the wrong dates if this were used
   * to schedule. Use `dayOffset`.
   */
  sessionNumber: number;
  /**
   * Whole days from the program's `startDateKey`. 0 is the start day.
   * Absent means this session is unscheduled and is excluded from dated
   * resolution rather than being given an invented date.
   */
  dayOffset?: number | null;
  title: string;
  description?: string;
  estimatedMinutes: number;
  exercises: ProgramSessionExercise[];
  isCompleted: boolean;
};

export type ProgramWeek = {
  id: string;
  weekNumber: number;
  title: string;
  sessions: ProgramSession[];
};

export type Program = {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  description: string;
  /**
   * Descriptive metadata the coach chooses. It NEVER changes sets, reps, load,
   * exercise selection, progression or schedule — Fytrak stores coaching
   * decisions, it does not make them.
   *
   * `EXPERT` was removed: it sat in this union while the picker offered three
   * options, so the type promised a value no coach could select and no screen
   * could render. Legacy documents carrying it still load; `programLevelLabel`
   * reports them as "Level not set" rather than inventing a fourth rung.
   */
  level: ProgramLevel;
  durationWeeks: number;
  weeks: ProgramWeek[];
  assignedAt: any;
  /**
   * The client-local date the program's day 0 falls on. Absent means the
   * program is unscheduled: it still loads and renders in its existing screens,
   * but it never contributes to dated plan resolution.
   */
  startDateKey?: string | null;
  status?: "draft" | "published" | null;
  planVersion?: number | null;
  publishedAt?: any;
  scheduleTimezone?: string | null;
};

const usersCollection = "users";

// --- PROGRAM CRUD ---

/**
 * Assigns a multi-week program.
 *
 * `startDateKey` anchors day 0 to a client-local date. Sessions are then placed
 * by their own explicit `dayOffset` — never by week number, session number or
 * array position, all of which describe presentation order and drift the moment
 * a coach reorders a week.
 *
 * Omitting `startDateKey` writes the program exactly as before Phase D: it
 * loads and renders normally, but is unscheduled and excluded from dated
 * resolution.
 */
export const saveProgram = async (coachId: string, traineeId: string, program: Omit<Program, "id" | "coachId" | "coachName" | "assignedAt">): Promise<void> => {
  if (program.startDateKey && !isValidDateKey(program.startDateKey)) {
    throw new Error("A program start date must be a valid YYYY-MM-DD client date.");
  }

  const ref = collection(db, usersCollection, traineeId, "programs");
  const coachSnapshot = await getDoc(doc(db, usersCollection, coachId));
  const coachName = coachSnapshot.data()?.name || "Unknown Coach";
  await addDoc(ref, {
    ...program,
    coachId,
    coachName,
    ...(program.startDateKey ? { status: "published", publishedAt: serverTimestamp() } : {}),
    assignedAt: serverTimestamp(),
  });
};

export const subscribeToTraineePrograms = (
  uid: string,
  callback: (programs: Program[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, usersCollection, uid, "programs"), orderBy("assignedAt", "desc"), limit(10));
  return onSnapshot(
    q,
    (snapshot) => {
      const programs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
      callback(programs);
    },
    (error) => {
      console.error("[ProgramService] Trainee programs subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback([]);
    }
  );
};
