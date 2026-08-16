/**
 * Adapters from Fytrak's persisted shapes to the pure resolver's inputs.
 *
 * Kept separate from planResolution.ts so the resolution rules stay testable
 * without any knowledge of Firestore document layout, and so a schema change
 * lands here rather than in the logic.
 *
 * Every scheduling field is OPTIONAL. Prescriptions and programs written before
 * Phase D have none, and they must keep loading — they simply become
 * "Unscheduled" and are excluded from dated resolution rather than being given
 * an invented date.
 */
import type { PrescribedMeal, PrescribedWorkout } from "../../types/domain";
import type { Program, ProgramSession } from "../../services/programService";
import { isValidDateKey } from "../../utils/dateKeys";
import { selectActiveProgram } from "../programs/programSchedule";
import type { DatedCandidate, ScheduledProgram, ScheduledProgramSession } from "./planResolution";

/** Additive scheduling fields. Absent on every pre-Phase-D document. */
export type PlanScheduleFields = {
  scheduledDateKey?: string | null;
  status?: "draft" | "published" | null;
  planVersion?: number | null;
  publishedAt?: unknown;
  /** IANA zone the coach scheduled in, for provenance only. */
  scheduleTimezone?: string | null;
};

export type ScheduledPrescribedWorkout = PrescribedWorkout & PlanScheduleFields;
export type ScheduledPrescribedMeal = PrescribedMeal & PlanScheduleFields;
export type ScheduledProgramDoc = Program & {
  startDateKey?: string | null;
  status?: "draft" | "published" | null;
  planVersion?: number | null;
  publishedAt?: unknown;
  scheduleTimezone?: string | null;
};

/** Firestore Timestamp | Date | number → millis. Unknown shapes yield null. */
const toMillis = (value: unknown): number | null => {
  if (value && typeof value === "object" && "toMillis" in value) {
    const candidate = value as { toMillis?: () => number };
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const toCandidate = <T extends PlanScheduleFields & { id: string }>(item: T): DatedCandidate<T> => ({
  id: item.id,
  scheduledDateKey: isValidDateKey(item.scheduledDateKey) ? item.scheduledDateKey : null,
  status: item.status ?? null,
  planVersion: typeof item.planVersion === "number" ? item.planVersion : null,
  publishedAtMillis: toMillis(item.publishedAt),
  payload: item,
});

export const toWorkoutCandidates = (
  items: ScheduledPrescribedWorkout[]
): DatedCandidate<ScheduledPrescribedWorkout>[] => items.map(toCandidate);

export const toMealCandidates = (
  items: ScheduledPrescribedMeal[]
): DatedCandidate<ScheduledPrescribedMeal>[] => items.map(toCandidate);

/**
 * Flattens a program's week/session tree into offset-addressable sessions.
 *
 * `dayOffset` is read only from the session itself. It is never derived from
 * weekNumber, sessionNumber or array index — those describe presentation
 * order, not calendar placement, and a program that skips or reorders sessions
 * would silently land on the wrong dates.
 */
export const toScheduledProgram = (
  program: ScheduledProgramDoc
): ScheduledProgram<ProgramSession> => {
  const sessions: ScheduledProgramSession<ProgramSession>[] = [];
  (program.weeks ?? []).forEach((week) => {
    (week?.sessions ?? []).forEach((session) => {
      if (!session?.id) return;
      const dayOffset = (session as ProgramSession & { dayOffset?: number }).dayOffset;
      sessions.push({
        id: session.id,
        dayOffset: Number.isInteger(dayOffset) ? (dayOffset as number) : null,
        payload: session,
      });
    });
  });

  return {
    id: program.id,
    startDateKey: isValidDateKey(program.startDateKey) ? program.startDateKey : null,
    status: program.status ?? null,
    planVersion: typeof program.planVersion === "number" ? program.planVersion : null,
    publishedAtMillis: toMillis(program.publishedAt),
    sessions,
  };
};

/**
 * The ONE program that may place a session on `dateKey`.
 *
 * Returns an array of zero or one so it drops straight into the existing
 * `toScheduledPrograms(...)` call sites.
 *
 * Every resolution path used to receive EVERY program the client had ever been
 * assigned. Two overlapping published programs would both offer a session for
 * the same date, and `resolvePlanDimension` would pick between them by
 * publish-time tie-break — a rule nobody had decided and nothing documented.
 * `selectActiveProgram` makes it explicit: the most recently assigned program
 * covering that date wins, and older ones remain readable as history.
 */
export const toActiveScheduledPrograms = (
  programs: ScheduledProgramDoc[],
  dateKey: string
): ScheduledProgram<ProgramSession>[] => {
  const active = selectActiveProgram(
    (programs ?? []).map((program) => ({
      ...program,
      assignedAtMillis: toMillis(program.assignedAt) ?? 0,
    })),
    dateKey
  );
  return active ? toScheduledPrograms([active as ScheduledProgramDoc]) : [];
};

export const toScheduledPrograms = (
  programs: ScheduledProgramDoc[]
): ScheduledProgram<ProgramSession>[] => (programs ?? []).map(toScheduledProgram);

/** Items with no usable schedule — shown in their existing screens, labelled. */
export const selectUnscheduled = <T extends PlanScheduleFields>(items: T[]): T[] =>
  (items ?? []).filter((item) => !isValidDateKey(item.scheduledDateKey));
