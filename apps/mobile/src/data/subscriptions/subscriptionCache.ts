export type Unsubscribe = () => void;

type Listener<T> = (value: T) => void;

type CacheEntry = {
  listeners: Set<Listener<unknown>>;
  unsubscribe: Unsubscribe | null;
  value: unknown;
  hasValue: boolean;
  refCount: number;
};

const cache = new Map<string, CacheEntry>();

/**
 * Shares one live subscription (typically a Firestore onSnapshot) across every
 * component that asks for the same key, and tears it down when the last
 * consumer unsubscribes.
 *
 * Two failure modes this guards against:
 *
 * 1. **Cache poisoning on error.** Services report listener failures by
 *    emitting an empty array. Without an error channel that empty array is
 *    indistinguishable from real data, gets recorded as `hasValue`, and is then
 *    served instantly to every future subscriber — with no listener alive to
 *    ever correct it. `onError` below drops the entry instead, so the next
 *    subscriber re-subscribes and can recover.
 *
 * 2. **Non-idempotent unsubscribe.** A stale unsubscribe closure called twice
 *    (React StrictMode double-invoke, or defensive cleanup) used to decrement a
 *    *different* subscriber's entry — silently killing a live listener that
 *    another mounted screen depended on. The `released` flag makes the returned
 *    function safe to call any number of times.
 */
export function subscribeWithCache<T>(
  key: string,
  factory: (emit: Listener<T>, onError?: (error: unknown) => void) => Unsubscribe,
  listener: Listener<T>
): Unsubscribe {
  if (!key) {
    throw new Error("subscribeWithCache requires a key.");
  }

  let entry = cache.get(key);
  if (!entry) {
    entry = {
      listeners: new Set(),
      unsubscribe: null,
      value: null,
      hasValue: false,
      refCount: 0,
    };
    cache.set(key, entry);
  }

  const typedListener = listener as Listener<unknown>;
  entry.listeners.add(typedListener);
  entry.refCount += 1;

  if (!entry.unsubscribe) {
    const created = entry;
    created.unsubscribe = factory(
      (value) => {
        created.value = value;
        created.hasValue = true;
        created.listeners.forEach((cb) => cb(value));
      },
      (error) => {
        // The SDK has already terminated this listener. Evict the entry so the
        // failure is not cached as a legitimate value and the next subscriber
        // establishes a fresh listener.
        console.error(`[subscriptionCache] listener failed for "${key}":`, error);
        const current = cache.get(key);
        if (current !== created) return;
        current.hasValue = false;
        current.value = null;
        current.unsubscribe = null;
        cache.delete(key);
      }
    );
  }

  if (entry.hasValue) {
    listener(entry.value as T);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const current = cache.get(key);
    if (!current) return;
    current.listeners.delete(typedListener);
    current.refCount -= 1;

    if (current.refCount <= 0) {
      current.unsubscribe?.();
      cache.delete(key);
    }
  };
}

/**
 * Tears down every cached subscription. Call on sign-out so the previous
 * account's listeners cannot keep firing (they would start returning
 * permission-denied) and no stale value survives into the next session.
 */
export function clearSubscriptionCache(): void {
  cache.forEach((entry) => {
    try {
      entry.unsubscribe?.();
    } catch (error) {
      console.error("[subscriptionCache] failed to tear down listener:", error);
    }
    entry.listeners.clear();
  });
  cache.clear();
}
