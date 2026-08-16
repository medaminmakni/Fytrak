/**
 * Coach Service — Coach profiles, trainee management, and templates.
 * Part of Feature-Sliced Design (FSD) refactoring.
 */
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { ClientSummary } from "./clientSummaryService";
import {
  resolveCoachRequest,
  subscribeToPendingCoachRequests,
  type CoachRequestWithTrainee,
} from "./assignmentService";

export type Coach = {
  id: string;
  name: string;
  specialties: string[];
  rating: number;
  clients: number;
  verified: boolean;
  responseTime: string;
  profileImageUrl?: string | null;
};

export type CoachProfilePayload = {
  bio: string;
  specialties: string[];
  experience: number;
};

export type CoachRequestPayload = {
  id: string;
  name: string;
};

export type CoachTemplate = {
  id: string;
  coachId: string;
  type: "workout" | "meal";
  title: string;
  data: any;
  createdAt: any;
};

export type CoachTrainee = {
  id: string;
  name?: string;
  profile?: {
    goalText?: string;
    goal?: string;
  };
  macroTargets?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  assignmentStatus?: "assigned" | "pending" | "rejected" | "expired" | "unassigned";
  selectedCoachId?: string | null;
  selectedCoachName?: string | null;
  activeAssignmentId?: string | null;
  profileImageUrl?: string | null;
  timezone?: string | null;
  clientSummary?: ClientSummary;
};

/*
 * Re-exported, not re-declared. This was a second copy of the type that lives
 * in features/coaching/coachIntelligence — two structurally identical
 * definitions that had to be edited in lockstep, and adding `timezone` to one
 * of them is what surfaced it.
 */
export type { CoachClientSignal } from "../features/coaching/coachIntelligence";
import type { CoachClientSignal } from "../features/coaching/coachIntelligence";

const usersCollection = "users";

export type CoachRequestCard = CoachRequestWithTrainee;

const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => unknown };
    if (typeof maybeTimestamp.toDate !== "function") return null;
    const parsed = maybeTimestamp.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
};

// --- COACH PROFILE ---

export const saveCoachProfile = async (uid: string, payload: CoachProfilePayload): Promise<void> => {
  const bio = payload.bio.trim();
  const experience = Number(payload.experience) || 0;
  if (!uid) throw new Error("User id is required.");
  if (bio.length <= 10) throw new Error("A short professional bio is required.");
  if (payload.specialties.length === 0) throw new Error("Select at least one specialty.");
  if (experience < 0) throw new Error("Experience cannot be negative.");

  const ref = doc(db, usersCollection, uid);
  await setDoc(ref, {
    profileCompleted: true,
    coachProfile: {
      bio,
      specialties: payload.specialties,
      experience,
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const fetchCoaches = async (): Promise<Coach[]> => {
  const q = query(collection(db, usersCollection), where("role", "==", "coach"), limit(50));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    const cp = data.coachProfile;
    return {
      id: doc.id,
      name: data.name || "Unknown Coach",
      specialties: cp?.specialties || ["Professional Coach"],
      rating: data.rating || 4.9,
      clients: data.clients || 0,
      verified: data.verified || false,
      responseTime: data.responseTime || "Fast",
      // Canonical field written by OAuth and profile uploads. The fallback is
      // temporary compatibility for old test documents.
      profileImageUrl: data.profileImageUrl || data.avatarUrl || null,
    };
  }).sort((a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating);
};

// --- TRAINEE MANAGEMENT ---

export const subscribeToCoachTrainees = (
  coachId: string,
  callback: (trainees: CoachTrainee[]) => void,
  onError?: (error: unknown) => void
) => {
  const q = query(
    collection(db, usersCollection),
    where("selectedCoachId", "==", coachId),
    where("assignmentStatus", "==", "assigned"),
    // NOTE: deliberately no orderBy here. Ordering by clientSummary.updatedAt
    // would silently DROP any client whose clientSummary has not been written
    // yet (Firestore excludes documents missing the ordered field) — i.e.
    // brand-new clients would disappear from the roster. Sorting is done
    // client-side instead. The 100 cap therefore truncates by document ID;
    // paginate here before a coach can realistically exceed 100 clients.
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const trainees = snapshot.docs.map(doc => {
        const data = doc.data();
        const profile = data.profile || {};
        return {
          id: doc.id,
          ...data,
          profile: {
            ...profile,
            goal: profile.basic?.goal || profile.goal,
            goalText: profile.basic?.goal || profile.goalText || profile.goal,
          },
        } as CoachTrainee;
      });
      callback(trainees);
    },
    (error) => {
      console.error("[CoachService] Coach trainees subscription failed:", error);
      // Surface the failure so subscriptionCache can evict rather than cache
      // this as a legitimate empty roster. Still emit [] so the UI renders an
      // empty state instead of hanging on a spinner.
      onError?.(error);
      callback([]);
    }
  );
};

/**
 * Pure projection of an already-loaded roster document. Performs NO I/O —
 * every field comes from the `clientSummary` map that the roster snapshot
 * already carries. Prefer this (inside a useMemo) over the async wrappers
 * below, which only exist for backward compatibility and force callers into
 * a needless loading state for a synchronous computation.
 */
export const toCoachClientSignal = (trainee: CoachTrainee): CoachClientSignal => ({
  traineeId: trainee.id,
  lastWorkoutAt: toDateOrNull(trainee.clientSummary?.lastWorkoutAt),
  // Carried so the coach's screens can resolve the CLIENT's calendar day
  // rather than their own. Null until the client opens the app after timezone
  // capture shipped, which the UI renders as "unknown" rather than guessing.
  timezone: trainee.timezone ?? null,
  lastWorkoutDateKey: trainee.clientSummary?.lastWorkoutDateKey ?? null,
  workoutsLast7Days: trainee.clientSummary?.workoutsLast7Days ?? 0,
  mealsLast7Days: trainee.clientSummary?.mealsLast7Days ?? 0,
  avgDailyProtein: trainee.clientSummary?.avgDailyProtein ?? 0,
  proteinTarget: trainee.macroTargets?.protein ?? null,
});

export const toCoachClientSignals = (trainees: CoachTrainee[]): CoachClientSignal[] =>
  trainees.map(toCoachClientSignal);

/** @deprecated synchronous under the hood — use `toCoachClientSignal`. */
export const fetchCoachClientSignal = async (trainee: CoachTrainee): Promise<CoachClientSignal> =>
  toCoachClientSignal(trainee);


export const respondToTraineeRequest = async (traineeId: string, accept: boolean): Promise<void> => {
  await resolveCoachRequest(traineeId, accept);
};

export { subscribeToPendingCoachRequests };

// --- TEMPLATES ---

export const saveCoachTemplate = async (coachId: string, template: Omit<CoachTemplate, "id" | "coachId" | "createdAt">): Promise<void> => {
  const ref = collection(db, usersCollection, coachId, "templates");
  await addDoc(ref, { ...template, coachId, createdAt: serverTimestamp() });
};

export const updateCoachTemplate = async (coachId: string, templateId: string, updates: Partial<CoachTemplate>): Promise<void> => {
  const ref = doc(db, usersCollection, coachId, "templates", templateId);
  await setDoc(ref, updates, { merge: true });
};

export const subscribeToCoachTemplates = (coachId: string, type: "workout" | "meal" | null, callback: (templates: CoachTemplate[]) => void) => {
  const coll = collection(db, usersCollection, coachId, "templates");
  const q = type ? query(coll, where("type", "==", type), limit(50)) : query(coll, limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const templates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CoachTemplate)).sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(templates);
    },
    (error) => {
      console.error("[CoachService] Coach templates subscription failed:", error);
      callback([]);
    }
  );
};

export const deleteCoachTemplate = async (coachId: string, templateId: string): Promise<void> => {
  const ref = doc(db, usersCollection, coachId, "templates", templateId);
  await deleteDoc(ref);
};
