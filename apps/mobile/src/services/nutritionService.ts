/**
 * Nutrition Service — Meal logging, prescribed meal plans, and macro tracking.
 * Part of Feature-Sliced Design (FSD) refactoring.
 */
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  addDaysToDateKey,
  clientDateFields,
  getClientTodayDateKey,
  localDateKeyDaysAgo,
  isValidDateKey,
  resolveClientDateContext,
} from "../utils/dateKeys";
import {
  dailyReportActivityPatch,
  dailyReportPresenceClearPatch,
  dailyReportRef,
  readDailyReportFlags,
} from "./dailyReportService";

import type { Meal, PrescribedMeal } from "../types/domain";
export type { Meal, PrescribedMeal };

const usersCollection = "users";

// --- MEAL LOGGING ---

export const saveMealLog = async (
  uid: string,
  meal: Omit<Meal, "id" | "date" | "createdAt">,
  clientTimezone?: string | null
): Promise<void> => {
  if (!uid) throw new Error("User id is required.");
  if (!meal.name?.trim()) throw new Error("Meal name is required.");

  const dateContext = resolveClientDateContext(clientTimezone);
  const ref = collection(db, usersCollection, uid, "meals");
  const start = new Date(`${dateContext.dateKey}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const recentSnapshot = await getDocs(query(
    ref,
    where("date", ">=", start.toISOString().slice(0, 10)),
    limit(100)
  ));
  const existingProtein = recentSnapshot.docs.reduce(
    (sum, snapshot) => sum + (Number(snapshot.data().protein) || 0),
    0
  );
  const mealRef = doc(ref);
  const batch = writeBatch(db);
  batch.set(mealRef, { ...meal, ...clientDateFields(dateContext), createdAt: serverTimestamp() });
  batch.set(
    dailyReportRef(uid, dateContext.dateKey),
    dailyReportActivityPatch(uid, dateContext, "Meals"),
    { merge: true }
  );
  batch.update(doc(db, usersCollection, uid), {
    "clientSummary.mealsLast7Days": Math.min(100, recentSnapshot.size + 1),
    "clientSummary.avgDailyProtein": Math.round((existingProtein + (Number(meal.protein) || 0)) / 7),
    "clientSummary.lastMealAt": serverTimestamp(),
    "clientSummary.updatedAt": serverTimestamp(),
  });
  await batch.commit();
};

/**
 * Meals logged on one specific day.
 *
 * `dateKey` is required and must be a 'YYYY-MM-DD' key produced by
 * toLocalDateKey() in the *subject's* timezone. It is deliberately not
 * defaulted to today: a coach reviewing a client needs to address a specific
 * day, and a subscription that captured "today" at creation time would keep
 * showing yesterday for anyone who leaves the screen open past midnight.
 *
 * `onError` is also deliberate. Reporting a failed read as an empty array
 * tells a coach "this client logged nothing", which is a materially different
 * (and unsafe) statement from "we could not load this". Callers must
 * distinguish the two.
 */
export const subscribeToDailyMeals = (
  uid: string,
  dateKey: string,
  callback: (meals: Meal[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, usersCollection, uid, "meals"), where("date", "==", dateKey), limit(30));
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal)).sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(meals);
    },
    (error) => {
      console.error("[NutritionService] Daily meals subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback([]);
    }
  );
};

/**
 * Deletes a meal and reconciles the V0 metadata it contributed to.
 *
 * Deleting only the raw document used to leave two lies behind: the daily
 * report kept `hasMeals: true` for a day with no meals left, and the seven-day
 * summary kept counting it. Both are read by the coach.
 *
 * The raw meals remain the source of truth — everything below is recomputed
 * from them, never adjusted by a delta.
 */
export const deleteMealLog = async (uid: string, mealId: string): Promise<void> => {
  if (!uid) throw new Error("User id is required.");
  const ref = doc(db, usersCollection, uid, "meals", mealId);

  // Read the meal BEFORE deleting: its client date is the only reliable way to
  // know which day's report to reconcile.
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  const dateKey = typeof data.clientDateKey === "string"
    ? data.clientDateKey
    : typeof data.date === "string" ? data.date : null;

  await deleteDoc(ref);

  if (!dateKey) return;

  const mealsRef = collection(db, usersCollection, uid, "meals");

  // Does any meal still exist for that day?
  const remainingSameDay = await getDocs(query(mealsRef, where("date", "==", dateKey), limit(1)));

  // Recompute the current client-local seven-day window. Anchoring this to the
  // deleted meal's date would replace today's summary with a historical window.
  const storedTimezone = typeof data.timezone === "string" ? data.timezone : null;
  const currentClientDateKey = getClientTodayDateKey(storedTimezone);
  const summaryStartDateKey = addDaysToDateKey(currentClientDateKey, -6);
  const recentSnapshot = await getDocs(query(
    mealsRef,
    where("date", ">=", summaryStartDateKey),
    limit(100)
  ));
  const totalProtein = recentSnapshot.docs.reduce(
    (sum, mealDoc) => sum + (Number(mealDoc.data().protein) || 0),
    0
  );

  const batch = writeBatch(db);
  batch.update(doc(db, usersCollection, uid), {
    "clientSummary.mealsLast7Days": Math.min(100, recentSnapshot.size),
    "clientSummary.avgDailyProtein": Math.round(totalProtein / 7),
    "clientSummary.updatedAt": serverTimestamp(),
  });

  if (remainingSameDay.empty) {
    const flags = await readDailyReportFlags(uid, dateKey);
    if (flags) {
      batch.update(
        dailyReportRef(uid, dateKey),
        dailyReportPresenceClearPatch("Meals", flags)
      );
    }
  }

  await batch.commit();
};

export const subscribeToHistoricalMeals = (uid: string, days: number, callback: (meals: Meal[]) => void) => {
  const dateStr = localDateKeyDaysAgo(days);

  const q = query(collection(db, usersCollection, uid, "meals"), where("date", ">=", dateStr), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal)).sort((a, b) => b.date.localeCompare(a.date));
      callback(meals);
    },
    (error) => {
      console.error("[NutritionService] Historical meals subscription failed:", error);
      callback([]);
    }
  );
};

// --- PRESCRIBED MEALS ---

/**
 * Assigns a nutrition prescription.
 *
 * `scheduledDateKey` behaves exactly as it does for workouts, and resolves
 * INDEPENDENTLY of the workout dimension — a client can legitimately have a
 * dated nutrition plan alongside a program workout, or the reverse.
 */
export const savePrescribedMeal = async (
  traineeId: string,
  meal: Omit<PrescribedMeal, "id" | "assignedAt">,
  scheduledDateKey?: string | null
): Promise<void> => {
  if (!traineeId) throw new Error("Trainee id is required.");
  if (!meal.coachId) throw new Error("Coach id is required.");
  if (!meal.title?.trim()) throw new Error("Meal plan title is required.");
  if (scheduledDateKey && !isValidDateKey(scheduledDateKey)) {
    throw new Error("A scheduled date must be a valid YYYY-MM-DD client date.");
  }

  const ref = collection(db, usersCollection, traineeId, "prescribed_meals");
  await addDoc(ref, {
    ...meal,
    isApplied: false,
    ...(scheduledDateKey
      ? { scheduledDateKey, status: "published", publishedAt: serverTimestamp() }
      : {}),
    assignedAt: serverTimestamp(),
  });

};

export const subscribeToPrescribedMeals = (traineeId: string, callback: (meals: PrescribedMeal[]) => void) => {
  const q = query(
    collection(db, usersCollection, traineeId, "prescribed_meals"),
    where("isApplied", "==", false),
    limit(20)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PrescribedMeal)).sort((a, b) => {
        const timeA = a.assignedAt?.seconds || 0;
        const timeB = b.assignedAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(meals);
    },
    (error) => {
      console.error("[NutritionService] Prescribed meals subscription failed:", error);
      callback([]);
    }
  );
};

/** Bounded meal-plan history used by coach-side dated reports. */
export const subscribeToPrescribedMealHistory = (
  traineeId: string,
  callback: (meals: PrescribedMeal[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, usersCollection, traineeId, "prescribed_meals"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const meals = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      } as PrescribedMeal)).sort((a, b) => {
        const timeA = a.assignedAt?.seconds || 0;
        const timeB = b.assignedAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(meals);
    },
    (error) => {
      console.error("[NutritionService] Prescribed meal history subscription failed:", error);
      onError?.(error);
    }
  );
};

export const applyPrescribedMeal = async (traineeId: string, mealId: string, macros: PrescribedMeal["macros"]): Promise<void> => {
  const traineeRef = doc(db, usersCollection, traineeId);
  const mealRef = doc(db, usersCollection, traineeId, "prescribed_meals", mealId);
  await setDoc(traineeRef, { macroTargets: macros }, { merge: true });
  await setDoc(mealRef, { isApplied: true, appliedAt: serverTimestamp() }, { merge: true });
};
