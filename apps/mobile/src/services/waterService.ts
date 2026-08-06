import { collection, query, where, onSnapshot, serverTimestamp, doc, getDocs, limit, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { clientDateFields, resolveClientDateContext } from "../utils/dateKeys";
import { dailyReportActivityPatch, dailyReportRef } from "./dailyReportService";

export const saveWaterIntake = async (
  uid: string,
  ml: number,
  clientTimezone?: string | null
): Promise<void> => {
  const dateContext = resolveClientDateContext(clientTimezone);
  const dateFields = clientDateFields(dateContext);
  const ref = collection(db, "users", uid, "water");

  const q = query(ref, where("date", "==", dateContext.dateKey), limit(1));
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  if (!snap.empty) {
    const existing = snap.docs[0];
    batch.set(doc(db, "users", uid, "water", existing.id), {
      amount: (existing.data().amount || 0) + ml,
      ...dateFields,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } else {
    batch.set(doc(ref), { amount: ml, ...dateFields, createdAt: serverTimestamp() });
  }
  batch.set(dailyReportRef(uid, dateContext.dateKey), dailyReportActivityPatch(uid, dateContext, "Water"), { merge: true });
  await batch.commit();
};

export const setWaterIntake = async (
  uid: string,
  ml: number,
  clientTimezone?: string | null
): Promise<void> => {
  const dateContext = resolveClientDateContext(clientTimezone);
  const dateFields = clientDateFields(dateContext);
  const ref = collection(db, "users", uid, "water");
  const q = query(ref, where("date", "==", dateContext.dateKey), limit(1));
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  if (!snap.empty) {
    batch.set(doc(db, "users", uid, "water", snap.docs[0].id), { amount: ml, ...dateFields, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    batch.set(doc(ref), { amount: ml, ...dateFields, createdAt: serverTimestamp() });
  }
  batch.set(dailyReportRef(uid, dateContext.dateKey), dailyReportActivityPatch(uid, dateContext, "Water"), { merge: true });
  await batch.commit();
};

/**
 * Water logged on one specific day. See subscribeToDailyMeals for why
 * `dateKey` is required and why errors are not reported as 0.
 */
export const subscribeToDailyWater = (
  uid: string,
  dateKey: string,
  callback: (ml: number) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, "users", uid, "water"), where("date", "==", dateKey), limit(1));
  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        callback(snapshot.docs[0].data().amount || 0);
      } else {
        callback(0);
      }
    },
    (error) => {
      console.error("[WaterService] Daily water subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback(0);
    }
  );
};
