/**
 * Workout Service — Workout logging, prescriptions, and set tracking.
 * Part of Feature-Sliced Design (FSD) refactoring.
 */
import {
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { clientDateFields, isValidDateKey, resolveClientDateContext } from "../utils/dateKeys";
import { dailyReportActivityPatch, dailyReportRef } from "./dailyReportService";

import type { WorkoutSetType, WorkoutSet, WorkoutLog, PrescribedWorkout } from "../types/domain";
export type { WorkoutSetType, WorkoutSet, WorkoutLog, PrescribedWorkout };

/**
 * @deprecated Superseded by `StoredCheckIn` in features/workouts/checkIn.ts,
 * where every field is optional because an unanswered question is stored as an
 * absent key rather than a default value. Kept only for any old import path.
 */
export type WorkoutCheckIn = {
  energy?: number;
  soreness?: number;
  mood?: number;
};

const usersCollection = "users";

// --- WORKOUT LOGGING ---

export const saveWorkoutLog = async (
  uid: string,
  workout: Omit<WorkoutLog, "id" | "date" | "clientDateKey" | "timezone" | "dateKeyProvenance">,
  clientTimezone?: string | null
): Promise<string> => {
  if (!uid) throw new Error("User id is required.");
  if (!workout.name?.trim()) throw new Error("Workout name is required.");
  if (!Array.isArray(workout.exercises) || workout.exercises.length === 0) {
    throw new Error("At least one completed exercise is required.");
  }

  const dateContext = resolveClientDateContext(clientTimezone);
  const dateFields = clientDateFields(dateContext);

  const ref = collection(db, usersCollection, uid, "workouts");
  const recentSnapshot = await getDocs(query(
    ref,
    where("createdAt", ">=", Timestamp.fromMillis(Date.now() - 7 * 86400000)),
    limit(100)
  ));
  const docRef = doc(ref);
  const batch = writeBatch(db);
  batch.set(docRef, {
    ...workout,
    ...dateFields,
    createdAt: serverTimestamp(),
  });
  batch.set(
    dailyReportRef(uid, dateContext.dateKey),
    dailyReportActivityPatch(uid, dateContext, "Workout"),
    { merge: true }
  );
  /*
   * Pain is denormalised onto the summary in the SAME batch as the workout, so
   * the coach's queue can never show a pain report for a session that failed to
   * save, or miss one that did.
   *
   * The roster already reads this document for every client, so surfacing pain
   * costs no extra reads and needs no listener per client — which matters
   * because V0 has no scheduler and no functions to do it server-side.
   *
   * A session WITHOUT pain deliberately writes nothing here: it must not clear
   * a report the coach has not acted on yet.
   */
  const painFlagged = workout.checkIn?.painFlagged === true;
  const painNote = typeof workout.checkIn?.painNote === "string"
    ? workout.checkIn.painNote.trim().slice(0, 200)
    : "";

  batch.update(doc(db, usersCollection, uid), {
    "clientSummary.workoutsLast7Days": Math.min(100, recentSnapshot.size + 1),
    "clientSummary.lastWorkoutAt": serverTimestamp(),
    // The client-local day, pinned at write time. Deriving it later would
    // re-date every historical session if the client ever moves timezone.
    "clientSummary.lastWorkoutDateKey": dateContext.dateKey,
    ...(painFlagged
      ? {
          "clientSummary.lastPainAt": serverTimestamp(),
          "clientSummary.lastPainDateKey": dateContext.dateKey,
          ...(painNote ? { "clientSummary.lastPainNote": painNote } : {}),
        }
      : {}),
    "clientSummary.updatedAt": serverTimestamp(),
  });
  await batch.commit();
  return docRef.id;
};

export const subscribeToWorkouts = (uid: string, callback: (workouts: WorkoutLog[]) => void) => {
  const q = query(collection(db, usersCollection, uid, "workouts"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const workouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutLog));
      callback(workouts);
    },
    (error) => {
      console.error("[WorkoutService] Workouts subscription failed:", error);
      callback([]);
    }
  );
};

/**
 * Every workout logged on one specific day — a client can train twice
 * (strength + cardio), so this returns a list, not a single session.
 *
 * Requires the composite index `workouts: date ASC, createdAt DESC`, which is
 * declared in firestore.indexes.json. Deploy indexes before shipping any
 * screen that calls this.
 */
export const subscribeToDailyWorkouts = (
  uid: string,
  dateKey: string,
  callback: (workouts: WorkoutLog[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, usersCollection, uid, "workouts"),
    where("date", "==", dateKey),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const workouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkoutLog));
      callback(workouts);
    },
    (error) => {
      console.error("[WorkoutService] Daily workouts subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback([]);
    }
  );
};

// --- PRESCRIBED WORKOUTS ---

/**
 * Assigns a workout prescription.
 *
 * `scheduledDateKey` is optional and additive. When present the prescription
 * becomes the client's plan for that specific client-local date and takes
 * priority over any program session on the same day. When absent the document
 * is written exactly as it was before Phase D — standing, undated content that
 * is shown in the client's prescription list but never claimed as a given
 * day's plan.
 */
export const savePrescribedWorkout = async (
  traineeId: string,
  workout: Omit<PrescribedWorkout, "id" | "assignedAt">,
  scheduledDateKey?: string | null
): Promise<void> => {
  if (!traineeId) throw new Error("Trainee id is required.");
  if (!workout.coachId) throw new Error("Coach id is required.");
  if (!workout.title?.trim()) throw new Error("Workout title is required.");
  if (!Array.isArray(workout.exercises) || workout.exercises.length === 0) {
    throw new Error("At least one exercise is required.");
  }
  if (scheduledDateKey && !isValidDateKey(scheduledDateKey)) {
    throw new Error("A scheduled date must be a valid YYYY-MM-DD client date.");
  }

  const ref = collection(db, usersCollection, traineeId, "prescribedWorkouts");
  await addDoc(ref, {
    ...workout,
    isCompleted: false,
    ...(scheduledDateKey
      ? { scheduledDateKey, status: "published", publishedAt: serverTimestamp() }
      : {}),
    assignedAt: serverTimestamp(),
  });

};

export const subscribeToPrescribedWorkouts = (traineeId: string, callback: (workouts: PrescribedWorkout[]) => void) => {
  const q = query(
    collection(db, usersCollection, traineeId, "prescribedWorkouts"),
    where("isCompleted", "==", false),
    limit(20)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const workouts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PrescribedWorkout)).sort((a, b) => {
        const timeA = a.assignedAt?.seconds || 0;
        const timeB = b.assignedAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(workouts);
    },
    (error) => {
      console.error("[WorkoutService] Prescribed workouts subscription failed:", error);
      callback([]);
    }
  );
};

/**
 * Bounded prescription history for coach-side dated review.
 *
 * The client-facing subscription above intentionally contains only actionable
 * prescriptions. Historical reports need completed prescriptions too, or the
 * planned side disappears as soon as the client completes it.
 */
export const subscribeToPrescriptionHistory = (
  traineeId: string,
  callback: (workouts: PrescribedWorkout[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, usersCollection, traineeId, "prescribedWorkouts"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const workouts = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      } as PrescribedWorkout)).sort((a, b) => {
        const timeA = a.assignedAt?.seconds || 0;
        const timeB = b.assignedAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(workouts);
    },
    (error) => {
      console.error("[WorkoutService] Prescription history subscription failed:", error);
      onError?.(error);
    }
  );
};

export const completePrescribedWorkout = async (traineeId: string, workoutId: string): Promise<void> => {
  const ref = doc(db, usersCollection, traineeId, "prescribedWorkouts", workoutId);
  await setDoc(ref, { isCompleted: true, completedAt: serverTimestamp() }, { merge: true });
};
