import { useEffect, useRef } from "react";
import { captureAccountTimezone } from "../services/profileService";
import { useCurrentUser } from "./useCurrentUser";
import { useUserProfile } from "./useUserProfile";
import { isValidTimeZone } from "../utils/dateKeys";

/**
 * Captures the account's IANA timezone once, on the first authenticated session
 * where it is missing.
 *
 * This covers both new users (captured shortly after onboarding writes the
 * profile) and existing users (captured on their next session), without a
 * migration job — the device is the only place the answer exists.
 *
 * Deliberately does nothing when a zone is already stored. Re-capturing on
 * every launch would silently re-anchor a travelling client's day boundaries,
 * which changes which calendar day their historical logs belong to.
 */
export function useTimezoneCapture() {
  const uid = useCurrentUser();
  const { profile, isLoading } = useUserProfile();
  const attemptedForUid = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || isLoading || !profile) return;
    if (isValidTimeZone(profile.timezone)) return;
    // One attempt per signed-in user per app session; a failure is logged and
    // retried on the next launch rather than looping.
    if (attemptedForUid.current === uid) return;

    attemptedForUid.current = uid;
    void captureAccountTimezone(uid, profile.timezone);
  }, [uid, isLoading, profile]);
}
