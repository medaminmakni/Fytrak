const fs = require("node:fs");
const path = require("node:path");

const rules = fs.readFileSync(path.resolve(__dirname, "../../../firestore.rules"), "utf8");
const assignmentService = fs.readFileSync(
  path.resolve(__dirname, "../../mobile/src/services/assignmentService.ts"),
  "utf8"
);
const indexes = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../firestore.indexes.json"), "utf8"));

const requiredSnippets = [
  "match /coachRequests/{requestId}",
  "ownerCanOpenCoachRequest(userId)",
  "coachCanResolveUserRequest(userId)",
  "match /assignments/{assignmentId}",
  "request.resource.data.sourceRequestId == request.resource.data.traineeId + \"_\" + request.resource.data.coachId",
  "match /chatThreads/{threadId}",
  "participantCanRecordThreadMessage()",
  "participantCanMarkThreadRead()",
  "match /dailyReports/{clientDateKey}",
  "assignedCoachCanReviewDailyActivity(userId)",
  "match /auditEvents/{eventId}",
  "match /summaries/{docId}",
];

const missing = requiredSnippets.filter((snippet) => !rules.includes(snippet));

if (missing.length > 0) {
  console.error("Firestore rules contract check failed. Missing snippets:");
  missing.forEach((snippet) => console.error(`- ${snippet}`));
  process.exit(1);
}

const chatIndex = indexes.indexes.find((index) =>
  index.collectionGroup === "chatThreads"
  && index.fields.some((field) => field.fieldPath === "participants" && field.arrayConfig === "CONTAINS")
  && index.fields.some((field) => field.fieldPath === "status" && field.order === "ASCENDING")
  && index.fields.some((field) => field.fieldPath === "lastMessageAt" && field.order === "DESCENDING")
);

if (!chatIndex) {
  console.error("Firestore contract check failed: active coach inbox composite index is missing.");
  process.exit(1);
}

const mobileV0Snippets = [
  "const batch = writeBatch(db)",
  "batch.set(assignmentRef",
  "batch.set(threadRef",
  "await batch.commit()",
];
const missingMobileSnippets = mobileV0Snippets.filter((snippet) => !assignmentService.includes(snippet));
if (missingMobileSnippets.length > 0) {
  console.error("V0 assignment contract check failed. Missing atomic client-write guards:");
  missingMobileSnippets.forEach((snippet) => console.error(`- ${snippet}`));
  process.exit(1);
}

if (assignmentService.includes("backendFunctionsService") || assignmentService.includes("httpsCallable")) {
  console.error("V0 assignment contract check failed: mobile still depends on Cloud Functions.");
  process.exit(1);
}

console.log("Firestore rules, indexes, and no-functions V0 contract check passed.");
