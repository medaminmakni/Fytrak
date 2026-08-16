const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;

  module._compile(output, filename);
};

const src = path.join(__dirname, "..", "src");

const { buildTodayMission } = require(path.join(src, "features", "retention", "todayMission.ts"));
const {
  describeClientActivity,
  describeSignalActivity,
} = require(path.join(src, "features", "coaching", "coachIntelligence.ts"));
const {
  buildPainActionId,
  hasUniqueActionIds,
  totalWaitingCount,
} = require(path.join(src, "features", "coach", "dashboard", "coachActions.ts"));
const {
  isPainPending,
  selectPendingPainReports,
  shouldAcknowledgePainOnReview,
  toMillis: painToMillis,
} = require(path.join(src, "features", "coaching", "painQueue.ts"));
const {
  deriveReviewStatus,
} = require(path.join(src, "features", "coaching", "reviewStatus.ts"));
const { combineDimensionStatus } = require(path.join(src, "features", "coaching", "dimensionStatus.ts"));
const { nextMondayDateKey } = require(path.join(src, "utils", "dateKeys.ts"));
const {
  deriveTodayState,
  stateHasPrimaryAction,
} = require(path.join(src, "features", "today", "todayState.ts"));
const {
  validateAdjustment,
  validateEffectiveDate,
} = require(path.join(src, "features", "plans", "adjustmentRules.ts"));
const { isDatedCandidateFor } = require(path.join(src, "features", "plans", "planResolution.ts"));
const {
  buildFortnight,
  countFortnightStates,
} = require(path.join(src, "features", "coaching", "fortnight.ts"));
const {
  buildSessionReview,
  resolveWorkoutReviewPlan,
} = require(path.join(src, "features", "coaching", "sessionReview.ts"));
const {
  cmToFeetInches, formatHeight, formatWeight, kgToPounds,
  clampHeightCm, clampWeightKg, figureScaleForHeight, figureWidthForWeight,
  HEIGHT_RANGE_CM, WEIGHT_RANGE_KG,
} = require(path.join(src, "features", "onboarding", "units.ts"));
const {
  PROGRAM_LEVELS, programLevelLabel, sessionDateKey, sessionDateLabel,
  isOffsetInProgram, generateScaffold, scaffoldHasEdits, duplicateWeek,
  firstFreeOffset, validateSuggestedSet, validateProgram, selectActiveProgram,
} = require(path.join(src, "features", "programs", "programSchedule.ts"));
const {
  ACTIVE_WORKOUT_DRAFT_VERSION,
  migrateWorkoutDraft,
} = require(path.join(src, "features", "workouts", "activeWorkoutDraft.ts"));
const {
  prefillWorkoutFromSession, sessionIsReady,
  findSessionCompletions, isSessionCompleted, canonicalCompletion,
} = require(path.join(src, "features", "programs", "programWorkout.ts"));
const {
  isRetryBusy,
  isRetrySettled,
  selectRetryTargets,
} = require(path.join(src, "features", "coaching", "retryState.ts"));
const {
  canStepBack,
  canStepForward,
  stepClientDay,
} = require(path.join(src, "features", "coaching", "dayNavigation.ts"));
const {
  emptyCheckInDraft,
  hasAnyAnswer,
  hasPainReport,
  readCheckIn,
  toStoredCheckIn,
  validateCheckInDraft,
} = require(path.join(src, "features", "workouts", "checkIn.ts"));
const {
  detectWorkoutPersonalRecords,
  duplicateSetForNextEntry,
  getCompletedWorkoutExercises,
  parseRpeInput,
  getBestEstimatedOneRepMaxForExercise,
  getLatestExercisePerformance,
} = require(path.join(src, "features", "workouts", "workoutPerformance.ts"));
const { getExerciseVideoLink } = require(path.join(src, "utils", "videoLinks.ts"));
const { calculateAge, calculateNutritionPlan } = require(path.join(src, "utils", "calculators.ts"));
const {
  calculateMacroAdherence,
  calculateNutritionProgress,
} = require(path.join(src, "features", "nutrition", "nutritionTargets.ts"));
const {
  clearSubscriptionCache,
  subscribeWithCache,
} = require(path.join(src, "data", "subscriptions", "subscriptionCache.ts"));

const mission = buildTodayMission({
  hasWorkoutToday: false,
  caloriesLogged: 1200,
  calorieTarget: 2000,
  hasCoachAssigned: true,
  hasPendingWorkoutPlan: true,
  hasPendingMealPlan: false,
  hasBodyMetricToday: false,
});

assert.equal(mission.completionPercent, 25);
assert.equal(mission.items[0].id, "workout");

/*
 * The `scoreCoachClient` / `buildCoachDashboardIntelligence` assertions were
 * removed with the functions themselves in Phase 5. They tested a compliance
 * score and a HIGH/MEDIUM/LOW risk band that no screen reads any more.
 */
const prs = detectWorkoutPersonalRecords(
  [{ name: "Bench Press", sets: [{ type: "weighted", reps: 5, weight: 100, isCompleted: true }] }],
  [{ exercises: [{ name: "Bench Press", sets: [{ type: "weighted", reps: 5, weight: 90, isCompleted: true }] }] }]
);

assert.equal(prs.length, 1);
assert.equal(prs[0].exerciseName, "Bench Press");

assert.deepEqual(duplicateSetForNextEntry({ type: "weighted", reps: 8, weight: 50, isCompleted: true }, "weighted"), {
  type: "weighted",
  reps: 8,
  weight: 50,
  durationSec: undefined,
  rpe: undefined,
  isCompleted: false,
});

const previousPerformance = getLatestExercisePerformance("Bench Press", [
  {
    name: "Push Day",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { type: "WEIGHT_REPS", reps: 8, weight: 80, isCompleted: true },
          { type: "WEIGHT_REPS", reps: 6, weight: 85, isCompleted: true },
        ],
      },
    ],
  },
]);

assert.equal(previousPerformance.workoutName, "Push Day");
assert.equal(previousPerformance.sets.length, 2);
assert.ok(getBestEstimatedOneRepMaxForExercise("Bench Press", [
  {
    exercises: [
      {
        name: "Bench Press",
        sets: [{ type: "WEIGHT_REPS", reps: 5, weight: 100, isCompleted: true }],
      },
    ],
  },
]) > 110);

const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const videoLink = getExerciseVideoLink(youtubeUrl);
assert.equal(videoLink?.isYouTube, true);
assert.equal(videoLink?.watchUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
assert.ok(videoLink?.thumbnailUrl?.includes("img.youtube.com"));

// --- calculateAge ---
const today = new Date();
const twentyFiveYearsAgo = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
const twentyFiveYearsAgoStr = twentyFiveYearsAgo.toISOString().slice(0, 10);
assert.equal(calculateAge(twentyFiveYearsAgoStr), 25);

// --- calculateNutritionPlan: normal case ---
const normalPlan = calculateNutritionPlan({
  gender: "male",
  height: 180,
  weight: 80,
  birthday: twentyFiveYearsAgoStr,
  goal: "get_fit",
  level: "intermediate",
});
assert.equal(normalPlan.protein, Math.round(80 * 2.2));
assert.ok(normalPlan.calories > 0);
assert.ok(normalPlan.carbs > 0);
assert.ok(normalPlan.fats > 0);

// --- calculateNutritionPlan: boundary case (regression for negative-macro bug) ---
// Oldest reachable age, lowest reachable height/weight, and an aggressive
// deficit goal — this combination used to drive targetCalories and carbGrams
// negative before the MIN_TARGET_CALORIES floor was added.
const hundredYearsAgo = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
const hundredYearsAgoStr = hundredYearsAgo.toISOString().slice(0, 10);
const boundaryPlan = calculateNutritionPlan({
  gender: "female",
  height: 100,
  weight: 30,
  birthday: hundredYearsAgoStr,
  goal: "lose_weight",
  level: "beginner",
});
assert.ok(boundaryPlan.calories >= 1200, "targetCalories must never fall below the safety floor");
assert.ok(boundaryPlan.protein >= 0, "protein grams must never be negative");
assert.ok(boundaryPlan.carbs >= 0, "carb grams must never be negative");
assert.ok(boundaryPlan.fats >= 0, "fat grams must never be negative");

// --- Phase A: client-timezone date keys ---
const {
  addDaysToDateKey,
  toZonedDateKey,
  resolveClientDateContext,
  clientDateFields,
  getClientTodayDateKey,
  getForeignClientTodayDateKey,
  isValidTimeZone,
  toLocalDateKey,
} = require(path.join(src, "utils", "dateKeys.ts"));

// A moment that is a DIFFERENT calendar day depending on the observer's zone.
// 2026-08-03T23:30:00Z is still Aug 3 in UTC and New York, but already Aug 4
// in Tunis, Tokyo, and London — London is on BST (UTC+1) in August, which is
// exactly the kind of detail a fixed offset would get wrong.
const crossMidnight = new Date("2026-08-03T23:30:00Z");
assert.equal(toZonedDateKey("UTC", crossMidnight), "2026-08-03");
assert.equal(toZonedDateKey("America/New_York", crossMidnight), "2026-08-03");
assert.equal(toZonedDateKey("Africa/Tunis", crossMidnight), "2026-08-04");
assert.equal(toZonedDateKey("Asia/Tokyo", crossMidnight), "2026-08-04");
assert.equal(toZonedDateKey("Europe/London", crossMidnight), "2026-08-04");

// UTC midnight boundary: the instant itself.
const utcMidnight = new Date("2026-08-04T00:00:00Z");
assert.equal(toZonedDateKey("UTC", utcMidnight), "2026-08-04");
assert.equal(toZonedDateKey("America/New_York", utcMidnight), "2026-08-03");

// Daylight-saving boundary. US DST ended 2026-11-01 at 06:00 UTC; 05:30 UTC is
// still 01:30 EDT on Nov 1, so the date key must not slip to Oct 31.
const dstBoundary = new Date("2026-11-01T05:30:00Z");
assert.equal(toZonedDateKey("America/New_York", dstBoundary), "2026-11-01");

// A southern-hemisphere zone with the opposite DST phase must still agree on
// the calendar day for a mid-afternoon UTC instant.
const midday = new Date("2026-08-03T12:00:00Z");
assert.equal(toZonedDateKey("Australia/Sydney", midday), "2026-08-03");
assert.equal(toZonedDateKey("Pacific/Auckland", midday), "2026-08-04");

// Zone validation.
assert.equal(isValidTimeZone("Africa/Tunis"), true);
assert.equal(isValidTimeZone("Not/AZone"), false);
assert.equal(isValidTimeZone(null), false);
assert.equal(isValidTimeZone(undefined), false);
assert.equal(isValidTimeZone(""), false);

// Provenance: a stored zone is trusted and labelled; a missing or invalid zone
// falls back to the device and is labelled inferred, never silently trusted.
const captured = resolveClientDateContext("Africa/Tunis", crossMidnight);
assert.equal(captured.provenance, "client_timezone");
assert.equal(captured.timezone, "Africa/Tunis");
assert.equal(captured.dateKey, "2026-08-04");

const inferred = resolveClientDateContext(null, crossMidnight);
assert.equal(inferred.provenance, "device_inferred");

const invalidZone = resolveClientDateContext("Not/AZone", crossMidnight);
assert.equal(invalidZone.provenance, "device_inferred", "an unresolvable zone must not be trusted");

// No country default is ever fabricated: an absent zone must not silently
// become Africa/Tunis.
assert.notEqual(
  resolveClientDateContext(null, crossMidnight).provenance,
  "client_timezone",
  "missing timezone must never be reported as captured"
);

// Dual-write: `date` and `clientDateKey` must always be identical, because
// Firestore cannot express `clientDateKey ?? date` in a query and `date`
// remains the field every existing index is built on.
const fields = clientDateFields(captured);
assert.equal(fields.date, fields.clientDateKey);
assert.equal(fields.date, "2026-08-04");
assert.equal(fields.timezone, "Africa/Tunis");
assert.equal(fields.dateKeyProvenance, "client_timezone");

// A travelling client's read key must stay aligned with the stored timezone
// used for writes, not the timezone of the device currently running the app.
const tunisWriteContext = resolveClientDateContext("Africa/Tunis", crossMidnight);
const tunisReadKey = getClientTodayDateKey("Africa/Tunis", crossMidnight);
const newYorkDeviceKey = toZonedDateKey("America/New_York", crossMidnight);
assert.equal(tunisReadKey, tunisWriteContext.dateKey);
assert.notEqual(tunisReadKey, newYorkDeviceKey);

// An empty zone is stored as null rather than an empty string.
assert.equal(
  clientDateFields({ dateKey: "2026-08-04", timezone: "", provenance: "device_inferred" }).timezone,
  null
);

// Legacy key generator must remain intact — historical documents are compared
// against it and are never rewritten.
assert.match(toLocalDateKey(crossMidnight), /^\d{4}-\d{2}-\d{2}$/);

// Deleting a historical meal must still rebuild the summary for the client's
// current seven-day window, not for the seven days ending on the deleted meal.
const deletionNow = new Date("2026-08-04T00:30:00Z");
const deletionToday = getClientTodayDateKey("Africa/Tunis", deletionNow);
assert.equal(deletionToday, "2026-08-04");
assert.equal(addDaysToDateKey(deletionToday, -6), "2026-07-29");
assert.notEqual(addDaysToDateKey("2026-01-10", -6), "2026-07-29");
assert.equal(addDaysToDateKey("2024-03-01", -1), "2024-02-29");

// --- Phase D: dated plan resolution ---------------------------------------
const {
  resolvePlanDimension,
  findProgramSessionForDate,
  isUnscheduledCandidate,
  isScheduledProgram,
} = require(path.join(src, "features", "plans", "planResolution.ts"));
const { daysBetweenDateKeys, isValidDateKey } = require(path.join(src, "utils", "dateKeys.ts"));

const D = "2026-08-05";
const dailyWorkout = { id: "dw1", scheduledDateKey: D, payload: { kind: "daily-workout" } };
const dailyMeal = { id: "dm1", scheduledDateKey: D, payload: { kind: "daily-nutrition" } };
const program = {
  id: "prog1",
  startDateKey: "2026-08-03",
  sessions: [
    { id: "s0", dayOffset: 0, payload: { kind: "program-day0" } },
    { id: "s2", dayOffset: 2, payload: { kind: "program-day2" } }, // == 2026-08-05
    { id: "s5", dayOffset: 5, payload: { kind: "program-day5" } },
  ],
};
const asProgramPayload = (session) => session.payload;

// 1. daily workout overrides program workout
const w1 = resolvePlanDimension({
  dateKey: D,
  dailyCandidates: [dailyWorkout],
  programs: [program],
  toProgramPayload: asProgramPayload,
});
assert.equal(w1.sourceType, "daily");
assert.equal(w1.sourceId, "dw1");
assert.deepEqual(w1.payload, { kind: "daily-workout" });

// 2. daily nutrition overrides program nutrition
const n1 = resolvePlanDimension({
  dateKey: D,
  dailyCandidates: [dailyMeal],
  programs: [program],
  toProgramPayload: asProgramPayload,
});
assert.equal(n1.sourceType, "daily");
assert.equal(n1.sourceId, "dm1");

// 3. the two dimensions resolve INDEPENDENTLY: a daily workout must not drag
//    nutrition away from the program, and vice versa.
const wFromDaily = resolvePlanDimension({
  dateKey: D, dailyCandidates: [dailyWorkout], programs: [program], toProgramPayload: asProgramPayload,
});
const nFromProgram = resolvePlanDimension({
  dateKey: D, dailyCandidates: [], programs: [program], toProgramPayload: asProgramPayload,
});
assert.equal(wFromDaily.sourceType, "daily");
assert.equal(nFromProgram.sourceType, "program");
assert.equal(nFromProgram.sessionId, "s2");
// ...and the mirror case.
const wFromProgram = resolvePlanDimension({
  dateKey: D, dailyCandidates: [], programs: [program], toProgramPayload: asProgramPayload,
});
const nFromDaily = resolvePlanDimension({
  dateKey: D, dailyCandidates: [dailyMeal], programs: [program], toProgramPayload: asProgramPayload,
});
assert.equal(wFromProgram.sourceType, "program");
assert.equal(nFromDaily.sourceType, "daily");

// 4. program session resolves via startDateKey + dayOffset only
assert.equal(findProgramSessionForDate(program, "2026-08-03").id, "s0");
assert.equal(findProgramSessionForDate(program, "2026-08-05").id, "s2");
assert.equal(findProgramSessionForDate(program, "2026-08-08").id, "s5");
// Placement must NOT come from array order: s2 is second in the array but is
// day 2, and s5 is third but is day 5.
assert.equal(findProgramSessionForDate(program, "2026-08-04"), null);
// A date before the program starts is not covered.
assert.equal(findProgramSessionForDate(program, "2026-08-02"), null);

// 5. a rest day (no matching offset) resolves to none, not an error
const rest = resolvePlanDimension({
  dateKey: "2026-08-04", dailyCandidates: [], programs: [program], toProgramPayload: asProgramPayload,
});
assert.equal(rest.sourceType, "none");
assert.equal(rest.dateKey, "2026-08-04");

// 6. legacy unscheduled content is excluded from dated resolution
const legacyDaily = { id: "legacy1", payload: { kind: "legacy" } };
const legacyProgram = { id: "legacyProg", sessions: [{ id: "ls", dayOffset: 0, payload: {} }] };
assert.equal(isUnscheduledCandidate(legacyDaily), true);
assert.equal(isScheduledProgram(legacyProgram), false);
const legacyResolved = resolvePlanDimension({
  dateKey: D, dailyCandidates: [legacyDaily], programs: [legacyProgram], toProgramPayload: asProgramPayload,
});
assert.equal(legacyResolved.sourceType, "none", "unscheduled content must never be claimed as a dated plan");
// A program with a start date but sessions lacking dayOffset is also excluded.
const halfScheduled = { id: "half", startDateKey: "2026-08-03", sessions: [{ id: "x", payload: {} }] };
assert.equal(findProgramSessionForDate(halfScheduled, "2026-08-03"), null);

// 7. date arithmetic across month, year and leap-day boundaries
assert.equal(daysBetweenDateKeys("2026-08-31", "2026-09-01"), 1);
assert.equal(daysBetweenDateKeys("2026-12-31", "2027-01-01"), 1);
assert.equal(daysBetweenDateKeys("2028-02-28", "2028-02-29"), 1, "2028 is a leap year");
assert.equal(daysBetweenDateKeys("2027-02-28", "2027-03-01"), 1, "2027 is not");
assert.equal(daysBetweenDateKeys("2026-08-05", "2026-08-05"), 0);
assert.equal(daysBetweenDateKeys("2026-08-05", "2026-08-01"), -4);
const leapProgram = {
  id: "leap", startDateKey: "2028-02-27",
  sessions: [{ id: "leapDay", dayOffset: 2, payload: { kind: "leap" } }],
};
assert.equal(findProgramSessionForDate(leapProgram, "2028-02-29").id, "leapDay");

// 8. resolution is a pure function of the date STRING, so a coach device in
//    another timezone cannot shift a Tunis client's day.
const tunisResolved = resolvePlanDimension({
  dateKey: D, dailyCandidates: [], programs: [program], toProgramPayload: asProgramPayload,
});
const originalTZ = process.env.TZ;
process.env.TZ = "Pacific/Auckland";
const otherDeviceResolved = resolvePlanDimension({
  dateKey: D, dailyCandidates: [], programs: [program], toProgramPayload: asProgramPayload,
});
process.env.TZ = originalTZ;
assert.deepEqual(otherDeviceResolved, tunisResolved, "the coach's device must not change the client's day");

// 9. missing optional fields must not crash
assert.doesNotThrow(() => resolvePlanDimension({ dateKey: D }));
assert.equal(resolvePlanDimension({ dateKey: D }).sourceType, "none");
assert.equal(resolvePlanDimension({ dateKey: "not-a-date" }).sourceType, "none");
assert.equal(resolvePlanDimension({ dateKey: "2026-02-30" }).sourceType, "none", "impossible dates are rejected");
assert.doesNotThrow(() => findProgramSessionForDate({ id: "p", startDateKey: D, sessions: [] }, D));
assert.equal(isValidDateKey("2026-13-01"), false);
assert.equal(isValidDateKey(undefined), false);

// 10. duplicates resolve deterministically, never by array order
const dupA = { id: "aaa", scheduledDateKey: D, planVersion: 1, payload: { pick: "a" } };
const dupB = { id: "bbb", scheduledDateKey: D, planVersion: 2, payload: { pick: "b" } };
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [dupA, dupB] }).payload.pick, "b");
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [dupB, dupA] }).payload.pick, "b",
  "input order must not change the winner");
// Same version: later publishedAt wins.
const pubOld = { id: "aaa", scheduledDateKey: D, publishedAtMillis: 100, payload: { pick: "old" } };
const pubNew = { id: "bbb", scheduledDateKey: D, publishedAtMillis: 200, payload: { pick: "new" } };
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [pubNew, pubOld] }).payload.pick, "new");
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [pubOld, pubNew] }).payload.pick, "new");
// Fully tied: document id breaks it, so there is always exactly one winner.
const tieA = { id: "aaa", scheduledDateKey: D, payload: { pick: "a" } };
const tieB = { id: "zzz", scheduledDateKey: D, payload: { pick: "z" } };
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [tieA, tieB] }).payload.pick, "z");
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [tieB, tieA] }).payload.pick, "z");

// Drafts are withheld; an absent status means published (legacy compatibility).
const draft = { id: "d", scheduledDateKey: D, status: "draft", payload: { pick: "draft" } };
assert.equal(resolvePlanDimension({ dateKey: D, dailyCandidates: [draft] }).sourceType, "none");
assert.equal(
  resolvePlanDimension({ dateKey: D, dailyCandidates: [{ id: "p", scheduledDateKey: D, payload: {} }] }).sourceType,
  "daily"
);

// Completion/application state must not erase a past plan from coach review.
// Historical subscriptions include these documents; resolution remains based
// on their explicit date rather than their current action state.
const completedPlan = {
  id: "completed",
  scheduledDateKey: D,
  payload: { isCompleted: true, title: "Completed plan" },
};
assert.equal(
  resolvePlanDimension({ dateKey: D, dailyCandidates: [completedPlan] }).sourceType,
  "daily"
);

// ---------------------------------------------------------------------------
// POST-SESSION CHECK-IN
//
// The whole point of this module is that an unanswered question must never be
// stored as a number. A coach changes a plan on these values.
// ---------------------------------------------------------------------------

// A skipped check-in writes NOTHING. Not an empty object, not defaults.
assert.equal(toStoredCheckIn(emptyCheckInDraft()), undefined);
assert.equal(hasAnyAnswer(emptyCheckInDraft()), false);

// Answering one question stores exactly that question.
const oneAnswer = { ...emptyCheckInDraft(), energy: 4 };
assert.deepEqual(toStoredCheckIn(oneAnswer), { energy: 4 });
assert.equal("sleepHours" in toStoredCheckIn(oneAnswer), false, "unanswered keys must be absent");
assert.equal("mood" in toStoredCheckIn(oneAnswer), false);

// "Nothing hurt" is an answer and is stored; it is not the same as silence.
const noPain = { ...emptyCheckInDraft(), painFlagged: false };
assert.deepEqual(toStoredCheckIn(noPain), { painFlagged: false });
assert.equal(readCheckIn(toStoredCheckIn(noPain)).painFlagged, false);
assert.equal(readCheckIn(undefined).painFlagged, null, "no check-in is not 'no pain'");

// Pain requires a usable description before it can be submitted.
const painNoNote = { ...emptyCheckInDraft(), painFlagged: true, painNote: "" };
assert.equal(validateCheckInDraft(painNoNote).ok, false);
assert.equal(validateCheckInDraft({ ...painNoNote, painNote: "ow" }).ok, false, "too short to act on");
assert.equal(validateCheckInDraft({ ...painNoNote, painNote: "left knee, sharp" }).ok, true);
// Everything else stays optional.
assert.equal(validateCheckInDraft(emptyCheckInDraft()).ok, true);
assert.equal(validateCheckInDraft({ ...emptyCheckInDraft(), painFlagged: false }).ok, true);

// Values are clamped, not trusted.
assert.deepEqual(toStoredCheckIn({ ...emptyCheckInDraft(), energy: 9 }), { energy: 5 });
assert.deepEqual(toStoredCheckIn({ ...emptyCheckInDraft(), sleepHours: 99 }), { sleepHours: 12 });
assert.deepEqual(toStoredCheckIn({ ...emptyCheckInDraft(), sleepHours: 0 }), { sleepHours: 3 });

// Sore areas are de-duplicated and canonically ordered, so two clients
// reporting the same areas produce comparable documents.
const sore = { ...emptyCheckInDraft(), soreAreas: ["quads", "neck", "quads"] };
assert.deepEqual(toStoredCheckIn(sore).soreAreas, ["neck", "quads"]);
// Unknown areas from a future/tampered client are dropped rather than stored.
assert.deepEqual(
  toStoredCheckIn({ ...emptyCheckInDraft(), soreAreas: ["quads", "tail"] }).soreAreas,
  ["quads"]
);

// BACKWARD COMPATIBILITY: documents written before body areas existed carry a
// 1-5 `soreness`. They must still read as answered, and must not be mistaken
// for a body-area report.
const legacy = { energy: 3, mood: 4, soreness: 2, sleepHours: 7 };
const legacyRead = readCheckIn(legacy);
assert.equal(legacyRead.answered, true);
assert.equal(legacyRead.legacySoreness, 2);
assert.deepEqual(legacyRead.soreAreas, []);
assert.equal(legacyRead.painFlagged, null, "old docs never answered the pain question");

// A missing check-in reads as unanswered across the board.
const none = readCheckIn(undefined);
assert.equal(none.answered, false);
assert.equal(none.energy, null);
assert.equal(none.sleepHours, null);
assert.deepEqual(none.soreAreas, []);

// Pain detection drives the coach's priority queue.
assert.equal(hasPainReport({ painFlagged: true, painNote: "left knee" }), true);
assert.equal(hasPainReport({ painFlagged: false }), false);
assert.equal(hasPainReport(undefined), false);
assert.equal(hasPainReport({ energy: 5 }), false, "silence is not a pain report");

// ---------------------------------------------------------------------------
// CLIENT-LOCAL CALENDAR
//
// "Logged today" is a statement about the CLIENT's calendar day, never about
// elapsed hours and never about the coach's device.
// ---------------------------------------------------------------------------

// The bug this replaced: a session at 23:00 read at 01:00 is two hours old but
// belongs to YESTERDAY. Elapsed-time maths called it "today".
assert.deepEqual(
  describeClientActivity("2026-08-04", "2026-08-05"),
  { kind: "logged_recently", daysAgo: 1 },
  "a 23:00 session read at 01:00 next day is yesterday, not today"
);

// Same key = same day, regardless of how many hours apart.
assert.deepEqual(describeClientActivity("2026-08-05", "2026-08-05"), { kind: "logged_today" });

// Thresholds are exact and on calendar days.
assert.deepEqual(describeClientActivity("2026-08-03", "2026-08-05"), { kind: "logged_recently", daysAgo: 2 });
assert.deepEqual(describeClientActivity("2026-08-02", "2026-08-05"), { kind: "silent", daysAgo: 3 });
assert.deepEqual(describeClientActivity("2026-07-29", "2026-08-05"), { kind: "silent", daysAgo: 7 });

// A client who has never logged is not silent — they have not started.
assert.deepEqual(describeClientActivity(null, "2026-08-05"), { kind: "never_logged" });

// No client timezone means no client calendar. Reporting "silent 9 days" from
// the coach's own clock would be inventing a fact about someone else's week.
assert.deepEqual(describeClientActivity("2026-08-01", null), { kind: "unknown" });

// A future key (clock skew, or a client who flew east) must not read as silence.
assert.deepEqual(describeClientActivity("2026-08-06", "2026-08-05"), { kind: "logged_today" });

// --- Africa/Tunis, the project's reference zone (UTC+1, no DST) -------------
// 22:30 UTC on 4 Aug is 23:30 local on 4 Aug.
assert.equal(toZonedDateKey("Africa/Tunis", new Date("2026-08-04T22:30:00Z")), "2026-08-04");
// 23:30 UTC on 4 Aug has already become 5 Aug locally.
assert.equal(toZonedDateKey("Africa/Tunis", new Date("2026-08-04T23:30:00Z")), "2026-08-05");

// --- Coach and client in different zones see the SAME client day -----------
// One instant; the client's day is fixed by the CLIENT's zone alone.
const instant = new Date("2026-08-04T23:30:00Z");
const clientDay = toZonedDateKey("Africa/Tunis", instant);      // client in Tunis
const coachDeviceDay = toZonedDateKey("America/New_York", instant); // coach in NY
assert.equal(clientDay, "2026-08-05");
assert.equal(coachDeviceDay, "2026-08-04", "the coach's own device is on another day");
// The coach must be shown the CLIENT's day. Using their own would be a day out.
assert.deepEqual(describeClientActivity(clientDay, clientDay), { kind: "logged_today" });
assert.deepEqual(
  describeClientActivity(clientDay, coachDeviceDay),
  { kind: "logged_today" },
  "future-key guard stops the coach's earlier day reporting false silence"
);

// A client in Auckland is a day ahead of a coach in London.
const nz = toZonedDateKey("Pacific/Auckland", new Date("2026-08-04T20:00:00Z"));
const uk = toZonedDateKey("Europe/London", new Date("2026-08-04T20:00:00Z"));
assert.equal(nz, "2026-08-05");
assert.equal(uk, "2026-08-04");

// --- Midnight boundary ------------------------------------------------------
assert.equal(toZonedDateKey("Africa/Tunis", new Date("2026-08-04T22:59:59Z")), "2026-08-04");
assert.equal(toZonedDateKey("Africa/Tunis", new Date("2026-08-04T23:00:00Z")), "2026-08-05");

// --- Daylight saving --------------------------------------------------------
// London: BST (UTC+1) in summer, GMT (UTC+0) in winter. The same wall clock
// instant lands on different days either side of the transition.
assert.equal(toZonedDateKey("Europe/London", new Date("2026-08-04T23:30:00Z")), "2026-08-05", "BST = UTC+1");
assert.equal(toZonedDateKey("Europe/London", new Date("2026-12-04T23:30:00Z")), "2026-12-04", "GMT = UTC+0");
// Spring forward 2026: 01:00 UTC on 29 Mar, clocks go 01:00 -> 02:00 local.
assert.equal(toZonedDateKey("Europe/London", new Date("2026-03-29T00:30:00Z")), "2026-03-29");
assert.equal(toZonedDateKey("Europe/London", new Date("2026-03-29T01:30:00Z")), "2026-03-29");

// Day arithmetic across a DST boundary must still count calendar days, not
// 24-hour blocks — the 29th is a 23-hour day in London.
assert.equal(daysBetweenDateKeys("2026-03-28", "2026-03-30"), 2);

// COACH SIDE: an unknown or invalid client zone must NOT fall back to the
// coach's device. A coach in London must never be shown a client in Auckland's
// day computed from London's calendar.
assert.equal(getForeignClientTodayDateKey(null), "");
assert.equal(getForeignClientTodayDateKey(undefined), "");
assert.equal(getForeignClientTodayDateKey("Not/AZone"), "");
assert.equal(
  getForeignClientTodayDateKey("Africa/Tunis", new Date("2026-08-04T23:30:00Z")),
  "2026-08-05"
);

// TRAINEE SIDE: on the client's own device the fallback is correct, because
// "my today" and "this phone's today" are the same question.
assert.notEqual(getClientTodayDateKey(null), "", "trainee screens keep the device fallback");

// ---------------------------------------------------------------------------
// DAILY REPORT REVIEW STATUS
//
// A coach must classify a client-day using the client's timezone. Missing or
// invalid client timezone data is unknown, never a cue to borrow the coach's
// device calendar.
// ---------------------------------------------------------------------------

const reviewNow = new Date("2026-08-05T10:00:00Z");

assert.equal(
  deriveReviewStatus("2026-08-04", "Africa/Tunis", null, new Date("2026-08-04T18:00:00Z"), reviewNow),
  "pending_review",
  "a closed Tunis client-day is pending review",
);
assert.equal(
  deriveReviewStatus("2026-08-05", "Africa/Tunis", null, new Date("2026-08-05T08:00:00Z"), reviewNow),
  "live",
  "the current Tunis client-day remains live",
);
assert.equal(
  deriveReviewStatus("2026-08-04", null, null, new Date("2026-08-04T18:00:00Z"), reviewNow),
  "unknown",
  "a missing trainee timezone must not fall back to the coach device",
);
assert.equal(
  deriveReviewStatus("2026-08-04", "Not/AZone", null, new Date("2026-08-04T18:00:00Z"), reviewNow),
  "unknown",
  "an invalid trainee timezone must not fall back to the coach device",
);

// Changing the process/device timezone cannot alter a result whose calendar is
// explicitly anchored to the trainee. Restore the environment for later tests.
const originalProcessTimezone = process.env.TZ;
try {
  process.env.TZ = "America/Los_Angeles";
  const westCoachResult = deriveReviewStatus(
    "2026-08-04",
    "Africa/Tunis",
    null,
    new Date("2026-08-04T18:00:00Z"),
    reviewNow,
  );
  process.env.TZ = "Pacific/Auckland";
  const eastCoachResult = deriveReviewStatus(
    "2026-08-04",
    "Africa/Tunis",
    null,
    new Date("2026-08-04T18:00:00Z"),
    reviewNow,
  );
  assert.equal(westCoachResult, "pending_review");
  assert.equal(eastCoachResult, westCoachResult);
} finally {
  if (originalProcessTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalProcessTimezone;
}

// Timestamp-established states remain valid even when timezone data is absent.
assert.equal(
  deriveReviewStatus("2026-08-04", null, new Date(2000), new Date(1000), reviewNow),
  "reviewed",
);
assert.equal(
  deriveReviewStatus("2026-08-04", null, new Date(1000), new Date(2000), reviewNow),
  "reopened",
);

// A FUTURE client-day is not pending either. The rule is "before their today",
// not "not today" — a day that has not started cannot have been missed.
assert.equal(deriveReviewStatus("2026-08-06", "Africa/Tunis", null, null, reviewNow), "live");
// Days further back are pending too, not just yesterday.
assert.equal(deriveReviewStatus("2026-07-28", "Africa/Tunis", null, null, reviewNow), "pending_review");
// An empty-string zone is the same absence of information as a missing one.
assert.equal(deriveReviewStatus("2026-08-04", "", null, null, reviewNow), "unknown");

// The reviewed/reopened boundary is `>=`, so a review recorded at the same
// instant as the last activity is NOT stale. Firestore writes both with
// `serverTimestamp()`, and equal values are common enough to matter.
assert.equal(
  deriveReviewStatus("2026-08-04", "Africa/Tunis", new Date(5000), new Date(5000), reviewNow),
  "reviewed",
);
// Reviewed with no recorded activity at all is still reviewed.
assert.equal(deriveReviewStatus("2026-08-04", "Africa/Tunis", new Date(5000), null, reviewNow), "reviewed");

// Firestore Timestamps, not just Dates. This is the shape the service actually
// receives from a snapshot.
assert.equal(
  deriveReviewStatus("2026-08-04", "Africa/Tunis", { toMillis: () => 5000 }, { toMillis: () => 9000 }, reviewNow),
  "reopened",
);

// `unknown` must not swallow the timestamp-established states when the zone is
// invalid rather than merely absent — the existing cases above cover `null`.
assert.equal(
  deriveReviewStatus("2026-08-04", "Not/AZone", new Date(5000), new Date(1000), reviewNow),
  "reviewed",
);
assert.equal(
  deriveReviewStatus("2026-08-04", "Not/AZone", new Date(5000), new Date(9000), reviewNow),
  "reopened",
);
// And an ABSENT review (millis 0) does fall through to the calendar question.
assert.equal(deriveReviewStatus("2026-08-04", null, null, null, reviewNow), "unknown");

// ---------------------------------------------------------------------------
// PAIN QUEUE
//
// Pain is PENDING until a coach explicitly acknowledges it. Reading about an
// injury is not the same as deciding what to do about it, so opening a screen
// must never clear one.
// ---------------------------------------------------------------------------

const painTs = (millis) => ({ toMillis: () => millis });
const client = (id, summary, name) => ({ id, name: name || id, clientSummary: summary });

// No pain anywhere gives no action.
assert.deepEqual(selectPendingPainReports([]), []);
assert.deepEqual(selectPendingPainReports([client("a", {}), client("b", null)]), []);
assert.equal(isPainPending(undefined), false);
assert.equal(isPainPending({}), false);

// One pending report.
const single = selectPendingPainReports([
  client("a", { lastPainAt: painTs(1000), lastPainNote: "left knee", lastPainDateKey: "2026-08-04" }, "Karim"),
]);
assert.equal(single.length, 1);
assert.equal(single[0].traineeId, "a");
assert.equal(single[0].traineeName, "Karim");
assert.equal(single[0].note, "left knee");
assert.equal(single[0].dateKey, "2026-08-04");

// SEVERAL clients, newest first. The old code took an arbitrary `find`, always
// counted 1, and hid the rest.
const many = selectPendingPainReports([
  client("older", { lastPainAt: painTs(1000) }),
  client("newest", { lastPainAt: painTs(9000) }),
  client("middle", { lastPainAt: painTs(5000) }),
]);
assert.deepEqual(many.map((r) => r.traineeId), ["newest", "middle", "older"]);
assert.equal(many.length, 3, "count reflects EVERY pending client, not 1");

// Acknowledged pain is excluded — this is what stops one old report owning the
// top action forever.
assert.equal(
  isPainPending({ lastPainAt: painTs(1000), lastPainAcknowledgedAt: painTs(2000) }),
  false
);
assert.deepEqual(
  selectPendingPainReports([
    client("acked", { lastPainAt: painTs(1000), lastPainAcknowledgedAt: painTs(2000) }),
  ]),
  []
);

// A LATER report after an acknowledgement becomes pending again, with no extra
// bookkeeping — it falls out of the timestamp comparison.
assert.equal(
  isPainPending({ lastPainAt: painTs(3000), lastPainAcknowledgedAt: painTs(2000) }),
  true
);

// An acknowledgement at exactly the same millisecond counts as acknowledged.
assert.equal(
  isPainPending({ lastPainAt: painTs(2000), lastPainAcknowledgedAt: painTs(2000) }),
  false
);

// Missing/!unreadable timestamps are handled safely: an unreadable
// acknowledgement must NOT clear a real report.
assert.equal(painToMillis(undefined), 0);
assert.equal(painToMillis(null), 0);
assert.equal(painToMillis({}), 0);
assert.equal(painToMillis({ seconds: 5 }), 5000, "cache-shaped timestamps");
assert.equal(painToMillis(new Date(4242)), 4242);
assert.equal(
  isPainPending({ lastPainAt: painTs(1000), lastPainAcknowledgedAt: null }),
  true,
  "a pending serverTimestamp must not dismiss the report"
);
// A report with no readable timestamp cannot be ordered or acknowledged, so it
// is not surfaced rather than being pinned to the top with millis 0.
assert.equal(isPainPending({ lastPainAt: {} }), false);

// Ties are broken deterministically so the card does not swap between renders.
const tied = selectPendingPainReports([
  client("zoe", { lastPainAt: painTs(7000) }),
  client("adam", { lastPainAt: painTs(7000) }),
]);
assert.deepEqual(tied.map((r) => r.traineeId), ["adam", "zoe"]);

// ACKNOWLEDGEMENT IS NARROW: only the day the pain was reported on clears it.
// Reviewing an unrelated Tuesday must not dismiss a Thursday injury.
const painOnThu = { lastPainAt: painTs(1000), lastPainDateKey: "2026-08-06" };
assert.equal(shouldAcknowledgePainOnReview(painOnThu, "2026-08-06"), true);
assert.equal(shouldAcknowledgePainOnReview(painOnThu, "2026-08-04"), false);
// Nothing to acknowledge when there is no pending pain.
assert.equal(shouldAcknowledgePainOnReview({}, "2026-08-06"), false);
assert.equal(
  shouldAcknowledgePainOnReview(
    { lastPainAt: painTs(1000), lastPainDateKey: "2026-08-06", lastPainAcknowledgedAt: painTs(2000) },
    "2026-08-06"
  ),
  false
);
// A report with no date key cannot be matched to a reviewed day.
assert.equal(shouldAcknowledgePainOnReview({ lastPainAt: painTs(1000) }, "2026-08-06"), false);

// ---------------------------------------------------------------------------
// COACH ACTION IDENTITY AND COUNTING
//
// Two bugs that a rendered screen would have shown as "9 waiting" and a React
// key warning, and that no amount of reading the component would have made
// obvious.
// ---------------------------------------------------------------------------

// Build the pain slice of the queue exactly as CoachHomeScreen does.
const painActionsFor = (clients) =>
  selectPendingPainReports(clients).map((report) => ({
    id: buildPainActionId(report.traineeId, report.dateKey, report.reportedAtMillis),
    count: 1,
  }));

// ZERO pain reports.
const zeroPain = painActionsFor([client("a", {}), client("b", {})]);
assert.equal(zeroPain.length, 0);
assert.equal(totalWaitingCount(zeroPain), 0);
assert.equal(hasUniqueActionIds(zeroPain), true);

// ONE pain report contributes exactly one to the total.
const onePain = painActionsFor([
  client("a", { lastPainAt: painTs(1000), lastPainDateKey: "2026-08-04" }),
  client("b", {}),
]);
assert.equal(onePain.length, 1);
assert.equal(totalWaitingCount(onePain), 1);
assert.equal(hasUniqueActionIds(onePain), true);

// THREE pain reports contribute exactly three — not nine.
//
// The old code set `count: pendingPain.length` on EVERY pain action and then
// summed `count` across the queue, so each of the three reports claimed all
// three. The priority card read "9 waiting" for three injured clients.
const threePain = painActionsFor([
  client("a", { lastPainAt: painTs(1000), lastPainDateKey: "2026-08-04" }),
  client("b", { lastPainAt: painTs(2000), lastPainDateKey: "2026-08-04" }),
  client("c", { lastPainAt: painTs(3000), lastPainDateKey: "2026-08-05" }),
]);
assert.equal(threePain.length, 3);
assert.equal(totalWaitingCount(threePain), 3, "three reports must not multiply into nine");
assert.equal(hasUniqueActionIds(threePain), true, "three clients must not share the id \"pain\"");

// Same day, different clients: still distinct. This is the collision the old
// `id: action.type` produced — every pain row was keyed the literal "pain".
assert.equal(
  buildPainActionId("a", "2026-08-04", 1000) === buildPainActionId("b", "2026-08-04", 1000),
  false
);
// Same client, different day: a new report gets a new id, so the row remounts
// rather than animating yesterday's content into today's.
assert.equal(
  buildPainActionId("a", "2026-08-04", 1000) === buildPainActionId("a", "2026-08-05", 2000),
  false
);
// Legacy summaries with no date key fall back to the timestamp.
assert.equal(buildPainActionId("a", null, 1000), "pain:a:1000");
assert.equal(buildPainActionId("a", undefined, 1000), "pain:a:1000");

// Aggregate rows legitimately carry a count above one: a single "3 unread
// messages" row stands for three things waiting.
assert.equal(totalWaitingCount([...threePain, { id: "message", count: 3 }]), 6);
assert.equal(hasUniqueActionIds([...threePain, { id: "message", count: 3 }]), true);
// The invariant must actually fail when it is violated.
assert.equal(hasUniqueActionIds([{ id: "pain", count: 1 }, { id: "pain", count: 1 }]), false);

// ---------------------------------------------------------------------------
// A PERSISTED WORKOUT DAY DOES NOT MOVE WHEN THE CLIENT MOVES
//
// `describeSignalActivity` used to derive the workout's day by re-resolving
// `lastWorkoutAt` against the client's CURRENT timezone. A client who trained
// in Tunis and then flew to Auckland would have every historical session
// silently re-dated, because the same instant lands on a different calendar day
// in a zone 11 hours ahead. `lastWorkoutDateKey` pins the day at write time.
// ---------------------------------------------------------------------------

// 22:30 in Tunis on the 4th. In Auckland that same instant is already the 5th.
const lateSession = new Date("2026-08-04T21:30:00Z");
const nowUtc = new Date("2026-08-06T09:00:00Z");

const storedInTunis = {
  lastWorkoutAt: lateSession,
  lastWorkoutDateKey: "2026-08-04",
  timezone: "Africa/Tunis",
};
// Same stored key, client has since moved to Auckland.
const movedToAuckland = { ...storedInTunis, timezone: "Pacific/Auckland" };

// `nowUtc` is deliberately an instant that falls on 2026-08-06 in BOTH zones
// (10:00 in Tunis, 21:00 in Auckland), so "today" is held constant and the only
// thing under test is which day the WORKOUT is attributed to.

// Without a stored key, the derived day disagrees across the move: the same
// instant is 22:30 on the 4th in Tunis and 09:30 on the 5th in Auckland.
const derivedTunis = describeSignalActivity(
  { lastWorkoutAt: lateSession, timezone: "Africa/Tunis" },
  nowUtc
);
const derivedAuckland = describeSignalActivity(
  { lastWorkoutAt: lateSession, timezone: "Pacific/Auckland" },
  nowUtc
);
assert.deepEqual(derivedTunis, { kind: "logged_recently", daysAgo: 2 });
assert.deepEqual(derivedAuckland, { kind: "logged_recently", daysAgo: 1 });
assert.notDeepEqual(
  derivedTunis,
  derivedAuckland,
  "derivation is exactly the drift the stored key exists to prevent"
);

// With a stored key, the answer is identical before and after the move. The
// session happened on the 4th because that is the day the client lived through
// when they did it, and no later profile edit can restate it.
assert.deepEqual(describeSignalActivity(storedInTunis, nowUtc), { kind: "logged_recently", daysAgo: 2 });
assert.deepEqual(
  describeSignalActivity(movedToAuckland, nowUtc),
  { kind: "logged_recently", daysAgo: 2 }
);
assert.deepEqual(
  describeSignalActivity(storedInTunis, nowUtc),
  describeSignalActivity(movedToAuckland, nowUtc),
  "a timezone change must not re-date a persisted historical workout day"
);
assert.equal(storedInTunis.lastWorkoutDateKey, movedToAuckland.lastWorkoutDateKey);

// The stored key WINS over the timestamp, even when they contradict.
assert.deepEqual(
  describeSignalActivity(
    { lastWorkoutAt: new Date("2026-08-06T08:00:00Z"), lastWorkoutDateKey: "2026-08-01", timezone: "Africa/Tunis" },
    nowUtc
  ),
  { kind: "silent", daysAgo: 5 }
);

// LEGACY: no stored key, but an interpretable timestamp and zone.
assert.deepEqual(
  describeSignalActivity({ lastWorkoutAt: new Date("2026-08-06T08:00:00Z"), timezone: "Africa/Tunis" }, nowUtc),
  { kind: "logged_today" }
);

// Never logged: neither a key nor a timestamp.
assert.deepEqual(describeSignalActivity({ lastWorkoutAt: null, timezone: "Africa/Tunis" }, nowUtc), { kind: "never_logged" });
assert.deepEqual(describeSignalActivity({ lastWorkoutAt: null, lastWorkoutDateKey: null, timezone: "Africa/Tunis" }, nowUtc), { kind: "never_logged" });
// An empty string is not a day.
assert.deepEqual(describeSignalActivity({ lastWorkoutAt: null, lastWorkoutDateKey: "", timezone: "Africa/Tunis" }, nowUtc), { kind: "never_logged" });

// UNKNOWN, not a guess: a stored day with no client zone cannot be turned into
// "silent 5 days" without borrowing the coach's clock.
assert.deepEqual(describeSignalActivity({ lastWorkoutAt: lateSession, lastWorkoutDateKey: "2026-08-04", timezone: null }, nowUtc), { kind: "unknown" });
assert.deepEqual(describeSignalActivity({ lastWorkoutAt: lateSession, timezone: "Not/AZone" }, nowUtc), { kind: "unknown" });

// ---------------------------------------------------------------------------
// CLIENT-DAY NAVIGATION
//
// The screen stepped days like this:
//
//   const parsed = new Date(`${selectedDate}T12:00:00`);
//   parsed.setDate(parsed.getDate() + deltaDays);
//   const next = toLocalDateKey(parsed);
//
// A date string with no zone suffix parses in the DEVICE zone, `setDate` rolls
// over in the device calendar, and `toLocalDateKey` formats back in the device
// zone. The noon anchor hid it for most coaches, which is worse than an obvious
// bug: it worked until it did not. This is string arithmetic with no clock.
// ---------------------------------------------------------------------------

const CLIENT_TODAY = "2026-08-10";

// Ordinary steps.
assert.equal(stepClientDay("2026-08-05", 1, CLIENT_TODAY), "2026-08-06");
assert.equal(stepClientDay("2026-08-05", -1, CLIENT_TODAY), "2026-08-04");
assert.equal(stepClientDay("2026-08-05", -7, CLIENT_TODAY), "2026-07-29");

// MONTH boundary, both directions.
assert.equal(stepClientDay("2026-07-31", 1, CLIENT_TODAY), "2026-08-01");
assert.equal(stepClientDay("2026-08-01", -1, CLIENT_TODAY), "2026-07-31");
// A 30-day month.
assert.equal(stepClientDay("2026-06-30", 1, CLIENT_TODAY), "2026-07-01");
assert.equal(stepClientDay("2026-07-01", -1, CLIENT_TODAY), "2026-06-30");

// YEAR boundary.
assert.equal(stepClientDay("2025-12-31", 1, CLIENT_TODAY), "2026-01-01");
assert.equal(stepClientDay("2026-01-01", -1, CLIENT_TODAY), "2025-12-31");

// LEAP DAY. 2028 is a leap year, 2027 is not.
assert.equal(stepClientDay("2028-02-28", 1, "2028-12-31"), "2028-02-29");
assert.equal(stepClientDay("2028-02-29", 1, "2028-12-31"), "2028-03-01");
assert.equal(stepClientDay("2028-03-01", -1, "2028-12-31"), "2028-02-29");
// A non-leap year skips straight from the 28th to March.
assert.equal(stepClientDay("2027-02-28", 1, "2027-12-31"), "2027-03-01");
assert.equal(stepClientDay("2027-03-01", -1, "2027-12-31"), "2027-02-28");
// Century rule: 2100 is NOT a leap year.
assert.equal(stepClientDay("2100-02-28", 1, "2100-12-31"), "2100-03-01");
// ...but 2000 was.
assert.equal(stepClientDay("2000-02-28", 1, "2000-12-31"), "2000-02-29");

// FUTURE PREVENTION. The client's today is reachable; the day after is not.
assert.equal(stepClientDay("2026-08-09", 1, CLIENT_TODAY), CLIENT_TODAY);
assert.equal(stepClientDay(CLIENT_TODAY, 1, CLIENT_TODAY), null);
// Nor by a longer jump.
assert.equal(stepClientDay("2026-08-09", 5, CLIENT_TODAY), null);
// Stepping BACK from today is always allowed.
assert.equal(stepClientDay(CLIENT_TODAY, -1, CLIENT_TODAY), "2026-08-09");

// NO CLIENT CALENDAR, NO NAVIGATION. Bounding against the coach's today would
// be exactly the device fallback this phase removes, so the step is refused.
assert.equal(stepClientDay("2026-08-05", 1, ""), null);
assert.equal(stepClientDay("2026-08-05", -1, ""), null);
assert.equal(stepClientDay("2026-08-05", -1, "Not/AZone"), null);

// Malformed input never throws and never guesses.
assert.equal(stepClientDay("", 1, CLIENT_TODAY), null);
assert.equal(stepClientDay("05-08-2026", 1, CLIENT_TODAY), null);
assert.equal(stepClientDay("2026-02-30", 1, CLIENT_TODAY), null, "a date that does not exist");
assert.equal(stepClientDay("2026-13-01", -1, CLIENT_TODAY), null);
assert.equal(stepClientDay("2026-08-05", 1.5, CLIENT_TODAY), null);
assert.equal(stepClientDay("2026-08-05", 0, CLIENT_TODAY), null);

// `isValidDateKey` rejects real-looking impossibilities.
assert.equal(isValidDateKey("2026-08-05"), true);
assert.equal(isValidDateKey("2028-02-29"), true);
assert.equal(isValidDateKey("2027-02-29"), false, "not a leap year");
assert.equal(isValidDateKey("2026-04-31"), false, "April has 30 days");
assert.equal(isValidDateKey(null), false);
assert.equal(isValidDateKey(20260805), false);

// THE CONTROLS AND THE STEP AGREE.
//
// These were two independent conditions: the button was disabled on `isToday`
// (client calendar) while the guard inside stepDay compared a device-derived
// key. On any day those disagreed the control was enabled and did nothing.
assert.equal(canStepForward("2026-08-09", CLIENT_TODAY), true);
assert.equal(canStepForward(CLIENT_TODAY, CLIENT_TODAY), false);
assert.equal(canStepBack(CLIENT_TODAY, CLIENT_TODAY), true);
// Both controls are dead without a client calendar, matching the screen's
// existing "client date unavailable" state.
assert.equal(canStepForward("2026-08-05", ""), false);
assert.equal(canStepBack("2026-08-05", ""), false);

// THE COACH'S DEVICE TIMEZONE CANNOT CHANGE ANY OF IT.
const originalNavTimezone = process.env.TZ;
try {
  const results = [];
  for (const zone of ["Africa/Tunis", "Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
    process.env.TZ = zone;
    results.push([
      stepClientDay("2026-07-31", 1, CLIENT_TODAY),
      stepClientDay("2026-01-01", -1, CLIENT_TODAY),
      stepClientDay("2028-02-28", 1, "2028-12-31"),
      stepClientDay(CLIENT_TODAY, 1, CLIENT_TODAY),
      canStepForward("2026-08-09", CLIENT_TODAY),
    ]);
  }
  const [first, ...rest] = results;
  assert.deepEqual(first, ["2026-08-01", "2025-12-31", "2028-02-29", null, true]);
  rest.forEach((result) => {
    assert.deepEqual(result, first, "day navigation must not depend on the coach device zone");
  });
} finally {
  if (originalNavTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalNavTimezone;
}

// ---------------------------------------------------------------------------
// MULTI-READ SECTION STATUS
//
// A card assembled from two reads must not report the healthier of them.
// ---------------------------------------------------------------------------

assert.equal(combineDimensionStatus(["loaded", "loaded"]), "loaded");
// Error wins over everything, including a fully loaded partner.
assert.equal(combineDimensionStatus(["loaded", "error"]), "error");
assert.equal(combineDimensionStatus(["error", "loaded"]), "error");
// Error also wins over loading — a section built partly from a failed read is
// not "still coming".
assert.equal(combineDimensionStatus(["loading", "error"]), "error");
// Loading beats loaded: a section is finished only when all its inputs are.
assert.equal(combineDimensionStatus(["loaded", "loading"]), "loading");
assert.equal(combineDimensionStatus(["loading", "loading"]), "loading");
// Single input passes straight through.
assert.equal(combineDimensionStatus(["loaded"]), "loaded");
assert.equal(combineDimensionStatus(["error"]), "error");
// No inputs cannot be "loaded" — nothing has loaded.
assert.equal(combineDimensionStatus([]), "loading");

// ---------------------------------------------------------------------------
// RETRY LIFECYCLE
//
// The client-day report loads through TWO mechanisms: six listeners inside
// useTraineeDetailData, and the daily-report listener on the screen. Retry
// state used to belong to the hook alone, which broke in both directions.
// ---------------------------------------------------------------------------

const allLoaded = {
  meals: "loaded",
  workouts: "loaded",
  water: "loaded",
  metrics: "loaded",
  profile: "loaded",
  plannedWorkout: "loaded",
  plannedNutrition: "loaded",
  report: "loaded",
};

// Nothing to retry when everything is loaded.
assert.deepEqual(selectRetryTargets(allLoaded), []);
assert.equal(isRetryBusy([], allLoaded), false);

// Targets are everything NOT loaded — errors and stalls alike. A coach tapping
// Retry at ten seconds should not have a still-loading listener excluded.
assert.deepEqual(
  selectRetryTargets({ ...allLoaded, meals: "error", water: "loading" }),
  ["meals", "water"]
);

// THE REPORT-ONLY FAILURE. This is the case the hook could not express: all six
// of its dimensions are loaded, so `isRetrying` was set true and then cleared
// by the very next settling pass, before the report had answered.
const reportOnlyTargets = selectRetryTargets({ ...allLoaded, report: "error" });
assert.deepEqual(reportOnlyTargets, ["report"]);
// Immediately after the tap the report is loading, so the control is busy...
assert.equal(isRetryBusy(reportOnlyTargets, { ...allLoaded, report: "loading" }), true);
// ...and the six loaded hook dimensions cannot end it early.
assert.equal(
  isRetrySettled(reportOnlyTargets, { ...allLoaded, report: "loading" }),
  false,
  "a fully loaded hook must not settle a report-only retry"
);
// It ends when the report itself answers — either way.
assert.equal(isRetryBusy(reportOnlyTargets, allLoaded), false);
assert.equal(
  isRetryBusy(reportOnlyTargets, { ...allLoaded, report: "error" }),
  false,
  "a retry that failed again is finished; the coach must be able to tap once more"
);

// AN UNRELATED SOURCE CANNOT HOLD THE BUTTON BUSY.
//
// Busy depends only on the recorded targets. A dimension that starts loading
// for its own reasons mid-retry is not part of this lifecycle.
assert.equal(
  isRetryBusy(reportOnlyTargets, { ...allLoaded, report: "loaded", metrics: "loading" }),
  false
);

// A LOADED REPORT IS NEVER A TARGET, so an unrelated retry leaves it alone —
// which is what keeps the review bar and photo card on screen.
const mealsOnlyTargets = selectRetryTargets({ ...allLoaded, meals: "error" });
assert.deepEqual(mealsOnlyTargets, ["meals"]);
assert.equal(mealsOnlyTargets.includes("report"), false);
// It stays busy while meals reloads, with the report untouched throughout.
assert.equal(isRetryBusy(mealsOnlyTargets, { ...allLoaded, meals: "loading" }), true);
assert.equal(isRetryBusy(mealsOnlyTargets, allLoaded), false);

// REPEATED TAPS: busy holds for the WHOLE retry, so the control stays disabled
// until the last target settles rather than the first.
const manyTargets = selectRetryTargets({
  ...allLoaded,
  meals: "error",
  water: "error",
  report: "error",
});
assert.deepEqual(manyTargets, ["meals", "report", "water"]);
assert.equal(
  isRetryBusy(manyTargets, { ...allLoaded, meals: "loaded", water: "loading", report: "loading" }),
  true,
  "one target finishing must not re-enable the button"
);
assert.equal(
  isRetryBusy(manyTargets, { ...allLoaded, meals: "loaded", water: "loaded", report: "loading" }),
  true
);
assert.equal(isRetryBusy(manyTargets, allLoaded), false);

// A source that vanishes mid-retry settles rather than stranding the control.
assert.equal(isRetrySettled(["gone"], allLoaded), true);

// ---------------------------------------------------------------------------
// NUTRITION MISSION WITHOUT INVENTED TARGETS
//
// `input.calorieTarget || 2100` printed "0/2100 kcal logged" to a trainee who
// had never been given a target — a denominator nobody set, shown as their
// goal. And `nutritionComplete = caloriesLogged > 0` produced the subtitle
// "Nutrition is on track", so a single 40 kcal coffee reported the day as on
// track against a target that did not exist.
// ---------------------------------------------------------------------------

const missionBase = {
  hasWorkoutToday: false,
  caloriesLogged: 0,
  calorieTarget: null,
  nutritionTargetStatus: "absent",
  hasCoachAssigned: false,
  hasMessagedToday: false,
  hasPendingWorkoutPlan: false,
  hasPendingMealPlan: false,
  hasBodyMetricToday: false,
};
const nutritionItem = (overrides) =>
  buildTodayMission({ ...missionBase, ...overrides }).items.find((item) => item.id === "nutrition");

// NO PROFILE TARGETS, NO LOGS. States the absence; invents nothing.
const noTargetNoLogs = nutritionItem({});
assert.equal(noTargetNoLogs.subtitle, "No nutrition targets set");
assert.equal(noTargetNoLogs.isComplete, false);
// Undefined is treated the same as null — legacy profiles simply omit the field.
assert.equal(nutritionItem({ calorieTarget: undefined }).subtitle, "No nutrition targets set");
assert.equal(
  nutritionItem({ nutritionTargetStatus: "unknown" }).subtitle,
  "Nutrition target unavailable"
);
assert.equal(nutritionItem({}).title, "Log nutrition");

// ZERO CALORIES WITH NO TARGET. Must not read "0/2100" or "0/0".
const zeroNoTarget = nutritionItem({ caloriesLogged: 0 });
assert.equal(zeroNoTarget.subtitle, "No nutrition targets set");
assert.equal(zeroNoTarget.subtitle.includes("/"), false, "no denominator without a target");
assert.equal(zeroNoTarget.subtitle.includes("2100"), false);

// LOGGED CALORIES WITH NO TARGET. States what is known and nothing more.
const loggedNoTarget = nutritionItem({ caloriesLogged: 1450 });
assert.equal(loggedNoTarget.subtitle, "1450 kcal logged");
assert.equal(loggedNoTarget.subtitle.includes("/"), false);
// Complete, because the mission is to LOG — but the wording claims no adherence.
assert.equal(loggedNoTarget.isComplete, true);
assert.equal(loggedNoTarget.subtitle.includes("on track"), false, "logging is not compliance");

// A VALID EXPLICIT TARGET keeps the ratio.
const withTarget = nutritionItem({ caloriesLogged: 1450, calorieTarget: 2200 });
assert.equal(withTarget.subtitle, "1450/2200 kcal logged");
assert.equal(withTarget.isComplete, true);
// Still never "on track" — that sentence is gone entirely.
assert.equal(withTarget.subtitle.includes("on track"), false);
// Zero logged against a real target is a real ratio.
assert.equal(nutritionItem({ caloriesLogged: 0, calorieTarget: 2200 }).subtitle, "0/2200 kcal logged");

// A PENDING COACH MEAL PLAN WITHOUT TARGETS keeps the required title.
const pendingPlan = nutritionItem({ hasPendingMealPlan: true });
assert.equal(pendingPlan.title, "Review nutrition plan");
assert.equal(pendingPlan.subtitle, "No nutrition targets set");
// And with logs but still no targets.
assert.equal(
  nutritionItem({ hasPendingMealPlan: true, caloriesLogged: 900 }).subtitle,
  "900 kcal logged"
);

// NO NaN, Infinity, DIVIDE-BY-ZERO OR FAKE DENOMINATOR anywhere in the copy.
const hostileInputs = [
  { caloriesLogged: 0, calorieTarget: 0 },
  { caloriesLogged: 500, calorieTarget: 0 },
  { caloriesLogged: 500, calorieTarget: -2000 },
  { caloriesLogged: -500, calorieTarget: 2000 },
  { caloriesLogged: Number.NaN, calorieTarget: 2000 },
  { caloriesLogged: Number.POSITIVE_INFINITY, calorieTarget: 2000 },
  { caloriesLogged: 500, calorieTarget: Number.NaN },
  { caloriesLogged: 500, calorieTarget: Number.POSITIVE_INFINITY },
];
hostileInputs.forEach((overrides) => {
  const item = nutritionItem(overrides);
  const label = JSON.stringify(overrides);
  assert.equal(item.subtitle.includes("NaN"), false, `NaN leaked for ${label}`);
  assert.equal(item.subtitle.includes("Infinity"), false, `Infinity leaked for ${label}`);
  assert.equal(item.subtitle.includes("/0"), false, `zero denominator for ${label}`);
  assert.equal(item.subtitle.includes("2100"), false, `fabricated target for ${label}`);
  assert.equal(item.subtitle.includes("-"), false, `negative value for ${label}`);
  const mission = buildTodayMission({ ...missionBase, ...overrides });
  assert.equal(Number.isFinite(mission.completionPercent), true, `completion NaN for ${label}`);
});
// A zero or negative target is not a target: it falls back to the honest copy,
// never to "X/0 kcal".
assert.equal(nutritionItem({ caloriesLogged: 500, calorieTarget: 0 }).subtitle, "500 kcal logged");
assert.equal(nutritionItem({ caloriesLogged: 0, calorieTarget: 0 }).subtitle, "No nutrition targets set");

// Missing targets are unknown ratios, never a fabricated 0% against 2,000 kcal.
assert.deepEqual(calculateNutritionProgress(500, null), { progress: 0, percent: null });
assert.equal(calculateMacroAdherence(500, undefined), null);
assert.deepEqual(calculateNutritionProgress(500, 2000), { progress: 0.25, percent: 25 });
assert.deepEqual(calculateNutritionProgress(2500, 2000), { progress: 1, percent: 100 });
assert.deepEqual(calculateNutritionProgress(Number.NaN, 2000), { progress: 0, percent: 0 });

// A cached listener failure reaches its subscriber and is evicted, allowing a
// later subscription to establish a fresh source instead of inheriting null.
clearSubscriptionCache();
const cacheFailure = new Error("offline");
let receivedCacheError = null;
let receivedCacheValue = null;
subscribeWithCache(
  "profile:test",
  (_emit, onError) => {
    onError(cacheFailure);
    return () => {};
  },
  (value) => { receivedCacheValue = value; },
  (error) => { receivedCacheError = error; }
);
assert.equal(receivedCacheError, cacheFailure);
assert.equal(receivedCacheValue, null);

let recreatedSubscriptions = 0;
const releaseRecovered = subscribeWithCache(
  "profile:test",
  (emit) => {
    recreatedSubscriptions += 1;
    emit({ uid: "test" });
    return () => {};
  },
  (value) => { receivedCacheValue = value; }
);
assert.equal(recreatedSubscriptions, 1);
assert.deepEqual(receivedCacheValue, { uid: "test" });
releaseRecovered();
clearSubscriptionCache();

// ---------------------------------------------------------------------------
// PLAN ADJUSTMENT
//
// AdjustPlanScreen used to call `createPlanRevision`, which wrote ONE
// planRevisions document and nothing else, then reported "Change recorded". No
// workout, meal plan or program changed anywhere. These assertions cover the
// rules that now stand between a coach and that silent success.
// ---------------------------------------------------------------------------

// The suite runs at an arbitrary real time, so "today" is taken from the same
// helper the service uses rather than hard-coded.
const { getForeignClientTodayDateKey: foreignToday } = require(path.join(src, "utils", "dateKeys.ts"));
const TUNIS = "Africa/Tunis";
const clientToday = foreignToday(TUNIS);
const clientTomorrow = addDaysToDateKey(clientToday, 1);
const clientYesterday = addDaysToDateKey(clientToday, -1);

// TODAY IS REJECTED. The client may already have opened or started it.
assert.equal(validateEffectiveDate(clientToday, TUNIS).ok, false, "today must be rejected");
assert.match(
  validateEffectiveDate(clientToday, TUNIS).message,
  /earliest replacement is tomorrow/i
);
// YESTERDAY, and anything older.
assert.equal(validateEffectiveDate(clientYesterday, TUNIS).ok, false);
assert.equal(validateEffectiveDate(addDaysToDateKey(clientToday, -30), TUNIS).ok, false);
// TOMORROW is the earliest legal day, and later days are fine.
assert.equal(validateEffectiveDate(clientTomorrow, TUNIS).ok, true);
assert.equal(validateEffectiveDate(addDaysToDateKey(clientToday, 14), TUNIS).ok, true);

// UNKNOWN TIMEZONE blocks the write rather than borrowing the coach's calendar.
assert.equal(validateEffectiveDate(clientTomorrow, null).ok, false);
assert.equal(validateEffectiveDate(clientTomorrow, "").ok, false);
assert.equal(validateEffectiveDate(clientTomorrow, "Not/AZone").ok, false);
assert.match(validateEffectiveDate(clientTomorrow, null).message, /timezone is unknown/i);

// MALFORMED DATES.
["", "not-a-date", "05-08-2026", "2026-13-01", "2026-02-30", "2027-02-29"].forEach((bad) => {
  assert.equal(validateEffectiveDate(bad, TUNIS).ok, false, `${bad} must be rejected`);
});

// ---- NEXT MONDAY, FROM EVERY WEEKDAY --------------------------------------
//
// "In a week" was `clientToday + 7`: asked on a Friday it landed on a Friday.
// 2026-08-10 is a Monday, so this walks a known week.
assert.equal(nextMondayDateKey("2026-08-09"), "2026-08-10", "Sunday -> the following day");
assert.equal(nextMondayDateKey("2026-08-10"), "2026-08-17", "Monday -> seven days later");
assert.equal(nextMondayDateKey("2026-08-11"), "2026-08-17", "Tuesday -> the following Monday");
assert.equal(nextMondayDateKey("2026-08-12"), "2026-08-17", "Wednesday");
assert.equal(nextMondayDateKey("2026-08-13"), "2026-08-17", "Thursday");
assert.equal(nextMondayDateKey("2026-08-14"), "2026-08-17", "Friday");
assert.equal(nextMondayDateKey("2026-08-15"), "2026-08-17", "Saturday");
// Never returns its own argument, and always lands on a Monday.
for (let offset = 0; offset < 21; offset += 1) {
  const from = addDaysToDateKey("2026-08-09", offset);
  const monday = nextMondayDateKey(from);
  assert.equal(monday > from, true, `${from} must move forward`);
  assert.equal(new Date(`${monday}T00:00:00.000Z`).getUTCDay(), 1, `${monday} must be a Monday`);
  assert.equal(daysBetweenDateKeys(from, monday) <= 7, true, "never more than a week away");
}
// Month, year and leap boundaries.
assert.equal(nextMondayDateKey("2026-08-30"), "2026-08-31", "Sunday crossing into a new month");
assert.equal(nextMondayDateKey("2026-12-29"), "2027-01-04", "crossing the year");
assert.equal(nextMondayDateKey("2028-02-28"), "2028-03-06", "leap year, Monday the 28th");
assert.equal(nextMondayDateKey("2028-02-27"), "2028-02-28", "the Sunday before a leap day");
// Malformed input throws rather than guessing a Monday.
assert.throws(() => nextMondayDateKey("2026-02-30"));
assert.throws(() => nextMondayDateKey(""));

// ---- ADJUSTMENT VALIDATION ------------------------------------------------
const adjustmentBase = {
  traineeId: "trainee_1",
  kind: "workout",
  effectiveFromDateKey: clientTomorrow,
  reason: "He has missed the Saturday session four weeks running.",
  summary: "Four sessions down to three",
  traineeTimezone: TUNIS,
};
const adjust = (overrides, scheduled) =>
  validateAdjustment({ ...adjustmentBase, ...overrides }, scheduled === undefined ? clientTomorrow : scheduled);

assert.equal(adjust({}).ok, true);
assert.equal(adjust({ kind: "nutrition" }).ok, true);

// A REASON IS REQUIRED, and whitespace is not a reason.
assert.equal(adjust({ reason: "" }).ok, false);
assert.equal(adjust({ reason: "   " }).ok, false);
assert.match(adjust({ reason: "" }).message, /why this is changing/i);
assert.equal(adjust({ reason: "x".repeat(501) }).ok, false, "reason is bounded");
assert.equal(adjust({ summary: "x".repeat(501) }).ok, false, "summary is bounded");
// Summary is optional.
assert.equal(adjust({ summary: "" }).ok, true);

// THE REVISION DATE MUST EQUAL THE PRESCRIPTION'S scheduledDateKey.
// Two documents describing different days is a record that lies about itself,
// and nothing downstream could detect it afterwards.
assert.equal(adjust({}, addDaysToDateKey(clientToday, 2)).ok, false);
assert.equal(adjust({}, null).ok, false, "an unscheduled prescription cannot be an adjustment");
assert.match(adjust({}, null).message, /must match the day being adjusted/i);

// PROGRAM CANNOT BE SUBMITTED, with the exact copy the screen shows.
const programAttempt = adjust({ kind: "program" });
assert.equal(programAttempt.ok, false);
assert.match(programAttempt.message, /Program changes require assigning a new program/);
assert.match(programAttempt.message, /not rewritten/);
// Nor any other unexpected kind arriving through an untyped route param.
assert.equal(adjust({ kind: "" }).ok, false);
assert.equal(adjust({ kind: "diet" }).ok, false);

// Missing trainee id.
assert.equal(adjust({ traineeId: "" }).ok, false);
// The date rules still apply through the combined validator.
assert.equal(adjust({ effectiveFromDateKey: clientToday }, clientToday).ok, false);
assert.equal(adjust({ traineeTimezone: null }).ok, false);

// ---- DETERMINISTIC WINNER, AND NO FABRICATED planVersion ------------------
//
// Adjustments append rather than edit, so a day legitimately ends up with more
// than one dated prescription. The newest must win, on every device.
const DAY = "2026-09-01";
const datedCandidate = (id, publishedAtMillis, planVersion) => ({
  id,
  scheduledDateKey: DAY,
  status: "published",
  ...(planVersion === undefined ? {} : { planVersion }),
  publishedAtMillis,
  payload: { id },
});

// Later publishedAt wins when no version is present anywhere — which is the
// real state of the data, since `planVersion` is not written.
const byPublished = resolvePlanDimension({
  dateKey: DAY,
  dailyCandidates: [datedCandidate("original", 1000), datedCandidate("replacement", 5000)],
});
assert.equal(byPublished.sourceType, "daily");
assert.equal(byPublished.sourceId, "replacement");

// Order of the input array must not change the answer.
const reversedOrder = resolvePlanDimension({
  dateKey: DAY,
  dailyCandidates: [datedCandidate("replacement", 5000), datedCandidate("original", 1000)],
});
assert.equal(reversedOrder.sourceId, "replacement");
assert.equal(reversedOrder.sourceId, byPublished.sourceId);

// Identical timestamps still produce exactly one winner, by document id.
const tiedByDocId = resolvePlanDimension({
  dateKey: DAY,
  dailyCandidates: [datedCandidate("aaa", 5000), datedCandidate("zzz", 5000)],
});
assert.equal(tiedByDocId.sourceType, "daily");
assert.equal(tiedByDocId.sourceId, "zzz");
assert.equal(
  resolvePlanDimension({ dateKey: DAY, dailyCandidates: [datedCandidate("zzz", 5000), datedCandidate("aaa", 5000)] }).sourceId,
  "zzz",
  "the tie-break must not depend on query order"
);

// Missing publishedAt on legacy documents does not break resolution.
const legacyMix = resolvePlanDimension({
  dateKey: DAY,
  dailyCandidates: [datedCandidate("legacy", null), datedCandidate("adjusted", 9000)],
});
assert.equal(legacyMix.sourceId, "adjusted");

// A prescription for a DIFFERENT day is never the winner — this is what keeps
// an adjustment confined to the one day it names.
assert.equal(isDatedCandidateFor(datedCandidate("other", 9000), "2026-09-02"), false);
assert.equal(
  resolvePlanDimension({ dateKey: "2026-09-02", dailyCandidates: [datedCandidate("adjusted", 9000)] }).sourceType,
  "none",
  "an adjustment must not leak onto later days"
);

// Draft prescriptions are withheld regardless of how new they are.
assert.equal(
  resolvePlanDimension({
    dateKey: DAY,
    dailyCandidates: [datedCandidate("published", 1000), { ...datedCandidate("draft", 9000), status: "draft" }],
  }).sourceId,
  "published"
);

// ---------------------------------------------------------------------------
// TRAINEE TODAY STATE
//
// The screen used to answer "what is today?" implicitly, by rendering nine
// cards and letting the trainee work it out. One value, one answer.
// ---------------------------------------------------------------------------

const todayBase = {
  planStatus: "loaded",
  loggedSessionCount: 0,
  plannedWorkout: null,
  hasProgramCoveringToday: false,
};
const todayIs = (overrides) => deriveTodayState({ ...todayBase, ...overrides });
const plannedWorkoutOf = (sourceType, title = "Upper Push A", exerciseCount = 6, isCompleted = false) => ({
  title, exerciseCount, sourceType, isCompleted,
});

// FAILURE OUTRANKS EVERYTHING. A failed plan read must never render as a blank
// start — that is the same client-day confusion Phase 3 removed, on the other
// side of the relationship.
assert.deepEqual(todayIs({ planStatus: "error" }), { kind: "unavailable" });
assert.deepEqual(
  todayIs({ planStatus: "error", plannedWorkout: plannedWorkoutOf("daily") }),
  { kind: "unavailable" },
  "a stale plan must not be shown as today's plan when the read failed"
);
assert.deepEqual(todayIs({ planStatus: "loading" }), { kind: "loading" });

// An open plan stays actionable after another session was logged.
assert.deepEqual(
  todayIs({ loggedSessionCount: 1, plannedWorkout: plannedWorkoutOf("daily") }),
  { kind: "session_planned", title: "Upper Push A", exerciseCount: 6, loggedSessions: 1, fromCoach: true }
);
assert.deepEqual(
  todayIs({ plannedWorkout: plannedWorkoutOf("daily", "Upper Push A", 6, true) }),
  { kind: "session_logged", sessions: 1 }
);
// Two sessions in a day is legitimate and the count survives.
assert.deepEqual(todayIs({ loggedSessionCount: 2 }), { kind: "session_logged", sessions: 2 });

// PLANNED, and the source decides whether the copy names the coach.
assert.deepEqual(todayIs({ plannedWorkout: plannedWorkoutOf("daily") }), {
  kind: "session_planned", title: "Upper Push A", exerciseCount: 6, loggedSessions: 0, fromCoach: true,
});
assert.deepEqual(todayIs({ plannedWorkout: plannedWorkoutOf("program") }), {
  kind: "session_planned", title: "Upper Push A", exerciseCount: 6, loggedSessions: 0, fromCoach: false,
});
// An unknown exercise count is carried as null, never as 0.
assert.equal(todayIs({ plannedWorkout: plannedWorkoutOf("daily", "Push", null) }).exerciseCount, null);
// `sourceType: "none"` is not a plan.
assert.deepEqual(todayIs({ plannedWorkout: plannedWorkoutOf("none") }), { kind: "no_plan" });

// REST DAY vs NO PLAN — the distinction the resolver cannot make on its own,
// because it returns "none" for both. A trainee shown "nothing planned" on a
// programmed rest day reads it as the app having lost their plan.
assert.deepEqual(todayIs({ hasProgramCoveringToday: true }), { kind: "rest_day" });
assert.deepEqual(todayIs({ hasProgramCoveringToday: false }), { kind: "no_plan" });
// A rest day with a session logged on it is still a logged session — there is
// no open prescription to outrank it.
assert.deepEqual(
  todayIs({ hasProgramCoveringToday: true, loggedSessionCount: 1 }),
  { kind: "session_logged", sessions: 1 }
);
// Two sessions on a day with no open prescription keep their count.
assert.deepEqual(todayIs({ loggedSessionCount: 2 }), { kind: "session_logged", sessions: 2 });
// A program covering today does not override an explicit daily prescription.
assert.equal(
  todayIs({ hasProgramCoveringToday: true, plannedWorkout: plannedWorkoutOf("daily") }).kind,
  "session_planned"
);

// ONE ACCENT SURFACE, and only where there is a next action to take.
assert.equal(stateHasPrimaryAction(todayIs({ plannedWorkout: plannedWorkoutOf("daily") })), true);
assert.equal(stateHasPrimaryAction(todayIs({})), true, "no plan still offers logging one");
assert.equal(stateHasPrimaryAction(todayIs({ loggedSessionCount: 1 })), false);
assert.equal(stateHasPrimaryAction(todayIs({ hasProgramCoveringToday: true })), false);
assert.equal(stateHasPrimaryAction(todayIs({ planStatus: "error" })), false);
assert.equal(stateHasPrimaryAction(todayIs({ planStatus: "loading" })), false);

// ---------------------------------------------------------------------------
// RPE CAPTURE
//
// `rpe` has been on `WorkoutSet` since the type was written and NOTHING ever
// wrote it — no field on the set row, and no way for a coach to prescribe one.
// It is the value that later tells a coach the load was wrong, so the whole
// "RPE against what you asked" half of the coach's session review had no data.
// ---------------------------------------------------------------------------

// The scale, and only the scale.
[1, 2, 5, 8, 9, 10].forEach((n) => {
  assert.deepEqual(parseRpeInput(String(n)), { ok: true, rpe: String(n) }, `RPE ${n}`);
});
// Whitespace is tolerated; the stored value is normalised.
assert.deepEqual(parseRpeInput("  8  "), { ok: true, rpe: "8" });
assert.deepEqual(parseRpeInput("08"), { ok: true, rpe: "8" }, "leading zero normalises");

// CLEARING stores nothing. Firestore runs with `ignoreUndefinedProperties`, so
// an unrated set carries no `rpe` field and reads back as genuinely absent —
// not as a zero, which would be a rating nobody gave.
assert.deepEqual(parseRpeInput(""), { ok: true, rpe: undefined });
assert.deepEqual(parseRpeInput("   "), { ok: true, rpe: undefined });

// OFF-SCALE INPUT IS REFUSED rather than clamped. Clamping 11 to 10 would
// store a rating the trainee did not give.
["0", "11", "99", "-1", "-5"].forEach((bad) => {
  assert.deepEqual(parseRpeInput(bad), { ok: false }, `${bad} is not an RPE`);
});
// Non-numeric, decimals and junk are refused, never coerced.
["abc", "8.5", "8,5", "1e1", "NaN", "Infinity", "٨"].forEach((bad) => {
  assert.deepEqual(parseRpeInput(bad), { ok: false }, `${bad} must not be stored`);
});
// A refusal never yields a value, so the row can safely ignore the keystroke.
assert.equal("rpe" in parseRpeInput("11"), false);

// Duplicating a set resets subjective effort; the new set has not happened yet.
const dupWithRpe = duplicateSetForNextEntry(
  { type: "weighted", reps: 8, weight: 60, rpe: "7", isCompleted: true },
  "weighted"
);
assert.equal(dupWithRpe.rpe, undefined);
assert.equal(dupWithRpe.isCompleted, false);
// An unrated set duplicates to an unrated set.
assert.equal(
  duplicateSetForNextEntry({ type: "weighted", reps: 8, weight: 60, isCompleted: true }, "weighted").rpe,
  undefined
);

// RPE SURVIVES THE SAVE PATH. `getCompletedWorkoutExercises` filters sets but
// must not strip fields — if it did, the column would look like it worked while
// writing nothing.
const withRpe = getCompletedWorkoutExercises([
  {
    name: "Incline DB press",
    type: "weighted",
    sets: [
      { type: "weighted", reps: 10, weight: 26, rpe: "7", isCompleted: true },
      { type: "weighted", reps: 10, weight: 28, isCompleted: true },
      { type: "weighted", reps: 8, weight: 28, rpe: "9", isCompleted: false },
    ],
  },
]);
assert.equal(withRpe.length, 1);
assert.equal(withRpe[0].sets.length, 2, "incomplete sets are still excluded");
assert.equal(withRpe[0].sets[0].rpe, "7", "a rating must reach the write");
assert.equal(withRpe[0].sets[1].rpe, undefined, "an unrated set stays unrated");

// ---------------------------------------------------------------------------
// THE FORTNIGHT STRIP
//
// Fourteen facts, and no score. The design is explicit that nothing is derived
// from these cells: a percentage averages away the one thing a strip is for —
// three misses in a row, or every Saturday blank.
// ---------------------------------------------------------------------------

const FN_TODAY = "2026-08-14";           // a Friday
const emptySet = new Set();
const fortnightOf = (overrides = {}) => buildFortnight({
  clientTodayDateKey: FN_TODAY,
  loggedDateKeys: emptySet,
  plannedDateKeys: emptySet,
  programDateKeys: emptySet,
  ...overrides,
});
const stateOn = (days, dateKey) => days.find((d) => d.dateKey === dateKey)?.state;

// Fourteen cells, oldest first, ending on the client's today.
const plainFortnight = fortnightOf();
assert.equal(plainFortnight.length, 14);
assert.equal(plainFortnight[0].dateKey, "2026-08-01");
assert.equal(plainFortnight[13].dateKey, FN_TODAY);
// Strictly ascending, no gaps and no repeats.
plainFortnight.forEach((day, i) => {
  if (i > 0) assert.equal(daysBetweenDateKeys(plainFortnight[i - 1].dateKey, day.dateKey), 1);
});

// NO CLIENT CALENDAR, NO STRIP. Fourteen cells against the coach's calendar
// would be fourteen wrong facts, so it refuses rather than falling back.
assert.deepEqual(buildFortnight({
  clientTodayDateKey: "", loggedDateKeys: emptySet, plannedDateKeys: emptySet, programDateKeys: emptySet,
}), []);
assert.deepEqual(buildFortnight({
  clientTodayDateKey: "2026-02-30", loggedDateKeys: emptySet, plannedDateKeys: emptySet, programDateKeys: emptySet,
}), []);

// A LOGGED SESSION OUTRANKS EVERYTHING — it is the only state backed by a
// document the client actually wrote.
const logged = fortnightOf({
  loggedDateKeys: new Set(["2026-08-10"]),
  plannedDateKeys: new Set(["2026-08-10"]),
  programDateKeys: new Set(["2026-08-10"]),
});
assert.equal(stateOn(logged, "2026-08-10"), "logged");

// PLANNED AND NOT LOGGED, on a day that has closed.
assert.equal(stateOn(fortnightOf({ plannedDateKeys: new Set(["2026-08-10"]) }), "2026-08-10"), "planned_not_logged");
// REST: a program covered the day and placed nothing on it.
assert.equal(stateOn(fortnightOf({ programDateKeys: new Set(["2026-08-10"]) }), "2026-08-10"), "rest");
// NO PLAN: nothing was ever asked. Not a miss.
assert.equal(stateOn(fortnightOf(), "2026-08-10"), "no_plan");

// TODAY IS NOT A MISS. The client's day has not closed — they may train
// tonight. Calling it missed is the same premature judgement the review status
// refuses to make.
assert.equal(stateOn(fortnightOf({ plannedDateKeys: new Set([FN_TODAY]) }), FN_TODAY), "planned_not_logged");
assert.equal(stateOn(fortnightOf({ loggedDateKeys: new Set([FN_TODAY]) }), FN_TODAY), "logged");
assert.equal(stateOn(fortnightOf({ programDateKeys: new Set([FN_TODAY]) }), FN_TODAY), "rest");

// A FAILED READ IS NOT AN EMPTY DAY.
const withUnknown = fortnightOf({
  plannedDateKeys: new Set(["2026-08-05"]),
  unreadableDateKeys: new Set(["2026-08-05"]),
});
assert.equal(stateOn(withUnknown, "2026-08-05"), "unknown", "a failed read must not read as a miss");

// FUTURE never appears in a window ending today, but the rule holds if the
// window is widened.
const wide = buildFortnight({
  clientTodayDateKey: FN_TODAY, days: 14,
  loggedDateKeys: emptySet, plannedDateKeys: emptySet, programDateKeys: emptySet,
});
assert.equal(wide.some((d) => d.state === "future"), false);

// COUNTS ARE TALLIES, NOT A RATIO. Nothing here divides.
const counted = countFortnightStates(fortnightOf({
  loggedDateKeys: new Set(["2026-08-10", "2026-08-12"]),
  plannedDateKeys: new Set(["2026-08-11"]),
}));
assert.equal(counted.logged, 2);
assert.equal(counted.planned_not_logged, 1);
assert.equal(counted.no_plan, 11);
// Every cell is accounted for exactly once.
assert.equal(Object.values(counted).reduce((a, b) => a + b, 0), 14);

// A custom window size is honoured, and month boundaries are crossed correctly.
const shortWindow = buildFortnight({
  clientTodayDateKey: "2026-03-02", days: 4,
  loggedDateKeys: emptySet, plannedDateKeys: emptySet, programDateKeys: emptySet,
});
assert.deepEqual(shortWindow.map((d) => d.dateKey), ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
// ...including a leap day.
assert.deepEqual(
  buildFortnight({ clientTodayDateKey: "2028-03-01", days: 3, loggedDateKeys: emptySet, plannedDateKeys: emptySet, programDateKeys: emptySet })
    .map((d) => d.dateKey),
  ["2028-02-28", "2028-02-29", "2028-03-01"]
);

// ---------------------------------------------------------------------------
// SESSION REVIEW — PLANNED AGAINST PERFORMED
//
// The coach's question is not "what did they lift" but "did this go the way I
// planned, and if not, where". That is a comparison, and it only means anything
// when both halves keep their gaps.
// ---------------------------------------------------------------------------

const doneSet = (weight, reps, rpe) => ({ type: "weighted", weight, reps, rpe, isCompleted: true });

const review = buildSessionReview(
  [
    { name: "Incline DB press", sets: [doneSet(26, 10, "7"), doneSet(28, 10, "8"), doneSet(28, 8)] },
    { name: "Cable fly", sets: [doneSet(15, 12, "9")] },
  ],
  [
    { name: "incline db press", targetSets: 3, targetReps: "8-10" },
    { name: "Overhead press", targetSets: 4, targetReps: "6" },
  ]
);

// Matching is case- and whitespace-insensitive: a coach typing "incline db
// press" and a trainee picking "Incline DB press" are the same exercise.
assert.equal(review.rows[0].plannedSets, 3);
assert.equal(review.rows[0].plannedReps, "8-10");
assert.equal(review.rows[0].completedSets, 3);
assert.equal(review.rows[0].topWeight, 28);

// AVERAGE RPE COUNTS ONLY RATED SETS, and says how many were rated so the
// figure can be read in context. Two of three rated: (7+8)/2 = 7.5.
assert.equal(review.rows[0].averageRpe, 7.5);
assert.equal(review.rows[0].ratedSets, 2);

// An exercise nobody planned is named, not faulted — often it is a good sign.
assert.deepEqual(review.unplanned, ["Cable fly"]);
assert.equal(review.rows[1].plannedSets, null, "no plan means null, never 0");
assert.equal(review.rows[1].plannedReps, null);

// A planned exercise with no log is NAMED. "One exercise missed" tells a coach
// nothing; "Overhead press" tells them what to ask about.
assert.deepEqual(review.notDone, ["Overhead press"]);

// Session totals.
assert.equal(review.totalCompletedSets, 4);
assert.equal(review.totalPlannedSets, 7, "3 + 4 asked");
assert.equal(review.averageRpe, 8, "(7+8+9)/3 across the whole session");
assert.equal(review.ratedSets, 3);

// ---- ABSENCE IS NOT ZERO --------------------------------------------------
const unrated = buildSessionReview(
  [{ name: "Squat", sets: [doneSet(100, 5), doneSet(100, 5)] }],
  [{ name: "Squat", targetSets: 2, targetReps: "5" }]
);
assert.equal(unrated.rows[0].averageRpe, null, "an unrated session is null, never 0");
assert.equal(unrated.rows[0].ratedSets, 0);
assert.equal(unrated.averageRpe, null);

// Nothing planned at all: totals stay null rather than becoming "18 of 0".
const noPlan = buildSessionReview([{ name: "Row", sets: [doneSet(60, 10, "6")] }]);
assert.equal(noPlan.totalPlannedSets, null);
assert.deepEqual(noPlan.notDone, []);
assert.deepEqual(noPlan.unplanned, ["Row"]);

// ---- ONLY COMPLETED SETS COUNT -------------------------------------------
// A row typed into and never ticked is not work performed. Counting it would
// overstate the session to the one person using this to plan the next one.
const partial = buildSessionReview(
  [{
    name: "Bench",
    sets: [
      doneSet(80, 5, "8"),
      { type: "weighted", weight: 80, reps: 5, rpe: "10", isCompleted: false },
    ],
  }],
  [{ name: "Bench", targetSets: 2, targetReps: "5" }]
);
assert.equal(partial.rows[0].completedSets, 1);
assert.equal(partial.rows[0].averageRpe, 8, "the abandoned set's RPE must not count");
assert.equal(partial.totalCompletedSets, 1);

// ---- HOSTILE INPUT --------------------------------------------------------
const hostile = buildSessionReview(
  [{
    name: "Deadlift",
    sets: [
      { type: "weighted", weight: 140, reps: 3, rpe: "11", isCompleted: true },   // off-scale
      { type: "weighted", weight: 140, reps: 3, rpe: "abc", isCompleted: true },  // junk
      { type: "weighted", weight: 140, reps: 3, rpe: "9", isCompleted: true },
    ],
  }],
  []
);
assert.equal(hostile.rows[0].averageRpe, 9, "off-scale and junk ratings are ignored, not coerced");
assert.equal(hostile.rows[0].ratedSets, 1);
assert.equal(Number.isFinite(hostile.rows[0].averageRpe), true);

// Bodyweight and timed work have no top weight — null, not 0.
const bodyweight = buildSessionReview(
  [{ name: "Pull-up", sets: [{ type: "bodyweight", reps: 8, isCompleted: true }] }],
  []
);
assert.equal(bodyweight.rows[0].topWeight, null);

// Empty and malformed input never throws.
assert.deepEqual(buildSessionReview([], []).rows, []);
assert.deepEqual(buildSessionReview([]).notDone, []);
assert.equal(buildSessionReview([{ name: "X", sets: [] }], []).rows[0].completedSets, 0);

// ===========================================================================
// MULTI-WEEK PROGRAMS
// ===========================================================================

// ---- Level is a label, never a generator ---------------------------------
assert.deepEqual(PROGRAM_LEVELS.map((l) => l.value), ["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
assert.deepEqual(PROGRAM_LEVELS.map((l) => l.label), ["Beginner", "Intermediate", "Advanced"]);
// `EXPERT` sat in the type while the picker offered three options — a value no
// coach could choose and no screen could render. It is gone, not exposed.
assert.equal(PROGRAM_LEVELS.some((l) => l.value === "EXPERT"), false);
assert.equal(programLevelLabel("BEGINNER"), "Beginner");
assert.equal(programLevelLabel("EXPERT"), "Level not set", "a legacy EXPERT reads honestly, not as a rung");
assert.equal(programLevelLabel(undefined), "Level not set");
assert.equal(programLevelLabel(null), "Level not set");

// ---- startDateKey + dayOffset, across every boundary ----------------------
assert.equal(sessionDateKey("2026-08-16", 0), "2026-08-16");
assert.equal(sessionDateKey("2026-08-16", 2), "2026-08-18");
assert.equal(sessionDateKey("2026-08-16", 4), "2026-08-20");
// Month, year and leap boundaries.
assert.equal(sessionDateKey("2026-08-30", 2), "2026-09-01");
assert.equal(sessionDateKey("2026-12-30", 3), "2027-01-02");
assert.equal(sessionDateKey("2028-02-27", 2), "2028-02-29", "leap day is reachable");
assert.equal(sessionDateKey("2028-02-28", 2), "2028-03-01");
assert.equal(sessionDateKey("2027-02-27", 2), "2027-03-01", "non-leap year skips the 29th");
// Unplaceable input yields null rather than an invented date.
assert.equal(sessionDateKey(null, 0), null);
assert.equal(sessionDateKey("", 3), null);
assert.equal(sessionDateKey("2026-02-30", 1), null);
assert.equal(sessionDateKey("2026-08-16", null), null);
assert.equal(sessionDateKey("2026-08-16", -1), null, "a negative offset is not a day");
assert.equal(sessionDateKey("2026-08-16", 1.5), null);

// The human label a coach reads instead of a bare integer.
assert.equal(sessionDateLabel("2026-08-16", 0), "Sunday, 16 August");
assert.equal(sessionDateLabel("2026-08-16", 2), "Tuesday, 18 August");
assert.equal(sessionDateLabel("2026-08-16", 4), "Thursday, 20 August");
assert.equal(sessionDateLabel(null, 0), null);

// CLIENT TIMEZONE INDEPENDENCE: the reader's device must not shift the weekday.
const programTz = process.env.TZ;
try {
  const results = [];
  for (const zone of ["Africa/Tunis", "Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
    process.env.TZ = zone;
    results.push([sessionDateKey("2026-08-16", 2), sessionDateLabel("2026-08-16", 2)]);
  }
  results.forEach((r) => assert.deepEqual(r, ["2026-08-18", "Tuesday, 18 August"]));
} finally {
  if (programTz === undefined) delete process.env.TZ; else process.env.TZ = programTz;
}

// ---- Offsets stay inside the program -------------------------------------
assert.equal(isOffsetInProgram(0, 4), true);
assert.equal(isOffsetInProgram(27, 4), true, "last day of a 4-week program");
assert.equal(isOffsetInProgram(28, 4), false, "one past the end");
assert.equal(isOffsetInProgram(-1, 4), false);
assert.equal(isOffsetInProgram(1.5, 4), false);

// ---- Scaffold -------------------------------------------------------------
const scaffold = generateScaffold(3, 3);
assert.equal(scaffold.length, 3);
assert.equal(scaffold[0].sessions.length, 3);
assert.deepEqual(scaffold[0].sessions.map((s) => s.dayOffset), [0, 2, 4]);
assert.deepEqual(scaffold[1].sessions.map((s) => s.dayOffset), [7, 9, 11]);
// EVERY id is unique across the whole program. The old scaffold rebuilt ids
// from position (`w1-s1`), so duplicating a week produced two sessions with the
// same identity — and completion, which matches on session id, credited both.
const scaffoldIds = scaffold.flatMap((w) => [w.id, ...w.sessions.map((s) => s.id)]);
assert.equal(new Set(scaffoldIds).size, scaffoldIds.length, "ids must be unique");
// Every generated offset is inside the program.
scaffold.flatMap((w) => w.sessions).forEach((s) => {
  assert.equal(isOffsetInProgram(s.dayOffset, 3), true);
});
// Out-of-range requests produce nothing rather than a broken program.
assert.deepEqual(generateScaffold(0, 3), []);
assert.deepEqual(generateScaffold(17, 3), []);
assert.deepEqual(generateScaffold(4, 0), []);
assert.deepEqual(generateScaffold(4, 8), []);

// Regeneration must not silently destroy edits.
assert.equal(scaffoldHasEdits(scaffold), false, "a fresh scaffold has no edits");
const editedScaffold = generateScaffold(2, 2);
editedScaffold[0].sessions[0].exercises = [{ name: "Bench" }];
assert.equal(scaffoldHasEdits(editedScaffold), true, "an added exercise counts as an edit");
const renamed = generateScaffold(2, 2);
renamed[1].sessions[1].title = "Lower body";
assert.equal(scaffoldHasEdits(renamed), true, "a renamed session counts as an edit");

// ---- Week duplication -----------------------------------------------------
const sourceWeek = { id: "w1", weekNumber: 1, title: "Week 1", sessions: scaffold[0].sessions };
const copied = duplicateWeek(sourceWeek, 3);
assert.equal(copied.weekNumber, 3);
assert.deepEqual(copied.sessions.map((s) => s.dayOffset), [14, 16, 18], "offsets shift by whole weeks");
// Fresh ids, or two sessions share an identity and completion cannot tell them apart.
copied.sessions.forEach((session, i) => {
  assert.notEqual(session.id, sourceWeek.sessions[i].id);
});
assert.notEqual(copied.id, sourceWeek.id);
assert.equal(new Set(copied.sessions.map((s) => s.id)).size, copied.sessions.length);

// ---- Adding a session picks a free day -----------------------------------
assert.equal(firstFreeOffset([0, 2, 4], 1), 1);
assert.equal(firstFreeOffset([0, 1, 2, 3, 4, 5, 6], 1), null, "a full week offers nothing");
assert.equal(firstFreeOffset([], 2), 0);
assert.equal(firstFreeOffset([0, 1], 1), 2);

// ---- Set validation, per type --------------------------------------------
assert.equal(validateSuggestedSet({ type: "WEIGHT_REPS", targetReps: 8, targetWeight: 60 }), null);
assert.match(validateSuggestedSet({ type: "WEIGHT_REPS", targetReps: 8 }), /target weight/);
assert.match(validateSuggestedSet({ type: "WEIGHT_REPS", targetWeight: 60 }), /target reps/);
assert.equal(validateSuggestedSet({ type: "TIME", targetDurationSec: 45 }), null);
assert.match(validateSuggestedSet({ type: "TIME" }), /duration/);
assert.equal(validateSuggestedSet({ type: "BODYWEIGHT", targetReps: 12 }), null);
assert.equal(validateSuggestedSet({ type: "REPS_ONLY", targetReps: 12 }), null);
assert.match(validateSuggestedSet({ type: "NONSENSE", targetReps: 5 }), /unknown set type/);
// No NaN, zero or negative values pass.
[0, -5, Number.NaN, Number.POSITIVE_INFINITY].forEach((bad) => {
  assert.notEqual(validateSuggestedSet({ type: "WEIGHT_REPS", targetReps: bad, targetWeight: 60 }), null, `reps ${bad}`);
  assert.notEqual(validateSuggestedSet({ type: "TIME", targetDurationSec: bad }), null, `duration ${bad}`);
});

// ---- Whole-program validation --------------------------------------------
const goodSet = { type: "WEIGHT_REPS", targetReps: 8, targetWeight: 60 };
const goodExercise = { name: "Bench press", suggestedSets: [goodSet] };
const validProgram = {
  title: "Hypertrophy block",
  startDateKey: "2026-08-16",
  durationWeeks: 2,
  weeks: [
    { weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 0, estimatedMinutes: 60, exercises: [goodExercise] }] },
    { weekNumber: 2, sessions: [{ title: "Pull", sessionNumber: 1, dayOffset: 7, estimatedMinutes: 60, exercises: [goodExercise] }] },
  ],
};
assert.deepEqual(validateProgram(validProgram), []);

// Missing name, missing/invalid start date, bad duration.
assert.equal(validateProgram({ ...validProgram, title: "  " }).some((i) => /name/.test(i.message)), true);
assert.equal(validateProgram({ ...validProgram, startDateKey: null }).some((i) => /start date/.test(i.message)), true);
assert.equal(validateProgram({ ...validProgram, startDateKey: "2026-02-30" }).some((i) => /start date/.test(i.message)), true);
assert.equal(validateProgram({ ...validProgram, durationWeeks: 0 }).some((i) => /1–16/.test(i.message)), true);
assert.equal(validateProgram({ ...validProgram, durationWeeks: 17 }).some((i) => /1–16/.test(i.message)), true);
assert.equal(validateProgram({ ...validProgram, weeks: [] }).some((i) => /at least one week/.test(i.message)), true);

// TWO SESSIONS ON ONE DAY, across different weeks — the collision a per-week
// check would miss entirely.
const collision = validateProgram({
  ...validProgram,
  weeks: [
    { weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 3, exercises: [goodExercise] }] },
    { weekNumber: 2, sessions: [{ title: "Pull", sessionNumber: 1, dayOffset: 3, exercises: [goodExercise] }] },
  ],
});
assert.equal(collision.length, 1);
assert.match(collision[0].message, /One session per day/);
assert.match(collision[0].where, /Week 2 · Pull/, "the message names the exact session");

// An offset outside the program.
const outOfRange = validateProgram({
  ...validProgram,
  durationWeeks: 1,
  weeks: [{ weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 9, exercises: [goodExercise] }] }],
});
assert.match(outOfRange[0].message, /outside a 1-week program/);

// Empty session, empty exercise, invalid set — each names its location.
const emptySession = validateProgram({
  ...validProgram,
  weeks: [{ weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 0, exercises: [] }] }],
});
assert.match(emptySession[0].where, /Week 1 · Push/);
assert.match(emptySession[0].message, /at least one exercise/);

const emptyExercise = validateProgram({
  ...validProgram,
  weeks: [{ weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 0, exercises: [{ name: "Bench press", suggestedSets: [] }] }] }],
});
assert.match(emptyExercise[0].where, /Bench press/);
assert.match(emptyExercise[0].message, /at least one set/);

const badSet = validateProgram({
  ...validProgram,
  weeks: [{ weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 0, exercises: [{ name: "Bench press", suggestedSets: [{ type: "WEIGHT_REPS", targetReps: 8 }] }] }] }],
});
assert.match(badSet[0].where, /Bench press · Set 1/);

// EVERY issue is returned, not just the first — a coach fixing a twelve-week
// program one save at a time will stop using the feature.
const manyIssues = validateProgram({
  title: "", startDateKey: null, durationWeeks: 2,
  weeks: [{ weekNumber: 1, sessions: [{ title: "Push", sessionNumber: 1, dayOffset: 0, exercises: [] }] }],
});
assert.ok(manyIssues.length >= 3);

// ---- Which program is active when several overlap -------------------------
const progA = { id: "a", startDateKey: "2026-08-01", durationWeeks: 4, status: "published", assignedAtMillis: 1000 };
const progB = { id: "b", startDateKey: "2026-08-10", durationWeeks: 4, status: "published", assignedAtMillis: 5000 };
assert.equal(selectActiveProgram([progA, progB], "2026-08-12").id, "b", "newest assigned wins");
assert.equal(selectActiveProgram([progA, progB], "2026-08-05").id, "a", "only A covers this date");
assert.equal(selectActiveProgram([progA, progB], "2026-07-31"), null, "before both");
assert.equal(selectActiveProgram([progA, progB], "2026-09-20"), null, "after both");
// Order of the input array must not change the answer.
assert.equal(selectActiveProgram([progB, progA], "2026-08-12").id, "b");
// Drafts never win. Unscheduled legacy programs never win.
assert.equal(selectActiveProgram([{ ...progB, status: "draft" }, progA], "2026-08-12").id, "a");
assert.equal(selectActiveProgram([{ id: "legacy", durationWeeks: 4 }], "2026-08-12"), null);
assert.equal(selectActiveProgram([], "2026-08-12"), null);
// Ties break totally, so two devices agree.
const progTieA = { id: "aaa", startDateKey: "2026-08-01", durationWeeks: 4, assignedAtMillis: 100 };
const progTieZ = { id: "zzz", startDateKey: "2026-08-01", durationWeeks: 4, assignedAtMillis: 100 };
assert.equal(selectActiveProgram([progTieA, progTieZ], "2026-08-02").id, "zzz");
assert.equal(selectActiveProgram([progTieZ, progTieA], "2026-08-02").id, "zzz");

// ---- Session -> prefilled workout ----------------------------------------
const prescribed = {
  id: "sess-1",
  title: "Upper Push A",
  exercises: [
    {
      name: "Incline DB press",
      instructions: "Neutral grip if the shoulder complains.",
      restTimeSec: 90,
      suggestedSets: [
        { type: "WEIGHT_REPS", targetReps: 10, targetWeight: 26 },
        { type: "WEIGHT_REPS", targetReps: 8, targetWeight: 28 },
      ],
    },
    { name: "Plank", suggestedSets: [{ type: "TIME", targetDurationSec: 45 }] },
  ],
};
const prefilled = prefillWorkoutFromSession(prescribed, "prog-1", "2026-08-18");
assert.equal(prefilled.name, "Upper Push A");
assert.equal(prefilled.exercises.length, 2);

// INSTRUCTIONS AND REST SURVIVE. Both were silently dropped, so a coach writing
// "neutral grip if the shoulder complains" watched it never reach the client.
assert.equal(prefilled.exercises[0].instructions, "Neutral grip if the shoulder complains.");
assert.equal(prefilled.exercises[0].restTimeSec, 90);

// TARGETS ARE SEPARATE FROM ACTUALS. The old conversion wrote the coach's ask
// into the client's `reps`, so ask and outcome were the same number the moment
// the log saved and nothing downstream could compare them.
assert.equal(prefilled.exercises[0].sets[0].targetReps, 10);
assert.equal(prefilled.exercises[0].sets[0].targetWeight, 26);
assert.equal(prefilled.exercises[0].sets[0].reps, undefined, "the client's own value starts empty");
assert.equal(prefilled.exercises[0].sets[0].weight, undefined);
assert.equal(prefilled.exercises[0].sets[0].isCompleted, false);
assert.equal(prefilled.exercises[1].type, "TIME", "type follows the first prescribed set");
assert.equal(prefilled.exercises[1].sets[0].targetDurationSec, 45);

// Source metadata rides along, so completion can be proven later.
assert.deepEqual(prefilled.source, {
  sourceType: "program",
  sourceProgramId: "prog-1",
  sourceProgramSessionId: "sess-1",
  sourceScheduledDateKey: "2026-08-18",
});

// An exercise with no prescribed sets still gets one row to log into.
const sparse = prefillWorkoutFromSession(
  { id: "s", title: "T", exercises: [{ name: "Row", suggestedSets: [] }] }, "p", "2026-08-18"
);
assert.equal(sparse.exercises[0].sets.length, 1);
assert.equal(sparse.exercises[0].sets[0].type, "WEIGHT_REPS");
// Zero and negative targets are not carried as targets.
const zeroTargets = prefillWorkoutFromSession(
  { id: "s", title: "T", exercises: [{ name: "Row", restTimeSec: 0, suggestedSets: [{ type: "WEIGHT_REPS", targetReps: 0, targetWeight: -5 }] }] },
  "p", "2026-08-18"
);
assert.equal(zeroTargets.exercises[0].sets[0].targetReps, undefined);
assert.equal(zeroTargets.exercises[0].sets[0].targetWeight, undefined);
assert.equal(zeroTargets.exercises[0].restTimeSec, undefined);

// A session with no exercises is never offered as ready.
assert.equal(sessionIsReady({ exercises: [{ name: "x" }] }), true);
assert.equal(sessionIsReady({ exercises: [] }), false);
assert.equal(sessionIsReady(null), false);
assert.equal(sessionIsReady(undefined), false);

// ---- Completion, and what must NOT complete ------------------------------
const programLog = {
  id: "log-1", sourceType: "program", sourceProgramId: "prog-1",
  sourceProgramSessionId: "sess-1", sourceScheduledDateKey: "2026-08-18",
};
assert.equal(isSessionCompleted([programLog], "prog-1", "sess-1", "2026-08-18"), true);

// AN UNRELATED WORKOUT ON THE SAME DAY MUST NOT COMPLETE THE SESSION. A client
// doing their own cardio has not done the prescribed pushing session, and
// crediting it would lie in the one place a coach plans from.
assert.equal(isSessionCompleted([{ id: "log-2" }], "prog-1", "sess-1", "2026-08-18"), false);
assert.equal(isSessionCompleted([{ id: "log-3", sourceType: "daily" }], "prog-1", "sess-1", "2026-08-18"), false);
// Every part of the identity must match.
assert.equal(isSessionCompleted([{ ...programLog, sourceProgramId: "other" }], "prog-1", "sess-1", "2026-08-18"), false);
assert.equal(isSessionCompleted([{ ...programLog, sourceProgramSessionId: "other" }], "prog-1", "sess-1", "2026-08-18"), false);
assert.equal(isSessionCompleted([{ ...programLog, sourceScheduledDateKey: "2026-08-19" }], "prog-1", "sess-1", "2026-08-18"), false,
  "the same session logged on a different date is not that day's completion");
// Missing identity never matches.
assert.equal(isSessionCompleted([programLog], "", "sess-1", "2026-08-18"), false);
assert.equal(isSessionCompleted([], "prog-1", "sess-1", "2026-08-18"), false);

// Repeated submissions: history is kept, but exactly one log is canonical.
const duplicates = [
  { ...programLog, id: "log-b" },
  { ...programLog, id: "log-a" },
];
assert.equal(findSessionCompletions(duplicates, "prog-1", "sess-1", "2026-08-18").length, 2);
assert.equal(canonicalCompletion(duplicates, "prog-1", "sess-1", "2026-08-18").id, "log-a");
assert.equal(canonicalCompletion([...duplicates].reverse(), "prog-1", "sess-1", "2026-08-18").id, "log-a",
  "the canonical log must not depend on query order");
assert.equal(canonicalCompletion([], "prog-1", "sess-1", "2026-08-18"), null);

// ---- Coach readback resolves the plan from the log source ----------------
const reviewPrograms = [{
  id: "prog-1",
  weeks: [{
    sessions: [
      {
        id: "sess-1",
        title: "Upper Push A",
        exercises: [{
          name: "Bench Press",
          restTimeSec: 90,
          suggestedSets: [
            { targetReps: 8 },
            { targetReps: 8 },
            { targetReps: 6 },
          ],
        }],
      },
      {
        id: "sess-2",
        title: "Lower B",
        exercises: [{ name: "Squat", suggestedSets: [{ targetReps: 5 }] }],
      },
    ],
  }],
}, {
  id: "prog-2",
  weeks: [{ sessions: [{
    id: "sess-x",
    title: "Conditioning",
    exercises: [{ name: "Bike", suggestedSets: [{}, {}] }],
  }] }],
}];

const exactReviewPlan = resolveWorkoutReviewPlan(
  programLog,
  reviewPrograms,
  "2026-08-18",
  { programId: "prog-1", sessionId: "sess-1" },
);
assert.equal(exactReviewPlan.sourceStatus, "exact");
assert.equal(exactReviewPlan.sourceLabel, "Upper Push A - Prescribed session");
assert.equal(exactReviewPlan.plannedExercises[0].targetSets, 3,
  "program suggested sets become the review's planned set count");
assert.equal(exactReviewPlan.plannedExercises[0].targetReps, "8 / 8 / 6");
assert.equal(exactReviewPlan.plannedExercises[0].restTime, "90s");

const otherProgramReview = resolveWorkoutReviewPlan(
  {
    ...programLog,
    sourceProgramId: "prog-2",
    sourceProgramSessionId: "sess-x",
  },
  reviewPrograms,
  "2026-08-18",
  { programId: "prog-1", sessionId: "sess-1" },
);
assert.equal(otherProgramReview.sourceStatus, "exact");
assert.equal(otherProgramReview.sourceLabel, "Conditioning - Program session");
assert.equal(otherProgramReview.plannedExercises[0].name, "Bike",
  "another program is compared to its own session, not today's selected plan");

const manualReview = resolveWorkoutReviewPlan(
  { id: "manual" },
  reviewPrograms,
  "2026-08-18",
  { programId: "prog-1", sessionId: "sess-1" },
);
assert.equal(manualReview.sourceStatus, "unlinked");
assert.equal(manualReview.sourceLabel, "Logged session");
assert.deepEqual(manualReview.plannedExercises, [],
  "manual work is actual-only and cannot inherit a program's missed exercises");

for (const unavailableSource of [
  { ...programLog, sourceProgramId: "missing" },
  { ...programLog, sourceProgramSessionId: "missing" },
  { ...programLog, sourceScheduledDateKey: "2026-08-19" },
]) {
  const unavailableReview = resolveWorkoutReviewPlan(
    unavailableSource,
    reviewPrograms,
    "2026-08-18",
    { programId: "prog-1", sessionId: "sess-1" },
  );
  assert.equal(unavailableReview.sourceStatus, "unavailable");
  assert.equal(unavailableReview.sourceLabel, "Program source unavailable");
  assert.deepEqual(unavailableReview.plannedExercises, [],
    "an unresolved source must never borrow another session's plan");
}

// ---------------------------------------------------------------------------
// WORKOUT DRAFT MIGRATION — program identity survives a resume
//
// A client who started a program session, backgrounded the app and resumed came
// back to a workout that had forgotten which session it was, so the log it
// produced could never be matched to the prescription.
// ---------------------------------------------------------------------------

const draftSource = {
  sourceType: "program",
  sourceProgramId: "prog-1",
  sourceProgramSessionId: "sess-1",
  sourceScheduledDateKey: "2026-08-18",
};
const v1Draft = {
  version: 1, userId: "u1", workoutName: "Upper Push A", activePrescriptionId: null,
  exercises: [], startedAt: "2026-08-18T08:00:00.000Z", updatedAt: "2026-08-18T08:10:00.000Z",
};

// LEGACY v1 DRAFTS REMAIN READABLE, with a null source — the honest answer,
// since they never recorded one. Discarding them would lose a client's
// half-finished workout to a schema change they never saw.
const migratedV1 = migrateWorkoutDraft(v1Draft, "u1");
assert.equal(migratedV1.version, ACTIVE_WORKOUT_DRAFT_VERSION);
assert.equal(migratedV1.programSource, null);
assert.equal(migratedV1.workoutName, "Upper Push A", "the rest of the draft survives");

// A v2 draft round-trips its source intact — save then resume.
const v2Draft = { ...v1Draft, version: 2, programSource: draftSource };
const resumed = migrateWorkoutDraft(JSON.parse(JSON.stringify(v2Draft)), "u1");
assert.deepEqual(resumed.programSource, draftSource, "program source survives save/resume");

// A draft explicitly carrying null stays null — that is how a manual workout
// records "not a program session".
assert.equal(migrateWorkoutDraft({ ...v2Draft, programSource: null }, "u1").programSource, null);

// A HALF-POPULATED SOURCE IS NOT TRUSTED. A partial link points at nothing, and
// treating it as real would complete a session that was never performed.
[
  { sourceType: "program" },
  { ...draftSource, sourceProgramId: "" },
  { ...draftSource, sourceProgramSessionId: undefined },
  { ...draftSource, sourceScheduledDateKey: "" },
  { ...draftSource, sourceType: "daily" },
  "not-an-object",
  42,
].forEach((bad) => {
  assert.equal(
    migrateWorkoutDraft({ ...v2Draft, programSource: bad }, "u1").programSource,
    null,
    `malformed source ${JSON.stringify(bad)} must not be trusted`
  );
});

// Another user's draft, a malformed one, or a version from the future is
// rejected outright rather than partially loaded.
assert.equal(migrateWorkoutDraft(v2Draft, "someone-else"), null);
assert.equal(migrateWorkoutDraft({ ...v2Draft, exercises: "nope" }, "u1"), null);
assert.equal(migrateWorkoutDraft({ ...v2Draft, version: 99 }, "u1"), null);
assert.equal(migrateWorkoutDraft({ ...v2Draft, version: undefined }, "u1"), null);
assert.equal(migrateWorkoutDraft(null, "u1"), null);
assert.equal(migrateWorkoutDraft(undefined, "u1"), null);

// ONE PROGRAM SESSION MUST NOT CONTAMINATE THE NEXT WORKOUT.
//
// The state machine the hook implements: a fresh workout, a prescription, a
// discard and a successful submit all set the source back to null. Modelled
// here as the transition the draft records, so the contract is pinned even
// though the effects live in React.
const afterProgramSession = migrateWorkoutDraft({ ...v2Draft, programSource: draftSource }, "u1");
assert.deepEqual(afterProgramSession.programSource, draftSource);
const afterSwitchingAway = migrateWorkoutDraft({ ...v2Draft, programSource: null }, "u1");
assert.equal(afterSwitchingAway.programSource, null,
  "switching to a prescribed or manual workout clears the stale source");
// And a cleared source can never complete the session it used to point at.
assert.equal(
  isSessionCompleted(
    [{ id: "log-x", ...(afterSwitchingAway.programSource ?? {}) }],
    "prog-1", "sess-1", "2026-08-18"
  ),
  false
);

// ---------------------------------------------------------------------------
// THE FIRESTORE DATE PATTERN, CHECKED AGAINST THE CLIENT VALIDATOR
//
// Six rules validated client-local date keys with `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`,
// which accepts `2026-13-01` and `2026-01-99`. The rules suite caught it only
// once it was actually executed. This asserts the replacement pattern here too,
// so the hole cannot reopen without a logic-test failure — the emulator is not
// always available, but this always is.
// ---------------------------------------------------------------------------

const RULES_DATE_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const rulesFile = fs.readFileSync(path.join(__dirname, "..", "..", "..", "firestore.rules"), "utf8");

// The pattern in the rules file must BE the bounded one, everywhere.
assert.equal(
  rulesFile.includes('value.matches("^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")'),
  true,
  "firestore.rules must use the bounded date matcher"
);
assert.equal(
  rulesFile.includes('matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")'),
  false,
  "no unbounded date matcher may remain in firestore.rules"
);

// The values the old pattern wrongly accepted.
["2026-13-01", "2026-00-01", "2026-01-00", "2026-01-32", "2026-99-99"].forEach((bad) => {
  assert.equal(RULES_DATE_PATTERN.test(bad), false, `${bad} must be rejected by the rules pattern`);
  assert.equal(isValidDateKey(bad), false, `${bad} must also be rejected by the client`);
});

// Real dates pass both.
["2026-01-01", "2026-08-18", "2026-12-31", "2028-02-29"].forEach((good) => {
  assert.equal(RULES_DATE_PATTERN.test(good), true, `${good} must pass the rules pattern`);
  assert.equal(isValidDateKey(good), true, `${good} must pass the client validator`);
});

/*
 * The one gap, stated rather than hidden: rules cannot do calendar arithmetic,
 * so 31 February passes the pattern. The client rejects it — `isValidDateKey`
 * parses and round-trips — and every write goes through the client first.
 */
assert.equal(RULES_DATE_PATTERN.test("2026-02-31"), true, "rules cannot catch this");
assert.equal(isValidDateKey("2026-02-31"), false, "the client does");

// ---------------------------------------------------------------------------
// ONBOARDING UNITS
//
// Height is always stored in centimetres and weight in kilograms. These decide
// only how the number is spelled — converting into storage would lose a little
// precision on every toggle, and a profile that drifts a centimetre per visit
// is worse than one that never offered feet.
// ---------------------------------------------------------------------------

assert.deepEqual(cmToFeetInches(178), { feet: 5, inches: 10 });
assert.deepEqual(cmToFeetInches(152.4), { feet: 5, inches: 0 });
assert.deepEqual(cmToFeetInches(183), { feet: 6, inches: 0 });
// The rounding boundary: 12 inches must roll into a foot, never render as 5'12".
assert.equal(cmToFeetInches(182.9).inches < 12, true);
for (let cm = HEIGHT_RANGE_CM.min; cm <= HEIGHT_RANGE_CM.max; cm += 1) {
  const { inches } = cmToFeetInches(cm);
  assert.equal(inches >= 0 && inches <= 11, true, `${cm}cm gave ${inches} inches`);
}

// Spelled for the reader, with no decimal feet — nobody says "5.83 feet".
assert.equal(formatHeight(178, "metric"), "178");
assert.equal(formatHeight(178, "imperial"), `5'10"`);
assert.equal(formatWeight(76, "metric"), "76");
assert.equal(formatWeight(76, "imperial"), "168");
assert.equal(kgToPounds(100), 220);

// Absent or nonsensical input renders as an em dash, never as 0 — a zero here
// would flow into the calorie calculation this screen feeds.
[0, -5, Number.NaN, Number.POSITIVE_INFINITY].forEach((bad) => {
  assert.equal(formatHeight(bad, "metric"), "—", `height ${bad}`);
  assert.equal(formatWeight(bad, "metric"), "—", `weight ${bad}`);
  assert.deepEqual(cmToFeetInches(bad), { feet: 0, inches: 0 });
});

// Bounded. A slider reaching 0 or 400cm produces a calorie budget that is
// arithmetically valid and physically nonsense.
assert.equal(clampHeightCm(50), HEIGHT_RANGE_CM.min);
assert.equal(clampHeightCm(400), HEIGHT_RANGE_CM.max);
assert.equal(clampHeightCm(178.4), 178, "stored as a whole centimetre");
assert.equal(clampWeightKg(0), WEIGHT_RANGE_KG.min);
assert.equal(clampWeightKg(999), WEIGHT_RANGE_KG.max);

// The figure is a proportion, kept in a narrow band so the shortest person is
// not drawn as a third of the frame.
assert.equal(figureScaleForHeight(HEIGHT_RANGE_CM.min), 0.82);
assert.equal(Math.round(figureScaleForHeight(HEIGHT_RANGE_CM.max) * 100) / 100, 1);
assert.equal(figureScaleForHeight(50), 0.82, "out-of-range input is clamped, not extrapolated");
assert.equal(figureWidthForWeight(WEIGHT_RANGE_KG.min), 0.9);
assert.equal(Math.round(figureWidthForWeight(WEIGHT_RANGE_KG.max) * 100) / 100, 1.1);
// Monotonic: taller always draws taller, never smaller.
for (let cm = HEIGHT_RANGE_CM.min; cm < HEIGHT_RANGE_CM.max; cm += 7) {
  assert.equal(figureScaleForHeight(cm + 1) >= figureScaleForHeight(cm), true);
}

console.log("Product logic checks passed.");
