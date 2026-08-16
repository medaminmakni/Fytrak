import { addDaysToDateKey, isValidDateKey } from "../../utils/dateKeys";

/**
 * Fourteen days of a client's history, as facts.
 *
 * The design draws this as a row of cells and is explicit that **no score is
 * derived from it**. That constraint is the reason it is worth building: a
 * coach reading fourteen cells sees the shape of a fortnight — three in a row
 * missed, or every Saturday blank — which is information an adherence
 * percentage destroys by averaging it away.
 *
 * Every cell is a statement about one day. None of them is a grade, and the
 * strip deliberately exposes no total, no streak and no ratio.
 */
export type FortnightDayState =
  /** A session was logged. */
  | "logged"
  /** A plan named this day and nothing was logged against it. */
  | "planned_not_logged"
  /** A program covered the day and placed no session on it. */
  | "rest"
  /** No plan reached the day at all. Not a miss — nothing was ever asked. */
  | "no_plan"
  /** Later than the client's today. Nothing has happened yet. */
  | "future"
  /** The day cannot be described: no client calendar, or the read failed. */
  | "unknown";

export type FortnightDay = {
  dateKey: string;
  state: FortnightDayState;
};

export type FortnightInput = {
  /** The client's today. Empty when their timezone is unknown. */
  clientTodayDateKey: string;
  /** Number of days to show, ending on the client's today. */
  days?: number;
  /** Days with a logged session, by date key. */
  loggedDateKeys: ReadonlySet<string>;
  /** Days a plan named, by date key. */
  plannedDateKeys: ReadonlySet<string>;
  /** Days covered by a published program, by date key. */
  programDateKeys: ReadonlySet<string>;
  /**
   * Days whose report could not be read.
   *
   * Kept separate from "no activity" for the reason the whole project keeps
   * returning to: a failed read and an empty day are opposite facts, and a grey
   * cell that means both is worse than no cell.
   */
  unreadableDateKeys?: ReadonlySet<string>;
};

const DEFAULT_DAYS = 14;

/**
 * The strip, oldest first.
 *
 * Returns an empty array when the client's calendar is unknown rather than
 * falling back to the coach's — the same rule the date stepper and the review
 * status follow. Fourteen cells drawn against the wrong calendar would be
 * fourteen wrong facts.
 */
export const buildFortnight = (input: FortnightInput): FortnightDay[] => {
  const { clientTodayDateKey } = input;
  if (!isValidDateKey(clientTodayDateKey)) return [];

  const days = Number.isInteger(input.days) && (input.days as number) > 0
    ? (input.days as number)
    : DEFAULT_DAYS;

  const unreadable = input.unreadableDateKeys ?? new Set<string>();
  const out: FortnightDay[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dateKey = addDaysToDateKey(clientTodayDateKey, -offset);
    out.push({ dateKey, state: describeDay(dateKey, clientTodayDateKey, input, unreadable) });
  }

  return out;
};

const describeDay = (
  dateKey: string,
  todayKey: string,
  input: FortnightInput,
  unreadable: ReadonlySet<string>,
): FortnightDayState => {
  if (dateKey > todayKey) return "future";
  if (unreadable.has(dateKey)) return "unknown";

  /*
   * A logged session outranks everything. It is the only cell state backed by a
   * document the client actually wrote, so it can never be overridden by what
   * was or was not planned.
   */
  if (input.loggedDateKeys.has(dateKey)) return "logged";

  /*
   * Today is deliberately NOT "missed" when a plan exists and nothing is
   * logged. The client's day has not closed; they may train this evening.
   * Calling it a miss on the coach's screen is the same premature judgement the
   * review status refuses to make.
   */
  if (dateKey === todayKey) {
    if (input.plannedDateKeys.has(dateKey)) return "planned_not_logged";
    return input.programDateKeys.has(dateKey) ? "rest" : "no_plan";
  }

  if (input.plannedDateKeys.has(dateKey)) return "planned_not_logged";
  if (input.programDateKeys.has(dateKey)) return "rest";
  return "no_plan";
};

/**
 * Counts, for the legend only.
 *
 * Exposed as raw tallies and never as a ratio. "9 logged, 3 planned and not
 * logged" is a description; "75%" is a grade, and the design forbids deriving
 * one from this strip.
 */
export const countFortnightStates = (
  days: FortnightDay[],
): Record<FortnightDayState, number> => {
  const counts: Record<FortnightDayState, number> = {
    logged: 0, planned_not_logged: 0, rest: 0, no_plan: 0, future: 0, unknown: 0,
  };
  days.forEach((day) => { counts[day.state] += 1; });
  return counts;
};
