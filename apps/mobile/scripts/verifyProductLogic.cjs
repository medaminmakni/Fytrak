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
const { scoreCoachClient, buildCoachDashboardIntelligence } = require(path.join(src, "features", "coaching", "coachIntelligence.ts"));
const {
  detectWorkoutPersonalRecords,
  duplicateSetForNextEntry,
  getBestEstimatedOneRepMaxForExercise,
  getLatestExercisePerformance,
} = require(path.join(src, "features", "workouts", "workoutPerformance.ts"));
const { getExerciseVideoLink } = require(path.join(src, "utils", "videoLinks.ts"));
const { calculateAge, calculateNutritionPlan } = require(path.join(src, "utils", "calculators.ts"));

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

const atRiskClient = scoreCoachClient({
  traineeId: "trainee-1",
  traineeName: "Sam",
  assignmentStatus: "assigned",
  workoutsLast7Days: 0,
  mealsLast7Days: 1,
  avgDailyProtein: 65,
  proteinTarget: 140,
  lastWorkoutAt: null,
});

assert.equal(atRiskClient.risk, "high");
assert.ok(atRiskClient.suggestedNudge.length > 10);

const dashboard = buildCoachDashboardIntelligence([atRiskClient]);
assert.equal(dashboard.highRiskCount, 1);
assert.equal(dashboard.insights[0].tone, "warning");

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

console.log("Product logic checks passed.");
