import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit as firestoreLimit,
  query as firestoreQuery,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { searchAscendExercises } from "../services/exerciseMediaService";
import { EXERCISE_LIBRARY, type ExerciseLibraryItem, t as tEx } from "../constants/exercises";

type UseExerciseSearchOptions = {
  minQueryLength?: number;
  fetchLimit?: number;
  displayLimit?: number;
  debounceMs?: number;
  includeEquipment?: boolean;
  includeMuscleGroup?: boolean;
};

type CacheEntry = {
  results: ExerciseLibraryItem[];
  expiresAt: number;
};

const CACHE_TTL_MS = 2 * 60 * 1000;
const searchCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ExerciseLibraryItem[]>>();

const normalize = (value: string) => value.trim().toLowerCase();

const fetchRemoteExercises = async (
  searchText: string,
  fetchLimit: number
): Promise<ExerciseLibraryItem[]> => {
  const q = firestoreQuery(
    collection(db, "exercises"),
    where("nameLower", ">=", searchText),
    where("nameLower", "<=", `${searchText}\uf8ff`),
    firestoreLimit(fetchLimit)
  );

  const querySnapshot = await getDocs(q);
  const results: ExerciseLibraryItem[] = [];
  querySnapshot.forEach((exerciseDoc) => {
    results.push(exerciseDoc.data() as ExerciseLibraryItem);
  });

  const apiResults = await searchAscendExercises(searchText, fetchLimit).catch((error) => {
    console.warn("AscendAPI search failed:", error);
    return [] as ExerciseLibraryItem[];
  });

  const seenIds = new Set(results.map((exercise) => exercise.id));
  return [
    ...results,
    ...apiResults.filter((exercise) => !seenIds.has(exercise.id)),
  ];
};

export function useExerciseSearch(options: UseExerciseSearchOptions = {}) {
  const {
    minQueryLength = 2,
    fetchLimit = 20,
    displayLimit = 30,
    debounceMs = 500,
    includeEquipment = false,
    includeMuscleGroup = true,
  } = options;

  const [query, setQuery] = useState("");
  const [remoteExercises, setRemoteExercises] = useState<ExerciseLibraryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const normalizedQuery = normalize(query);

    if (normalizedQuery.length < minQueryLength) {
      setRemoteExercises([]);
      setIsSearching(false);
      return;
    }

    let isActive = true;
    const cacheKey = `${normalizedQuery}|${fetchLimit}`;
    const cached = searchCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      setRemoteExercises(cached.results);
      setIsSearching(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      setIsSearching(true);

      let pending = inFlight.get(cacheKey);
      if (!pending) {
        pending = fetchRemoteExercises(normalizedQuery, fetchLimit);
        inFlight.set(cacheKey, pending);
      }

      pending
        .then((results) => {
          if (!isActive) return;
          searchCache.set(cacheKey, {
            results,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          inFlight.delete(cacheKey);
          setRemoteExercises(results);
          setIsSearching(false);
        })
        .catch((error) => {
          if (!isActive) return;
          console.error("Exercise search failed:", error);
          inFlight.delete(cacheKey);
          setRemoteExercises([]);
          setIsSearching(false);
        });
    }, debounceMs);

    return () => {
      isActive = false;
      clearTimeout(debounceTimer);
    };
  }, [query, minQueryLength, fetchLimit, debounceMs]);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = normalize(query);

    const matchesLibrary = EXERCISE_LIBRARY.filter((exercise) => {
      const nameMatch = tEx(exercise.name).toLowerCase().includes(normalizedQuery);
      const muscleMatch =
        includeMuscleGroup &&
        exercise.muscleGroup?.toLowerCase().includes(normalizedQuery);
      const equipmentMatch =
        includeEquipment &&
        exercise.equipment?.toLowerCase().includes(normalizedQuery);

      return nameMatch || muscleMatch || equipmentMatch;
    });

    const seen = new Set(matchesLibrary.map((exercise) => exercise.id));
    const merged = [
      ...matchesLibrary,
      ...remoteExercises.filter((exercise) => !seen.has(exercise.id)),
    ];

    return merged.slice(0, displayLimit);
  }, [query, remoteExercises, includeEquipment, includeMuscleGroup, displayLimit]);

  const findExerciseInfo = useCallback(
    (lookup: { id?: string; name?: string } | string) => {
      const id = typeof lookup === "string" ? undefined : lookup.id;
      const name = typeof lookup === "string" ? lookup : lookup.name;
      const normalizedName = name ? normalize(name) : "";

      return (
        [...EXERCISE_LIBRARY, ...remoteExercises].find((candidate) => {
          if (id && candidate.id === id) return true;
          if (!normalizedName) return false;
          return normalize(tEx(candidate.name)) === normalizedName;
        }) ?? null
      );
    },
    [remoteExercises]
  );

  return {
    query,
    setQuery,
    isSearching,
    remoteExercises,
    filteredExercises,
    findExerciseInfo,
  };
}
