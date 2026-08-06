import { useEffect, useState } from "react";
import { toLocalDateKey } from "../utils/dateKeys";

export function useLocalDateKey(pollMs = 60000) {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = toLocalDateKey();
      setDateKey((prev) => (prev === next ? prev : next));
    }, pollMs);

    return () => clearInterval(interval);
  }, [pollMs]);

  return dateKey;
}
