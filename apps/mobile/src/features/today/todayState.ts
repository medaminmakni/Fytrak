import type { DataStatus } from "../../hooks/useTraineeDetailData";

/**
 * What today actually is, for the trainee.
 *
 * The screen used to answer this implicitly, by rendering nine cards and
 * letting the trainee work it out. The design asks one question — *what should
 * I do next?* — so the answer has to be a single value the header can be built
 * from, not a pile of independently-rendered sections.
 *
 * Pure and Firebase-free so every branch is testable. The screen decides how a
 * state looks; this decides which one is true.
 *
 * TWO STATES ARE DELIBERATELY ABSENT.
 *
 * - **In progress.** The logger autosaves a draft, but nothing persists "a
 *   session is open" anywhere the Today screen can read. Rendering it would
 *   mean guessing from the presence of a draft in another screen's state.
 * - **Missed.** On the trainee's own today, a planned session that has not been
 *   done yet is not missed — it is pending until their day closes. "Missed" is
 *   a judgement that belongs to the coach's view of a *closed* day, and the
 *   daily report already derives it there.
 *
 * Both are listed in the design's state table. Neither is derivable from what
 * today's data model stores, and inventing them is the failure mode this whole
 * project has been correcting.
 */
export type TodayState =
  /** One or more dimensions failed to load. Never drawn as "nothing planned". */
  | { kind: "unavailable" }
  | { kind: "loading" }
  /** The session is done. `sessions` is a count, because two are possible. */
  | { kind: "session_logged"; sessions: number }
  /** A session is planned and not yet logged. */
  | {
      kind: "session_planned";
      title: string;
      exerciseCount: number | null;
      /** Sessions already logged today while this planned session remains open. */
      loggedSessions: number;
      /** True when a coach scheduled it, which changes the copy to name them. */
      fromCoach: boolean;
    }
  /**
   * A scheduled program covers today but places no session on it.
   *
   * Distinct from `no_plan`, and the distinction is the point: a rest day is
   * the plan working, not the plan missing. A trainee shown "nothing planned"
   * on a programmed rest day reads it as the app having lost their plan.
   */
  | { kind: "rest_day" }
  /** No plan reaches today. A blank start, not a failure and not a rest day. */
  | { kind: "no_plan" };

export type TodayStateInput = {
  /** Worst status across the dimensions the header depends on. */
  planStatus: DataStatus;
  /** Sessions logged on the client's today. */
  loggedSessionCount: number;
  /** The resolved plan for today, if any. */
  plannedWorkout: {
    title: string;
    exerciseCount: number | null;
    isCompleted?: boolean;
    /** "daily" = a coach's dated prescription, "program" = a program session. */
    sourceType: "daily" | "program" | "none";
  } | null;
  /**
   * True when a published program's date range covers today.
   *
   * This is what separates a rest day from having no plan at all, and it is the
   * only way to tell them apart: `resolvePlanDimension` returns `"none"` for
   * both "no program exists" and "a program exists and today is a rest day".
   */
  hasProgramCoveringToday: boolean;
};

export const deriveTodayState = (input: TodayStateInput): TodayState => {
  if (input.planStatus === "error") return { kind: "unavailable" };
  if (input.planStatus === "loading") return { kind: "loading" };

  /*
   * AN OPEN PRESCRIPTION OUTRANKS A LOGGED SESSION.
   *
   * `isCompleted` is what closes a prescription, not the presence of any log:
   * a client who logs a cardio session has not thereby done the pushing session
   * their coach wrote, and dismissing the card on log-count alone would hide
   * the prescribed work for the rest of the day.
   *
   * `loggedSessions` rides along so the card can acknowledge what HAS been done
   * without pretending it was the plan.
   */
  const planned = input.plannedWorkout;
  if (planned && planned.sourceType !== "none" && planned.isCompleted !== true) {
    return {
      kind: "session_planned",
      title: planned.title,
      exerciseCount: planned.exerciseCount,
      loggedSessions: input.loggedSessionCount,
      fromCoach: planned.sourceType === "daily",
    };
  }

  /*
   * Done: either the prescription was marked complete, or something was logged
   * on a day with no open prescription. A second session in a day is
   * legitimate, so the count is carried rather than collapsed to a boolean.
   */
  if (input.loggedSessionCount > 0 || planned?.isCompleted === true) {
    return { kind: "session_logged", sessions: Math.max(1, input.loggedSessionCount) };
  }

  if (input.hasProgramCoveringToday) return { kind: "rest_day" };

  return { kind: "no_plan" };
};

/**
 * Whether this state should carry the screen's single accent surface.
 *
 * One accent per screen is a design law, and it belongs to the one next action.
 * A finished day, a rest day and a failed read have no next action, so on those
 * the accent goes unused rather than being spent on a card that merely reports.
 */
export const stateHasPrimaryAction = (state: TodayState): boolean =>
  state.kind === "session_planned" || state.kind === "no_plan";
