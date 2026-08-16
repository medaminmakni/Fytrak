/**
 * Subscribes to the current user's profile without treating read failures as
 * an absent profile.
 */
import { useCallback, useEffect, useState } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import { subscribeToUserProfile, type UserProfile } from "../services/profileService";
import { useCurrentUser } from "./useCurrentUser";

export function useUserProfile() {
  const uid = useCurrentUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    return subscribeWithCache<UserProfile | null>(
      `profile:${uid}`,
      (emit, onError) => subscribeToUserProfile(uid, emit, onError),
      (data) => {
        setProfile(data);
        setError(null);
        setIsLoading(false);
      },
      () => {
        setProfile(null);
        setError("We couldn't load your profile.");
        setIsLoading(false);
      }
    );
  }, [uid, retryToken]);

  const retry = useCallback(() => {
    setRetryToken((value) => value + 1);
  }, []);

  return { profile, isLoading, error, retry };
}
