/**
 * Subscription Service — RevenueCat Webhook event tracking.
 * Part of Feature-Sliced Design (FSD) refactoring.
 *
 * This module prepares Fytrak for RevenueCat-powered in-app purchases.
 * When the RevenueCat webhook fires (via a Cloud Function), it logs
 * the event to Firestore for audit and subscription state management.
 *
 * Flow:
 *   1. User purchases Premium via RevenueCat SDK (iOS/Android)
 *   2. RevenueCat sends a webhook to our Cloud Function
 *   3. Cloud Function calls `logWebhookEvent()` to record the event
 *   4. Cloud Function calls `updatePremiumStatus()` to toggle isPremium
 *   5. The client app picks up the change via the existing profile listener
 */
import {
  doc,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "EXPIRATION"
  | "SUBSCRIBER_ALIAS"
  | "TRANSFER";

export type RevenueCatWebhookEvent = {
  id: string;
  userId: string;
  eventType: RevenueCatEventType;
  productId: string;
  environment: "SANDBOX" | "PRODUCTION";
  expiresAt?: string;
  purchasedAt?: string;
  store: "APP_STORE" | "PLAY_STORE";
  rawPayload?: any;
  createdAt: any;
};

export type SubscriptionStatus = {
  isPremium: boolean;
  plan?: string;
  expiresAt?: string;
  store?: "APP_STORE" | "PLAY_STORE";
};

const usersCollection = "users";

/**
 * Log a RevenueCat webhook event to Firestore.
 * Called by a Cloud Function when RevenueCat sends a webhook.
 */
export const logWebhookEvent = async (
  userId: string,
  event: Omit<RevenueCatWebhookEvent, "id" | "createdAt">
): Promise<void> => {
  const ref = collection(db, usersCollection, userId, "subscriptionEvents");
  await addDoc(ref, {
    ...event,
    createdAt: serverTimestamp(),
  });
};

/**
 * Update a user's premium status based on a webhook event.
 * This is the single source of truth for subscription state.
 */
export const updatePremiumStatus = async (
  userId: string,
  status: SubscriptionStatus
): Promise<void> => {
  const ref = doc(db, usersCollection, userId);
  await setDoc(ref, {
    isPremium: status.isPremium,
    subscription: {
      plan: status.plan || null,
      expiresAt: status.expiresAt || null,
      store: status.store || null,
      updatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Subscribe to a user's recent subscription events (for admin/debug views).
 */
export const subscribeToSubscriptionEvents = (
  userId: string,
  callback: (events: RevenueCatWebhookEvent[]) => void
) => {
  const q = query(
    collection(db, usersCollection, userId, "subscriptionEvents"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RevenueCatWebhookEvent));
      callback(events);
    },
    (error) => {
      console.error("[SubscriptionService] Subscription events subscription failed:", error);
      callback([]);
    }
  );
};

/**
 * Determine if a subscription event type should grant premium access.
 */
export const shouldGrantPremium = (eventType: RevenueCatEventType): boolean => {
  const grantingEvents: RevenueCatEventType[] = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
  ];
  return grantingEvents.includes(eventType);
};

/**
 * Determine if a subscription event type should revoke premium access.
 */
export const shouldRevokePremium = (eventType: RevenueCatEventType): boolean => {
  const revokingEvents: RevenueCatEventType[] = [
    "EXPIRATION",
    "BILLING_ISSUE",
  ];
  return revokingEvents.includes(eventType);
};
