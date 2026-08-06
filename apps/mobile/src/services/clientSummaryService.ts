import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  setDoc,
  where,
  increment,
  limit,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { localDateKeyDaysAgo } from "../utils/dateKeys";
import type { ClientSummary as SharedClientSummary } from "../../../../packages/shared/src";
import { markThreadRead } from "./chatService";

export type ClientSummary = SharedClientSummary;

const usersCollection = "users";
const summariesCollection = "summaries";

const toClientSummaryDocument = (data: Record<string, unknown>): ClientSummary => {
  const summary: ClientSummary = {};

  Object.entries(data).forEach(([key, value]) => {
    if (!key.startsWith("clientSummary.")) return;
    const field = key.replace("clientSummary.", "") as keyof ClientSummary;
    (summary as Record<string, unknown>)[field] = value;
  });

  return summary;
};

const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code || "") : "";
  if (code.includes("not-found")) return true;
  const message = "message" in error ? String((error as { message?: string }).message || "") : "";
  return message.toLowerCase().includes("not-found");
};

const safeUpdate = async (uid: string, data: Record<string, unknown>) => {
  const ref = doc(db, usersCollection, uid);
  const summaryRef = doc(db, usersCollection, uid, summariesCollection, "client");
  const summaryData = toClientSummaryDocument(data);

  try {
    await updateDoc(ref, data);
  } catch (error) {
    await setDoc(ref, data, { merge: true });
  }

  if (Object.keys(summaryData).length > 0) {
    await setDoc(summaryRef, summaryData, { merge: true });
  }
};

export const updateClientSummaryAfterWorkout = async (uid: string): Promise<void> => {
  const since = Timestamp.fromDate(new Date(Date.now() - 7 * 86400000));
  const q = query(
    collection(db, usersCollection, uid, "workouts"),
    where("createdAt", ">=", since),
    limit(100)
  );

  const snapshot = await getDocs(q);
  const workoutsLast7Days = snapshot.size;

  await safeUpdate(uid, {
    "clientSummary.workoutsLast7Days": workoutsLast7Days,
    "clientSummary.lastWorkoutAt": serverTimestamp(),
    "clientSummary.updatedAt": serverTimestamp(),
  });
};

export const updateClientSummaryAfterMeal = async (uid: string): Promise<void> => {
  const dateStr = localDateKeyDaysAgo(6);
  const q = query(
    collection(db, usersCollection, uid, "meals"),
    where("date", ">=", dateStr),
    limit(100)
  );

  const snapshot = await getDocs(q);
  const meals = snapshot.docs.map((docSnap) => docSnap.data());
  const totalProtein = meals.reduce((sum, meal) => sum + (Number(meal.protein) || 0), 0);

  await safeUpdate(uid, {
    "clientSummary.mealsLast7Days": meals.length,
    "clientSummary.avgDailyProtein": Math.round(totalProtein / 7),
    "clientSummary.lastMealAt": serverTimestamp(),
    "clientSummary.updatedAt": serverTimestamp(),
  });
};

export const updateClientSummaryAfterMessage = async (params: {
  traineeId: string;
  senderId: string;
  text: string;
  incrementUnreadForCoach?: boolean;
}): Promise<void> => {
  const updates: Record<string, unknown> = {
    "clientSummary.lastMessageAt": serverTimestamp(),
    "clientSummary.lastMessageText": params.text,
    "clientSummary.lastMessageSenderId": params.senderId,
    "clientSummary.updatedAt": serverTimestamp(),
  };

  if (params.incrementUnreadForCoach) {
    updates["clientSummary.unreadCoachCount"] = increment(1);
  }

  await safeUpdate(params.traineeId, updates);
};

export const clearCoachUnread = async (traineeId: string, threadId?: string): Promise<void> => {
  if (threadId) {
    await markThreadRead(threadId);
    return;
  }

  const updates = {
    "clientSummary.unreadCoachCount": 0,
    "clientSummary.updatedAt": serverTimestamp(),
  };

  await safeUpdate(traineeId, updates);
};
