/**
 * Profile Service — User profile CRUD, onboarding, and metrics.
 * Part of Feature-Sliced Design (FSD) refactoring.
 */
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { appEnv } from "../config/env";
import type { AssignmentStatus, SessionState, UserRole } from "../state/types";
import { authenticatedSessionState, defaultSessionData, toSessionState } from "../state/session";
import {
  clientDateFields,
  getDeviceTimeZone,
  isValidTimeZone,
  resolveClientDateContext,
} from "../utils/dateKeys";
import {
  cancelCoachAssignmentRequest,
  requestCoachAssignment,
} from "./assignmentService";
import {
  dailyReportActivityPatch,
  dailyReportPresenceClearPatch,
  dailyReportRef,
  readDailyReportFlags,
} from "./dailyReportService";

import type { UserProfile, ProfileLevel } from "../types/domain";
export type { UserProfile, ProfileLevel };

export type CompleteProfilePayload = {
  goal: string | null;
  weight: number;
  height: number;
  birthday: string;
  gender?: "male" | "female" | null;
  level?: string | null;
  city?: string;
  country?: string;
  macroTargets?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
};

export type WorkoutIntakePayload = {
  level: ProfileLevel;
  lastTrainedDate: string;
  trainingExperience: string;
  healthIssues: string;
  flexibility: number;
  injuries: string;
  work: {
    toughness: number;
    timing: string;
    stress: number;
  };
};

export type NutritionIntakePayload = {
  activityLevel: string;
  medical: {
    allergies: string;
    medications: string;
  };
  lifestyle: {
    smoker: boolean;
    cigarettesPerDay: number;
    coffeePerDay: number;
    alcoholPerDay: number;
    sleepHours: number;
    sleepTiming: string;
  };
  nutrition: {
    specificDishes: string;
    supplements: string;
    regularEating: boolean;
  };
};

export type BodyMetric = {
  id: string;
  weight: number;
  bodyFat?: number;
  date: string;
  clientDateKey?: string;
  timezone?: string | null;
  dateKeyProvenance?: "client_timezone" | "device_inferred";
  createdAt: any;
};

export type ProgressPhoto = {
  id: string;
  url: string;
  /** Dual-written with clientDateKey; remains the queryable field. */
  date: string;
  clientDateKey?: string;
  timezone?: string | null;
  dateKeyProvenance?: "client_timezone" | "device_inferred";
  type: "front" | "side" | "back";
  createdAt: any;
};

const usersCollection = "users";

// --- SESSION ---

export const ensureUserSession = async (uid: string, initialRole?: UserRole): Promise<SessionState> => {
  const ref = doc(db, usersCollection, uid);
  const snapshot = await getDoc(ref);
  const authUser = auth.currentUser;

  if (!snapshot.exists()) {
    const initialData = {
      ...defaultSessionData,
      role: initialRole || defaultSessionData.role,
      name: authUser?.displayName || "Anonymous",
      profileImageUrl: authUser?.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialData);
    return toSessionState(initialData);
  }

  const data = snapshot.data();
  const providerProfilePatch: Record<string, unknown> = {};

  if (authUser?.displayName && data?.name !== authUser.displayName) {
    providerProfilePatch.name = authUser.displayName;
  }
  if (authUser?.photoURL && !data?.profileImageUrl) {
    providerProfilePatch.profileImageUrl = authUser.photoURL;
  }

  if (Object.keys(providerProfilePatch).length > 0) {
    await setDoc(
      ref,
      { ...providerProfilePatch, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  return toSessionState(data);
};

export const subscribeToSessionState = (uid: string, callback: (session: SessionState) => void) => {
  const ref = doc(db, usersCollection, uid);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(toSessionState(snapshot.data()));
      } else {
        callback(authenticatedSessionState());
      }
    },
    (error) => {
      console.error("[ProfileService] Session sync failed:", error);
      callback(authenticatedSessionState());
    }
  );
};

// --- PROFILE CRUD ---

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile) => void) => {
  const ref = doc(db, usersCollection, uid);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback({
          uid,
          email: "",
          role: "trainee",
          goal: "Not set",
          macroTargets: { calories: 2100, protein: 160, carbs: 220, fats: 65 },
          workoutProfileCompleted: false,
          nutritionProfileCompleted: false,
          isPremium: false,
          assignmentStatus: "unassigned",
          selectedCoachId: null,
          selectedCoachName: null,
        });
        return;
      }
      const data = snapshot.data();
      const profile = data.profile || {};
      const basic = profile.basic || {};
      const training = profile.training || {};
      const nutritionProfile = profile.nutritionProfile || {};
      callback({
        uid,
        email: data.email || "",
        role: data.role || "trainee",
        goal: basic.goal || profile.goal || data.goal || "Not set",
        level: training.level || basic.level || profile.level,
        injuries: training.injuries || profile.injuries,
        name: data.name,
        bio: data.bio || profile.bio,
        macroTargets: data.macroTargets || { calories: 2100, protein: 160, carbs: 220, fats: 65 },
        workoutProfileCompleted: data.workoutProfileCompleted || false,
        nutritionProfileCompleted: data.nutritionProfileCompleted || false,
        isPremium: data.isPremium || false,
        lifestyle: nutritionProfile.lifestyle || profile.lifestyle || data.lifestyle,
        medical: nutritionProfile.medical || profile.medical || data.medical,
        nutrition: nutritionProfile.nutrition || profile.nutrition || data.nutrition,
        work: training.work || profile.work || data.work,
        weight: basic.weight || profile.weight || data.weight,
        height: basic.height || profile.height || data.height,
        birthDate: basic.birthDate || profile.birthDate,
        gender: basic.gender || profile.gender,
        city: basic.city || profile.city,
        country: basic.country || profile.country,
        activityLevel: nutritionProfile.activityLevel || profile.activityLevel || data.activityLevel,
        assignmentStatus: data.assignmentStatus || "unassigned",
        selectedCoachId: data.selectedCoachId,
        selectedCoachName: data.selectedCoachName,
        profileImageUrl: data.profileImageUrl,
        timezone: data.timezone ?? null,
        timezoneSource: data.timezoneSource ?? null,
        timezoneCapturedAt: data.timezoneCapturedAt ?? null,
        activeAssignmentId: data.activeAssignmentId ?? null,
        verified: data.verified === true,
      });
    },
    (error) => {
      console.error("[ProfileService] User profile subscription failed:", error);
      callback({
        uid,
        email: "",
        role: "trainee",
        goal: "Not set",
        macroTargets: { calories: 2100, protein: 160, carbs: 220, fats: 65 },
        workoutProfileCompleted: false,
        nutritionProfileCompleted: false,
        isPremium: false,
        assignmentStatus: "unassigned",
        selectedCoachId: null,
        selectedCoachName: null,
      });
    }
  );
};

export const saveCompleteProfile = async (uid: string, payload: CompleteProfilePayload): Promise<void> => {
  const weight = Number(payload.weight);
  const height = Number(payload.height);
  const goal = payload.goal?.trim() || "";
  const birthday = payload.birthday?.trim() || "";
  if (!uid) throw new Error("User id is required.");
  if (!goal) throw new Error("Goal is required to complete onboarding.");
  if (!birthday) throw new Error("Birthday is required to complete onboarding.");
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("Valid weight is required.");
  if (!Number.isFinite(height) || height <= 0) throw new Error("Valid height is required.");

  const ref = doc(db, usersCollection, uid);
  await setDoc(ref, {
    profileCompleted: true,
    profile: {
      basic: {
        goal,
        weight,
        height,
        birthDate: payload.birthday,
        gender: payload.gender || null,
        level: payload.level || null,
        city: payload.city?.trim() || "",
        country: payload.country?.trim() || "",
      },
    },
    workoutProfileCompleted: false,
    nutritionProfileCompleted: false,
    macroTargets: payload.macroTargets || { calories: 2100, protein: 160, carbs: 220, fats: 65 },
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const saveWorkoutIntake = async (uid: string, payload: WorkoutIntakePayload): Promise<void> => {
  const ref = doc(db, usersCollection, uid);
  await setDoc(ref, {
    workoutProfileCompleted: true,
    profile: {
      training: payload,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const saveNutritionIntake = async (uid: string, payload: NutritionIntakePayload): Promise<void> => {
  const ref = doc(db, usersCollection, uid);
  await setDoc(ref, {
    nutritionProfileCompleted: true,
    profile: {
      nutritionProfile: payload,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>): Promise<void> => {
  const ref = doc(db, usersCollection, uid);
  await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
};

export const saveUserRole = async (uid: string, role: UserRole): Promise<void> => {
  const ref = doc(db, usersCollection, uid);
  await setDoc(ref, { role, updatedAt: serverTimestamp() }, { merge: true });
};

// --- ASSIGNMENT ---

export const saveCoachRequest = async (uid: string, coach: { id: string; name: string }): Promise<void> => {
  await requestCoachAssignment(uid, coach);
};

export const saveAssignmentStatus = async (uid: string, status: AssignmentStatus): Promise<void> => {
  if (status === "unassigned") {
    await cancelCoachAssignmentRequest(uid);
    return;
  }

  throw new Error(`Assignment status '${status}' must be changed through the coach request workflow.`);
};

// --- BODY METRICS ---

export const saveBodyMetric = async (
  uid: string,
  metric: { weight: number; bodyFat?: number },
  clientTimezone?: string | null
): Promise<void> => {
  const dateContext = resolveClientDateContext(clientTimezone);
  const collRef = collection(db, usersCollection, uid, "metrics");
  const userRef = doc(db, usersCollection, uid);

  const data: any = {
    weight: Number(metric.weight),
    ...clientDateFields(dateContext),
    createdAt: serverTimestamp(),
  };
  const profileUpdates: any = { weight: Number(metric.weight), updatedAt: serverTimestamp() };

  if (metric.bodyFat !== undefined && metric.bodyFat !== null) {
    const bf = Number(metric.bodyFat);
    data.bodyFat = bf;
    profileUpdates.bodyFat = bf;
  }

  // Queries stay on `date`, which is dual-written with the same value as
  // clientDateKey — so existing indexes keep working through the migration.
  const todayQuery = query(collRef, where("date", "==", dateContext.dateKey), limit(1));
  const existing = await getDocs(todayQuery);

  const batch = writeBatch(db);
  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    batch.set(doc(db, usersCollection, uid, "metrics", existingDoc.id), data);
  } else {
    batch.set(doc(collRef), data);
  }

  batch.set(userRef, {
    profile: {
      basic: profileUpdates,
    },
  }, { merge: true });
  batch.set(dailyReportRef(uid, dateContext.dateKey), dailyReportActivityPatch(uid, dateContext, "Metrics"), { merge: true });
  await batch.commit();
};

export const subscribeToLatestMetrics = (
  uid: string,
  callback: (metrics: BodyMetric[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, usersCollection, uid, "metrics"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(
    q,
    (snapshot) => {
      const metrics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BodyMetric));
      callback(metrics);
    },
    (error) => {
      console.error("[ProfileService] Metrics subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback([]);
    }
  );
};

/**
 * Records an account's IANA timezone once.
 *
 * Called at onboarding for new users and on the next authenticated session for
 * existing ones. Deliberately a no-op when a zone is already stored, so a
 * client who travels does not silently re-anchor their historical days — a
 * relocation is a product decision, not something to infer from a device.
 *
 * Writes nothing at all when the runtime cannot report a zone. A null timezone
 * is honest; a fabricated country default is not.
 */
export const captureAccountTimezone = async (
  uid: string,
  existingTimezone?: string | null
): Promise<void> => {
  if (!uid) return;
  if (isValidTimeZone(existingTimezone)) return;

  const deviceZone = getDeviceTimeZone();
  if (!isValidTimeZone(deviceZone)) return;

  try {
    await setDoc(
      doc(db, usersCollection, uid),
      {
        timezone: deviceZone,
        timezoneSource: "captured",
        timezoneCapturedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Never block a session on telemetry-grade metadata.
    console.error("[ProfileService] Timezone capture failed:", error);
  }
};

// --- PROGRESS PHOTOS ---

/**
 * Saves the day's progress photo.
 *
 * ONE PHOTO PER CLIENT-LOCAL DAY, enforced by document identity: the document
 * id IS the client date key, so a second save for the same day replaces the
 * first rather than accumulating. This is structural — there is no counter to
 * get out of step, and it holds without a trusted backend.
 *
 * Scope of that guarantee, stated precisely:
 *   - It applies to photos written by this function.
 *   - Photos saved before this change have auto-generated ids and are NOT
 *     covered; a legacy document and a new one can coexist for the same date.
 *   - It is a data-shape guarantee only. It is NOT the deferred privacy
 *     guarantee: V0 has no one-session viewing, no post-view locking, and no
 *     deletion of the uploaded bytes. Those need the custom backend.
 */
export const saveProgressPhoto = async (uid: string, photo: Omit<ProgressPhoto, "id" | "createdAt">): Promise<void> => {
  if (!uid) throw new Error("User id is required.");
  const dateContext = {
    dateKey: photo.clientDateKey || photo.date,
    timezone: photo.timezone || "",
    provenance: photo.dateKeyProvenance || "device_inferred" as const,
  };
  if (!dateContext.dateKey) throw new Error("A client date is required for a progress photo.");

  const photoRef = doc(db, usersCollection, uid, "photos", dateContext.dateKey);
  const batch = writeBatch(db);
  batch.set(photoRef, { ...photo, createdAt: serverTimestamp() });
  batch.set(dailyReportRef(uid, dateContext.dateKey), dailyReportActivityPatch(uid, dateContext, "Photo"), { merge: true });
  await batch.commit();
};

export const subscribeToProgressPhotos = (
  uid: string,
  callback: (photos: ProgressPhoto[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, usersCollection, uid, "photos"), orderBy("createdAt", "desc"), limit(20));
  return onSnapshot(
    q,
    (snapshot) => {
      const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgressPhoto));
      callback(photos);
    },
    (error) => {
      console.error("[ProfileService] Progress photos subscription failed:", error);
      if (onError) {
        onError(error);
        return;
      }
      callback([]);
    }
  );
};

/**
 * Deletes a progress photo and clears the day's photo flag when it was the last
 * one for that date.
 *
 * Only the Firestore document is removed. The uploaded image itself stays on
 * the media provider — deleting the bytes needs an authenticated admin call
 * that cannot be made from an untrusted client. See V0_RUNTIME_ARCHITECTURE.md;
 * this is one of the guarantees explicitly deferred to the custom backend, and
 * V0 must not imply the image is gone.
 */
export const deleteProgressPhoto = async (uid: string, photoId: string): Promise<void> => {
  if (!uid) throw new Error("User id is required.");
  const ref = doc(db, usersCollection, uid, "photos", photoId);

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  const dateKey = typeof data.clientDateKey === "string"
    ? data.clientDateKey
    : typeof data.date === "string" ? data.date : null;

  await deleteDoc(ref);

  if (!dateKey) return;

  const remaining = await getDocs(query(
    collection(db, usersCollection, uid, "photos"),
    where("date", "==", dateKey),
    limit(1)
  ));
  if (!remaining.empty) return;

  const flags = await readDailyReportFlags(uid, dateKey);
  if (!flags) return;

  await updateDoc(
    dailyReportRef(uid, dateKey),
    dailyReportPresenceClearPatch("Photo", flags)
  );
};

// --- PROFILE IMAGE ---

export async function uploadProfileImage(userId: string, uri: string) {
  try {
    const uploadEndpoint = `https://api.cloudinary.com/v1_1/${appEnv.cloudinary.cloudName}/image/upload`;
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'avatar.jpg' } as any);
    data.append('upload_preset', appEnv.cloudinary.uploadPreset);
    data.append('cloud_name', appEnv.cloudinary.cloudName);
    data.append('folder', `fytrak/profiles/${userId}`);

    const response = await fetch(uploadEndpoint, { method: 'POST', body: data });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ProfileService] Cloudinary Error:", errorText);
      throw new Error(`Cloudinary upload failed with status ${response.status}`);
    }
    const result = await response.json();
    const downloadUrl = result.secure_url;
    if (!downloadUrl) throw new Error(result.error?.message || "Cloudinary upload failed");

    await saveUserProfile(userId, { profileImageUrl: downloadUrl });
    return downloadUrl;
  } catch (e) {
    console.error("Cloudinary profile upload failed:", e);
    throw e;
  }
}
