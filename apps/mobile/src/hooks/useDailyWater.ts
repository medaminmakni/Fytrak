import { useEffect, useState } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { subscribeToDailyWater } from "../services/waterService";
import { useCurrentUser } from "./useCurrentUser";
import { useClientDateKey } from "./useClientDateKey";

export function useDailyWater(clientTimezone?: string | null) {
  const uid = useCurrentUser();
  const [water, setWater] = useState(0);
  // Keyed on the local date so the subscription rolls over at midnight
  // instead of silently continuing to report yesterday's intake.
  const dateKey = useClientDateKey(clientTimezone);

  useEffect(() => {
    if (!uid) {
      setWater(0);
      return;
    }

    return subscribeWithCache<number>(
      `dailyWater:${uid}:${dateKey}`,
      (emit) => subscribeToDailyWater(uid, dateKey, emit),
      setWater
    );
  }, [uid, dateKey]);

  return water;
}
