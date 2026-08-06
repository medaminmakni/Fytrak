/**
 * Phase C — day-boundary arithmetic.
 *
 * `reviewAvailableAt` decides when a client's day has ended and their report
 * becomes reviewable. Getting a DST transition or a month rollover wrong here
 * would silently finalise the wrong day for everyone in that zone, so the
 * arithmetic is tested directly rather than only through a deployed function.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const {
  isResolvableTimeZone,
  localMidnightUtc,
  nextDateKey,
  reviewAvailableAtDate,
  DEFAULT_REPORT_TIMEZONE,
} = require(path.join(__dirname, "..", "src", "dateBoundaries.ts"));

// --- local midnight in a zone ---
assert.equal(localMidnightUtc("2026-08-04", "UTC").toISOString(), "2026-08-04T00:00:00.000Z");
// Tunis is UTC+1 year-round: its midnight happens an hour BEFORE UTC midnight.
assert.equal(localMidnightUtc("2026-08-04", "Africa/Tunis").toISOString(), "2026-08-03T23:00:00.000Z");
assert.equal(localMidnightUtc("2026-08-04", "Asia/Tokyo").toISOString(), "2026-08-03T15:00:00.000Z");
assert.equal(localMidnightUtc("2026-08-04", "America/New_York").toISOString(), "2026-08-04T04:00:00.000Z");

// --- DST transition ---
// US clocks go back on 2026-11-01. Midnight that morning is still EDT (-4);
// the following midnight is EST (-5). A fixed offset would get one of these
// wrong and shift a whole day's worth of reports.
assert.equal(localMidnightUtc("2026-11-01", "America/New_York").toISOString(), "2026-11-01T04:00:00.000Z");
assert.equal(localMidnightUtc("2026-11-02", "America/New_York").toISOString(), "2026-11-02T05:00:00.000Z");
// Southern hemisphere runs the opposite phase.
assert.equal(localMidnightUtc("2026-08-04", "Australia/Sydney").toISOString(), "2026-08-03T14:00:00.000Z");

// --- date rollover ---
assert.equal(nextDateKey("2026-08-31"), "2026-09-01");
assert.equal(nextDateKey("2026-12-31"), "2027-01-01");
assert.equal(nextDateKey("2028-02-28"), "2028-02-29", "2028 is a leap year");
assert.equal(nextDateKey("2027-02-28"), "2027-03-01", "2027 is not");

// --- reviewAvailableAt is the END of the given day ---
assert.equal(
  reviewAvailableAtDate("2026-08-03", "UTC").toISOString(),
  "2026-08-04T00:00:00.000Z"
);
// A Tokyo day ends eight hours before a Tunis day.
const tokyoEnd = reviewAvailableAtDate("2026-08-03", "Asia/Tokyo").getTime();
const tunisEnd = reviewAvailableAtDate("2026-08-03", "Africa/Tunis").getTime();
assert.equal((tunisEnd - tokyoEnd) / 3600000, 8);
assert.ok(tokyoEnd < tunisEnd, "the earlier zone must finalise first");

// --- unresolvable zones fall back rather than throwing ---
assert.equal(isResolvableTimeZone("Africa/Tunis"), true);
assert.equal(isResolvableTimeZone("Not/AZone"), false);
assert.equal(isResolvableTimeZone(null), false);
assert.equal(isResolvableTimeZone(undefined), false);
assert.equal(
  localMidnightUtc("2026-08-04", "Not/AZone").toISOString(),
  localMidnightUtc("2026-08-04", DEFAULT_REPORT_TIMEZONE).toISOString(),
  "an unknown zone must fall back to the documented default, not crash the trigger"
);

console.log("Daily report logic checks passed.");
