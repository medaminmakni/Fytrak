/**
 * useBodyMetrics — Subscribes to the latest body metrics (weight, body fat).
 * Encapsulates the subscribeToLatestMetrics pattern.
 */
import { useEffect, useState } from "react";
import { subscribeToLatestMetrics, type BodyMetric } from "../services/profileService";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { useCurrentUser } from "./useCurrentUser";

export function useBodyMetrics() {
  const uid = useCurrentUser();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setIsLoading(false);
      return;
    }

    // Routed through subscribeWithCache: ProgressScreen keeps all four tabs
    // mounted, and three of them consume this hook — without the cache that
    // was three identical Firestore listeners for the same data.
    const unsubscribe = subscribeWithCache<BodyMetric[]>(
      `latestMetrics:${uid}`,
      (emit) => subscribeToLatestMetrics(uid, emit),
      (data) => {
        setMetrics(data);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  return { metrics, isLoading };
}
