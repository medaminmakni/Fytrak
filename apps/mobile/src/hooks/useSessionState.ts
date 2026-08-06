import { useEffect, useState } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { subscribeToSessionState } from "../services/profileService";
import { initialSessionState } from "../state/session";
import type { SessionState } from "../state/types";
import { useCurrentUser } from "./useCurrentUser";

export function useSessionState() {
  const uid = useCurrentUser();
  const [session, setSession] = useState<SessionState>(initialSessionState);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSession(initialSessionState);
      setIsBootstrapping(false);
      return;
    }

    setIsBootstrapping(true);

    return subscribeWithCache<SessionState>(
      `session:${uid}`,
      (emit) => subscribeToSessionState(uid, emit),
      (data) => {
        setSession(data);
        setIsBootstrapping(false);
      }
    );
  }, [uid]);

  return { session, isBootstrapping };
}
