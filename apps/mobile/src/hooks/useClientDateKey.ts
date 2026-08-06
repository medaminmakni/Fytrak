import { useEffect, useState } from "react";
import { getClientTodayDateKey } from "../utils/dateKeys";

/**
 * The current calendar date for a client's configured timezone.
 *
 * This hook is for the client's own "today" surfaces. Coach report screens
 * must use the selected client's stored date keys instead of the coach device.
 */
export function useClientDateKey(
  clientTimezone: string | null | undefined,
  pollMs = 60000
) {
  const [dateKey, setDateKey] = useState(() => getClientTodayDateKey(clientTimezone));

  useEffect(() => {
    const update = () => {
      const next = getClientTodayDateKey(clientTimezone);
      setDateKey((previous) => (previous === next ? previous : next));
    };

    update();
    const interval = setInterval(update, pollMs);
    return () => clearInterval(interval);
  }, [clientTimezone, pollMs]);

  return dateKey;
}
