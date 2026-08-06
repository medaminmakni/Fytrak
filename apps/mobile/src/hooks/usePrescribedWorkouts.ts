import { useEffect, useState } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { subscribeToPrescribedWorkouts, type PrescribedWorkout } from "../services/workoutService";
import { useCurrentUser } from "./useCurrentUser";

export function usePrescribedWorkouts() {
  const uid = useCurrentUser();
  const [prescribed, setPrescribed] = useState<PrescribedWorkout[]>([]);

  useEffect(() => {
    if (!uid) {
      setPrescribed([]);
      return;
    }

    return subscribeWithCache(
      `prescribedWorkouts:${uid}`,
      (emit) => subscribeToPrescribedWorkouts(uid, emit),
      setPrescribed
    );
  }, [uid]);

  return prescribed;
}
