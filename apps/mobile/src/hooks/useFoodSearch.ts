import { useState, useCallback, useEffect } from "react";
import { searchFood, type FoodItem } from "../services/nutritionSearchService";

type UseFoodSearchOptions = {
  debounceMs?: number;
};

export function useFoodSearch(options: UseFoodSearchOptions = {}) {
  const { debounceMs = 400 } = options;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // `isActive` prevents a slow in-flight search from resolving after the
    // component unmounted (setState-after-unmount warning) or, worse, after a
    // newer query already returned — which would overwrite fresh results with
    // stale ones.
    let isActive = true;

    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchFood(trimmed);
        if (isActive) setResults(found);
      } catch (e) {
        console.error("Food search failed:", e);
        if (isActive) setResults([]);
      } finally {
        if (isActive) setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      isActive = false;
      clearTimeout(handler);
    };
  }, [query, debounceMs]);

  return {
    query,
    setQuery,
    results,
    isSearching,
  };
}
