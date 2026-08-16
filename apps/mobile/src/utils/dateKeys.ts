/**
 * Date keys.
 *
 * A "date key" is `YYYY-MM-DD` identifying one calendar day. Which day a
 * timestamp falls on depends entirely on whose clock you ask, so every key in
 * Fytrak is anchored to **the client's** timezone — never the coach's, and
 * never the reading device's.
 *
 * Rules that follow from that:
 *
 * 1. Coach-side code NEVER recomputes a client's date key. It reads the stored
 *    `date` string verbatim. A coach in Paris reviewing a client in Tunis must
 *    see the client's day, not their own.
 * 2. At write time the client's own device IS the client, so if no timezone has
 *    been captured yet the device zone is a legitimate stand-in — but the log
 *    records `dateKeyProvenance: "device_inferred"` so the assumption stays
 *    visible instead of being silently trusted.
 * 3. Historical documents are never rewritten. Their originating zone was never
 *    recorded and cannot be reconstructed.
 */

export type DateKeyProvenance = "client_timezone" | "device_inferred";

export type ClientDateContext = {
  /** YYYY-MM-DD in the client's day. */
  dateKey: string;
  /** IANA zone the key was computed in. Empty when the runtime reports none. */
  timezone: string;
  /** Whether `timezone` came from the stored profile or was inferred. */
  provenance: DateKeyProvenance;
};

/**
 * Legacy device-local date key.
 *
 * Retained because every document written before timezone capture used it, and
 * those keys must remain comparable. Prefer `toZonedDateKey` for new code.
 */
export const toLocalDateKey = (date = new Date()): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

export const localDateKeyDaysAgo = (daysAgo: number, fromDate = new Date()): string => {
  const date = new Date(fromDate);
  date.setDate(date.getDate() - daysAgo);
  return toLocalDateKey(date);
};

/** Adds calendar days to a YYYY-MM-DD key without involving the device zone. */
export const addDaysToDateKey = (dateKey: string, days: number): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isInteger(days)) {
    throw new Error("A valid date key and integer day offset are required.");
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new Error(`Invalid date key "${dateKey}".`);
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * The next Monday strictly after `dateKey`, in the same calendar.
 *
 * "Next week" was `addDaysToDateKey(clientToday, 7)` behind a label reading
 * "In a week". That is not a week boundary, it is an offset: asked on a Friday
 * it lands on a Friday, mid-week, which is not when a training week starts.
 *
 * From a Monday it returns the Monday SEVEN days later, never the same day —
 * "next week" said on a Monday cannot mean today, and today is in any case not
 * a legal revision date.
 *
 * Pure string arithmetic in UTC, so a coach's device zone cannot shift which
 * Monday the client gets.
 */
export const nextMondayDateKey = (dateKey: string): string => {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid date key "${dateKey}".`);
  }
  // 0 = Sunday … 6 = Saturday. Read in UTC to match addDaysToDateKey.
  const dayOfWeek = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  // Sunday -> 1, Monday -> 7, Tuesday -> 6 … Saturday -> 2.
  const daysUntilMonday = ((8 - dayOfWeek) % 7) || 7;
  return addDaysToDateKey(dateKey, daysUntilMonday);
};

/**
 * Whole calendar days from `fromDateKey` to `toDateKey`, ignoring zones.
 *
 * The inverse of addDaysToDateKey. Both operate on the date STRING and never
 * touch the device zone, so a coach in Paris and a client in Tunis compute the
 * same offset for the same pair of keys.
 */
export const daysBetweenDateKeys = (fromDateKey: string, toDateKey: string): number => {
  const parse = (key: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Invalid date key "${key}".`);
    const date = new Date(`${key}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) {
      throw new Error(`Invalid date key "${key}".`);
    }
    return date.getTime();
  };
  return Math.round((parse(toDateKey) - parse(fromDateKey)) / 86400000);
};

/** True when `value` is a well-formed, real YYYY-MM-DD calendar date. */
export const isValidDateKey = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** The device's IANA timezone, or null when the runtime cannot report one. */
export const getDeviceTimeZone = (): string | null => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.length > 0 ? zone : null;
  } catch {
    return null;
  }
};

/** True when `timeZone` is a zone this runtime can actually resolve. */
export const isValidTimeZone = (timeZone: string | null | undefined): boolean => {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

/**
 * `YYYY-MM-DD` for `date` as observed in `timeZone`.
 *
 * Built from formatToParts rather than a formatted locale string so the output
 * cannot shift with locale, numbering system, or calendar settings.
 */
export const toZonedDateKey = (timeZone: string, date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month");
  const day = part("day");

  if (!year || !month || !day) {
    throw new Error(`Could not derive a date key for timezone "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
};

/**
 * Resolves the date key to stamp on a log the client is writing right now.
 *
 * `profileTimezone` is the captured IANA zone from the client's profile, or
 * null if capture has not happened yet. Falling back to the device zone is
 * correct *only* here, because the writer is the client. Never call this from
 * coach-side code to interpret a client's day.
 */
export const resolveClientDateContext = (
  profileTimezone: string | null | undefined,
  date = new Date()
): ClientDateContext => {
  if (isValidTimeZone(profileTimezone)) {
    const timezone = profileTimezone as string;
    try {
      return { dateKey: toZonedDateKey(timezone, date), timezone, provenance: "client_timezone" };
    } catch {
      // Fall through to device inference.
    }
  }

  const deviceZone = getDeviceTimeZone();
  if (deviceZone) {
    try {
      return {
        dateKey: toZonedDateKey(deviceZone, date),
        timezone: deviceZone,
        provenance: "device_inferred",
      };
    } catch {
      // Fall through to the offset-based key.
    }
  }

  // The runtime cannot report a zone at all. Use the legacy offset key and
  // label it inferred: an unknown zone is recorded as unknown, never invented.
  return { dateKey: toLocalDateKey(date), timezone: "", provenance: "device_inferred" };
};

/**
 * Resolves "today" for a client's own read surfaces.
 *
 * A captured profile timezone must win over the current device timezone so
 * reads use the same calendar boundary as writes while the client is travelling.
 */
/**
 * The client's current calendar day, falling back to this device's zone.
 *
 * Only correct when the device IS the client's — i.e. on the trainee's own
 * screens, where "my today" and "this phone's today" are the same question.
 *
 * A coach must not call this. See `getForeignClientTodayDateKey`.
 */
export const getClientTodayDateKey = (
  profileTimezone: string | null | undefined,
  date = new Date()
): string => {
  if (isValidTimeZone(profileTimezone)) {
    return toZonedDateKey(profileTimezone as string, date);
  }
  return resolveClientDateContext(null, date).dateKey;
};

/**
 * Another person's current calendar day, or `""` when it cannot be known.
 *
 * The coach-side counterpart. `getClientTodayDateKey` falls back to the device
 * zone, which on a coach's phone silently answers "what day is it HERE" — so a
 * coach in London reviewing a client in Auckland could be a full day out, and
 * every "logged today" and "silent N days" derived from it would be wrong.
 *
 * Returning an empty string forces the caller to render "unknown" rather than
 * quietly substituting the wrong calendar. A missing timezone is a real state:
 * the client has not opened the app since timezone capture shipped.
 */
export const getForeignClientTodayDateKey = (
  clientTimezone: string | null | undefined,
  date = new Date()
): string => {
  if (!isValidTimeZone(clientTimezone)) return "";
  try {
    return toZonedDateKey(clientTimezone as string, date);
  } catch {
    return "";
  }
};

/**
 * The dated fields every client log carries.
 *
 * `date` is dual-written with the same value as `clientDateKey` because
 * Firestore cannot express `clientDateKey ?? date` in a query. Keeping `date`
 * authoritative means every existing query and index keeps working unchanged,
 * and the migration reverts by simply ignoring the new fields.
 */
export const clientDateFields = (context: ClientDateContext) => ({
  date: context.dateKey,
  clientDateKey: context.dateKey,
  timezone: context.timezone || null,
  dateKeyProvenance: context.provenance,
});
