/**
 * Client-timezone day boundaries.
 *
 * A daily report belongs to the CLIENT's calendar day, so deciding when that
 * day has ended requires their IANA zone rather than the server's — a report
 * for a client in Tokyo becomes reviewable eight hours before one in Tunis.
 *
 * Kept in its own module with no Firebase imports so the arithmetic can be
 * unit-tested directly; getting a DST transition wrong here would silently
 * finalise the wrong day for every client in that zone.
 */

export const DEFAULT_REPORT_TIMEZONE = "UTC";

export function isResolvableTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds `timeZone` is ahead of UTC at `date`. */
export function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - date.getTime();
}

/**
 * The UTC instant at which local midnight of `dateKey` occurs in `timeZone`.
 *
 * Resolved in two passes because the offset itself depends on the instant: the
 * first guess can land on the wrong side of a DST transition, so the offset is
 * re-measured at the candidate and applied again.
 */
export function localMidnightUtc(dateKey: string, timeZone: string): Date {
  const zone = isResolvableTimeZone(timeZone) ? timeZone : DEFAULT_REPORT_TIMEZONE;
  const guessMs = Date.parse(`${dateKey}T00:00:00Z`);
  let candidate = new Date(guessMs - timeZoneOffsetMs(zone, new Date(guessMs)));
  candidate = new Date(guessMs - timeZoneOffsetMs(zone, candidate));
  return candidate;
}

export function nextDateKey(dateKey: string): string {
  const next = new Date(`${dateKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** The instant the client's day ends — when their report becomes reviewable. */
export function reviewAvailableAtDate(dateKey: string, timeZone: string): Date {
  return localMidnightUtc(nextDateKey(dateKey), timeZone);
}
