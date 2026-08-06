/**
 * useDailyNutrition — Subscribes to today's meals for the current user.
 * Encapsulates the subscribeToDailyMeals pattern.
 */
import { useEffect, useState } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { subscribeToDailyMeals, type Meal } from "../services/nutritionService";
import { useCurrentUser } from "./useCurrentUser";
import { useClientDateKey } from "./useClientDateKey";

export function useDailyNutrition(clientTimezone?: string | null) {
  const uid = useCurrentUser();
  const [meals, setMeals] = useState<Meal[]>([]);
  const dateKey = useClientDateKey(clientTimezone);

  useEffect(() => {
    if (!uid) {
      setMeals([]);
      return;
    }

    return subscribeWithCache(
      `dailyMeals:${uid}:${dateKey}`,
      (emit) => subscribeToDailyMeals(uid, dateKey, emit),
      setMeals
    );
  }, [uid, dateKey]);

  return meals;
}
