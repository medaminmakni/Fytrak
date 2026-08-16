import { addDaysToDateKey, daysBetweenDateKeys, isValidDateKey } from "../../utils/dateKeys";

/**
 * Where a program's sessions land, and whether the program is coherent.
 *
 * `dayOffset` stays the persisted, deterministic placement — it is the only
 * field that survives a coach reordering a week — but a coach should not have
 * to reason in bare integers. Everything here converts between the offset the
 * database stores and the date a human reads, without ever consulting a device
 * clock: `startDateKey + dayOffset` is string arithmetic, so a coach in Paris
 * and a client in Tunis compute the same day.
 *
 * Pure and Firebase-free. Every rule the save path enforces is testable here.
 */

export type ProgramLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/**
 * The levels a coach can pick, with the labels they read.
 *
 * `EXPERT` used to sit in the `Program["level"]` union while the picker offered
 * only three options, so the type promised a value no coach could choose and no
 * screen could render. It is removed rather than exposed: three rungs is a
 * complete ladder, and a fourth that nothing wrote was a contradiction waiting
 * to be read back as data.
 *
 * LEVEL IS A LABEL, NOT A GENERATOR. It never changes sets, reps, load,
 * exercise selection, progression or schedule. Fytrak stores the coach's
 * decisions; it does not make them.
 */
export const PROGRAM_LEVELS: { value: ProgramLevel; label: string }[] = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

export const programLevelLabel = (level: string | null | undefined): string =>
  PROGRAM_LEVELS.find((entry) => entry.value === level)?.label ?? "Level not set";

export const MAX_PROGRAM_WEEKS = 16;
export const MAX_SESSIONS_PER_WEEK = 7;

/** The client-local date a session falls on, or null when unplaceable. */
export const sessionDateKey = (
  startDateKey: string | null | undefined,
  dayOffset: number | null | undefined,
): string | null => {
  if (!isValidDateKey(startDateKey)) return null;
  if (typeof dayOffset !== "number" || !Number.isInteger(dayOffset) || dayOffset < 0) return null;
  return addDaysToDateKey(startDateKey as string, dayOffset);
};

/**
 * "Sunday, 16 August" for a session, or null.
 *
 * Built from the date key with an explicit UTC parse so the weekday cannot
 * shift with the reader's timezone — the whole point of storing an offset.
 */
export const sessionDateLabel = (
  startDateKey: string | null | undefined,
  dayOffset: number | null | undefined,
): string | null => {
  const dateKey = sessionDateKey(startDateKey, dayOffset);
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
  const month = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][date.getUTCMonth()];
  return `${weekday}, ${date.getUTCDate()} ${month}`;
};

/** Total days a program of `durationWeeks` covers. Offsets must fall inside. */
export const programDayCount = (durationWeeks: number): number =>
  Number.isInteger(durationWeeks) && durationWeeks > 0 ? durationWeeks * 7 : 0;

export const isOffsetInProgram = (dayOffset: number, durationWeeks: number): boolean =>
  Number.isInteger(dayOffset) && dayOffset >= 0 && dayOffset < programDayCount(durationWeeks);

// ---------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------

export type ScaffoldSession = {
  id: string;
  sessionNumber: number;
  title: string;
  estimatedMinutes: number;
  dayOffset: number;
  exercises: unknown[];
  isCompleted: boolean;
};

export type ScaffoldWeek = {
  id: string;
  weekNumber: number;
  title: string;
  sessions: ScaffoldSession[];
};

/**
 * Ids are unique across the whole program, not just within a week.
 *
 * The previous scaffold used `w1-s1` style ids rebuilt from position, so
 * duplicating a week produced two sessions sharing an id — and completion,
 * which matches on session id, would then have credited both.
 */
const makeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * An evenly-spread scaffold. Placement only — never content.
 *
 * The default distribution is a starting point a coach edits, not a
 * recommendation. Nothing here reads `level`.
 */
export const generateScaffold = (weeks: number, sessionsPerWeek: number): ScaffoldWeek[] => {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_PROGRAM_WEEKS) return [];
  if (!Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > MAX_SESSIONS_PER_WEEK) return [];

  const out: ScaffoldWeek[] = [];
  for (let w = 1; w <= weeks; w += 1) {
    const sessions: ScaffoldSession[] = [];
    for (let s = 1; s <= sessionsPerWeek; s += 1) {
      sessions.push({
        id: makeId("session"),
        sessionNumber: s,
        title: `Session ${s}`,
        estimatedMinutes: 60,
        dayOffset: (w - 1) * 7 + Math.floor(((s - 1) * 7) / sessionsPerWeek),
        exercises: [],
        isCompleted: false,
      });
    }
    out.push({ id: makeId("week"), weekNumber: w, title: `Week ${w}`, sessions });
  }
  return out;
};

/** True when any session in the scaffold has been given content or renamed. */
export const scaffoldHasEdits = (
  weeks: { sessions: { title: string; sessionNumber: number; exercises: unknown[] }[] }[],
): boolean =>
  weeks.some((week) =>
    week.sessions.some(
      (session) =>
        (session.exercises?.length ?? 0) > 0 ||
        session.title.trim() !== `Session ${session.sessionNumber}`,
    ),
  );

/**
 * Copies a week forward, with fresh ids and shifted offsets.
 *
 * Ids must be new: reusing them would give two sessions the same identity, and
 * a completion log matching on session id could not tell them apart.
 */
export const duplicateWeek = <
  W extends { weekNumber: number; title: string; sessions: S[] },
  S extends { dayOffset?: number | null },
>(
  source: W,
  targetWeekNumber: number,
): { id: string; weekNumber: number; title: string; sessions: (S & { id: string })[] } => {
  const shift = (targetWeekNumber - source.weekNumber) * 7;
  return {
    id: makeId("week"),
    weekNumber: targetWeekNumber,
    title: `Week ${targetWeekNumber}`,
    sessions: source.sessions.map((session) => ({
      ...session,
      id: makeId("session"),
      dayOffset: typeof session.dayOffset === "number" ? session.dayOffset + shift : session.dayOffset,
    })),
  };
};

/** The lowest offset inside the program that no session already occupies. */
export const firstFreeOffset = (
  usedOffsets: (number | null | undefined)[],
  durationWeeks: number,
): number | null => {
  const used = new Set(usedOffsets.filter((value): value is number => typeof value === "number"));
  const total = programDayCount(durationWeeks);
  for (let offset = 0; offset < total; offset += 1) {
    if (!used.has(offset)) return offset;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ProgramValidationIssue = {
  /** Human location, e.g. "Week 2 · Session 1 · Bench press". */
  where: string;
  message: string;
};

export type ValidatableSet = {
  type: string;
  targetReps?: number | null;
  targetWeight?: number | null;
  targetDurationSec?: number | null;
};

export type ValidatableExercise = {
  name: string;
  suggestedSets: ValidatableSet[];
};

export type ValidatableSession = {
  title: string;
  sessionNumber: number;
  dayOffset?: number | null;
  estimatedMinutes?: number;
  exercises: ValidatableExercise[];
};

export type ValidatableWeek = {
  weekNumber: number;
  sessions: ValidatableSession[];
};

export type ValidatableProgram = {
  title: string;
  startDateKey?: string | null;
  durationWeeks: number;
  weeks: ValidatableWeek[];
};

const isPositive = (value: unknown): boolean =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** A set is valid when the fields ITS OWN type requires are present and sane. */
export const validateSuggestedSet = (set: ValidatableSet): string | null => {
  switch (set.type) {
    case "TIME":
      return isPositive(set.targetDurationSec) ? null : "needs a target duration";
    case "BODYWEIGHT":
    case "REPS_ONLY":
      return isPositive(set.targetReps) ? null : "needs target reps";
    case "WEIGHT_REPS":
      if (!isPositive(set.targetReps)) return "needs target reps";
      if (!isPositive(set.targetWeight)) return "needs a target weight";
      return null;
    default:
      return "has an unknown set type";
  }
};

/**
 * Every reason this program cannot be assigned, each naming its exact location.
 *
 * Returns them all rather than the first: a coach fixing a twelve-week program
 * one error at a time, with a save round-trip between each, will stop using the
 * feature.
 */
export const validateProgram = (program: ValidatableProgram): ProgramValidationIssue[] => {
  const issues: ProgramValidationIssue[] = [];

  if (!program.title?.trim()) {
    issues.push({ where: "Program", message: "Give the program a name." });
  }
  if (!isValidDateKey(program.startDateKey)) {
    issues.push({ where: "Program", message: "Choose a valid start date." });
  }
  if (!Number.isInteger(program.durationWeeks) || program.durationWeeks < 1 || program.durationWeeks > MAX_PROGRAM_WEEKS) {
    issues.push({ where: "Program", message: `Duration must be 1–${MAX_PROGRAM_WEEKS} weeks.` });
  }
  if (!Array.isArray(program.weeks) || program.weeks.length === 0) {
    issues.push({ where: "Program", message: "Add at least one week." });
    return issues;
  }

  const totalSessions = program.weeks.reduce((sum, week) => sum + (week.sessions?.length ?? 0), 0);
  if (totalSessions === 0) {
    issues.push({ where: "Program", message: "Add at least one session." });
  }

  /*
   * Offsets are checked across the WHOLE program, not per week. Two sessions on
   * the same day is a collision wherever they live, and a week that borrows a
   * neighbour's day is exactly how a duplicate gets created unnoticed.
   */
  const offsetOwner = new Map<number, string>();

  program.weeks.forEach((week) => {
    if ((week.sessions?.length ?? 0) > MAX_SESSIONS_PER_WEEK) {
      issues.push({
        where: `Week ${week.weekNumber}`,
        message: `A week can hold at most ${MAX_SESSIONS_PER_WEEK} sessions.`,
      });
    }

    (week.sessions ?? []).forEach((session) => {
      const at = `Week ${week.weekNumber} · ${session.title?.trim() || `Session ${session.sessionNumber}`}`;

      const offset = session.dayOffset;
      if (typeof offset !== "number" || !Number.isInteger(offset)) {
        issues.push({ where: at, message: "Needs a day." });
      } else if (!isOffsetInProgram(offset, program.durationWeeks)) {
        issues.push({
          where: at,
          message: `Day ${offset} falls outside a ${program.durationWeeks}-week program.`,
        });
      } else {
        const owner = offsetOwner.get(offset);
        if (owner) {
          issues.push({ where: at, message: `Same day as ${owner}. One session per day.` });
        } else {
          offsetOwner.set(offset, at);
        }
      }

      if (session.estimatedMinutes !== undefined && !isPositive(session.estimatedMinutes)) {
        issues.push({ where: at, message: "Estimated duration must be a positive number." });
      }

      if (!Array.isArray(session.exercises) || session.exercises.length === 0) {
        issues.push({ where: at, message: "Add at least one exercise." });
        return;
      }

      session.exercises.forEach((exercise) => {
        const exerciseAt = `${at} · ${exercise.name?.trim() || "Unnamed exercise"}`;
        if (!exercise.name?.trim()) {
          issues.push({ where: exerciseAt, message: "Needs a name." });
        }
        if (!Array.isArray(exercise.suggestedSets) || exercise.suggestedSets.length === 0) {
          issues.push({ where: exerciseAt, message: "Add at least one set." });
          return;
        }
        exercise.suggestedSets.forEach((set, index) => {
          const problem = validateSuggestedSet(set);
          if (problem) issues.push({ where: `${exerciseAt} · Set ${index + 1}`, message: `Set ${problem}.` });
        });
      });
    });
  });

  return issues;
};

/**
 * Which of several published programs is the active one for a date.
 *
 * V0 policy, and it is deliberately the smallest safe rule: the program most
 * recently assigned that actually covers the date wins. Older programs are
 * retained and readable as history — nothing is deleted — but only one can
 * place a session on a given day, so a client can never be shown two plans for
 * one date without a rule deciding between them.
 *
 * Ties break on document id so the answer is total and identical on every
 * device.
 */
export const selectActiveProgram = <
  P extends { id: string; startDateKey?: string | null; durationWeeks: number; status?: string | null; assignedAtMillis?: number | null },
>(
  programs: P[],
  dateKey: string,
): P | null => {
  const covering = (programs ?? []).filter((program) => {
    if (program.status === "draft") return false;
    if (!isValidDateKey(program.startDateKey) || !isValidDateKey(dateKey)) return false;
    if (dateKey < (program.startDateKey as string)) return false;
    const days = daysBetweenDateKeys(program.startDateKey as string, dateKey);
    return days < programDayCount(program.durationWeeks);
  });

  if (covering.length === 0) return null;

  return covering.sort((a, b) => {
    const delta = (b.assignedAtMillis ?? 0) - (a.assignedAtMillis ?? 0);
    if (delta !== 0) return delta;
    return b.id.localeCompare(a.id);
  })[0];
};
