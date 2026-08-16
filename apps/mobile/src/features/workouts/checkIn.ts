/**
 * The post-session check-in: what the client answered, and what they didn't.
 *
 * Every field is nullable and starts null. The previous version seeded energy,
 * soreness and mood at 3 and sleep at 7.5h, then wrote them whether or not the
 * client touched anything — so a coach reading "7.5h sleep, energy 3" could not
 * tell whether that was reported or invented by the form. Those are the numbers
 * a coach changes a plan on.
 *
 * Absence is a real answer here. "Not answered" and "could not load" stay
 * distinct all the way to the coach's screen.
 */

/** Fixed set so a coach can compare across sessions and clients. */
export const SORE_AREAS = [
  "neck",
  "shoulders",
  "chest",
  "upper_back",
  "lower_back",
  "arms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
] as const;

export type SoreArea = (typeof SORE_AREAS)[number];

export const SORE_AREA_LABEL: Record<SoreArea, string> = {
  neck: "Neck",
  shoulders: "Shoulders",
  chest: "Chest",
  upper_back: "Upper back",
  lower_back: "Lower back",
  arms: "Arms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

/** Bounds. Sleep is hours; the ratings are the 1-5 the UI has always used. */
export const SLEEP_MIN_HOURS = 3;
export const SLEEP_MAX_HOURS = 12;
export const SLEEP_STEP_HOURS = 0.5;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
/** Enough to name a joint and a sensation. Below this it is not usable. */
export const PAIN_NOTE_MIN_LENGTH = 4;
export const PAIN_NOTE_MAX_LENGTH = 200;

/** What the form holds while the client is filling it in. */
export type CheckInDraft = {
  sleepHours: number | null;
  energy: number | null;
  mood: number | null;
  soreAreas: SoreArea[];
  /** null = not answered. false = explicitly "nothing hurt". */
  painFlagged: boolean | null;
  painNote: string;
};

export const emptyCheckInDraft = (): CheckInDraft => ({
  sleepHours: null,
  energy: null,
  mood: null,
  soreAreas: [],
  painFlagged: null,
  painNote: "",
});

/**
 * What actually gets stored. Every key is optional: a field the client did not
 * answer is ABSENT, never a placeholder. Reading code therefore distinguishes
 * "they said 3" from "they said nothing" without a sentinel value.
 */
export type StoredCheckIn = {
  sleepHours?: number;
  energy?: number;
  mood?: number;
  soreAreas?: SoreArea[];
  painFlagged?: boolean;
  painNote?: string;
  /** Legacy. Old documents carry a 1-5 scale; new ones carry `soreAreas`. */
  soreness?: number;
};

export const isAnswered = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** True when the client engaged with the form at all. */
export const hasAnyAnswer = (draft: CheckInDraft): boolean =>
  isAnswered(draft.sleepHours) ||
  isAnswered(draft.energy) ||
  isAnswered(draft.mood) ||
  draft.soreAreas.length > 0 ||
  draft.painFlagged !== null;

export type CheckInValidation =
  | { ok: true }
  | { ok: false; message: string };

/**
 * The only hard requirement in the whole form.
 *
 * A pain flag with no description is worse than no flag: it tells a coach
 * something is wrong and nothing about what, so they either guess or ignore it.
 * Everything else may be left blank.
 */
export const validateCheckInDraft = (draft: CheckInDraft): CheckInValidation => {
  if (draft.painFlagged === true) {
    const note = draft.painNote.trim();
    if (note.length < PAIN_NOTE_MIN_LENGTH) {
      return {
        ok: false,
        message: "Say where it hurt and what it felt like — your coach needs this to adjust your plan.",
      };
    }
  }
  return { ok: true };
};

const clampRating = (value: number): number =>
  Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)));

const clampSleep = (value: number): number =>
  Math.min(SLEEP_MAX_HOURS, Math.max(SLEEP_MIN_HOURS, value));

/**
 * Draft -> the object written to Firestore, or `undefined` when nothing was
 * answered.
 *
 * `undefined` matters: the workout write omits `checkIn` entirely rather than
 * storing an empty object, so a skipped check-in is indistinguishable from a
 * pre-existing document — and both correctly render as "Not answered".
 */
export const toStoredCheckIn = (draft: CheckInDraft): StoredCheckIn | undefined => {
  if (!hasAnyAnswer(draft)) return undefined;

  const stored: StoredCheckIn = {};

  if (isAnswered(draft.sleepHours)) stored.sleepHours = clampSleep(draft.sleepHours);
  if (isAnswered(draft.energy)) stored.energy = clampRating(draft.energy);
  if (isAnswered(draft.mood)) stored.mood = clampRating(draft.mood);
  if (draft.soreAreas.length > 0) {
    // De-duplicated and ordered by the canonical list so two clients reporting
    // the same areas produce the same array.
    stored.soreAreas = SORE_AREAS.filter((area) => draft.soreAreas.includes(area));
  }
  if (draft.painFlagged !== null) {
    stored.painFlagged = draft.painFlagged;
    if (draft.painFlagged) {
      const note = draft.painNote.trim().slice(0, PAIN_NOTE_MAX_LENGTH);
      if (note) stored.painNote = note;
    }
  }

  return stored;
};

/** Reading side: a normalised view that never invents a value. */
export type CheckInReadModel = {
  answered: boolean;
  sleepHours: number | null;
  energy: number | null;
  mood: number | null;
  soreAreas: SoreArea[];
  /** Legacy 1-5 soreness from documents written before body areas existed. */
  legacySoreness: number | null;
  painFlagged: boolean | null;
  painNote: string | null;
};

export const readCheckIn = (raw: StoredCheckIn | undefined | null): CheckInReadModel => {
  const source = raw ?? {};
  const soreAreas = Array.isArray(source.soreAreas)
    ? SORE_AREAS.filter((area) => source.soreAreas!.includes(area))
    : [];

  const model: CheckInReadModel = {
    answered: false,
    sleepHours: isAnswered(source.sleepHours) ? source.sleepHours : null,
    energy: isAnswered(source.energy) ? source.energy : null,
    mood: isAnswered(source.mood) ? source.mood : null,
    soreAreas,
    legacySoreness: isAnswered(source.soreness) ? source.soreness : null,
    painFlagged: typeof source.painFlagged === "boolean" ? source.painFlagged : null,
    painNote: typeof source.painNote === "string" && source.painNote ? source.painNote : null,
  };

  model.answered =
    model.sleepHours !== null ||
    model.energy !== null ||
    model.mood !== null ||
    model.soreAreas.length > 0 ||
    model.legacySoreness !== null ||
    model.painFlagged !== null;

  return model;
};

/** True when this session needs the coach's attention today. */
export const hasPainReport = (raw: StoredCheckIn | undefined | null): boolean =>
  readCheckIn(raw).painFlagged === true;
