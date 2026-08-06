#!/usr/bin/env node
/**
 * Phase B backfill — assignment lifecycle and assignment-scoped chat.
 *
 * WHY THIS MUST RUN BEFORE THE RULES DEPLOY
 * -----------------------------------------
 * The new coach inbox query filters `status == "active"` on chatThreads, and
 * Firestore EXCLUDES documents that lack a filtered field. A thread without
 * `status` would silently vanish from the coach's inbox. This script writes the
 * field to every thread, so run it first, verify, then deploy rules and client.
 *
 * WHAT IT DOES
 * ------------
 * 1. assignments/*  — adds threadId/status/lifecycle/schemaVersion fields.
 *    An assignment is marked ACTIVE only when the trainee's user document
 *    independently confirms the same coach. Everything else is marked ENDED
 *    with endReason "backfill_unverified". Legacy documents keep their
 *    composite ids; only new assignments get auto-ids.
 * 2. users/*        — sets activeAssignmentId for confirmed active pairs.
 * 3. chatThreads/*  — sets status and links assignmentId where unambiguous.
 *
 * SAFETY
 * ------
 * - Idempotent: re-running converges to the same state.
 * - Fail closed: ambiguous duplicate assignments/threads abort before writes.
 * - Additive only. No document is deleted and no id is changed.
 * - `--dry-run` (default) reports without writing. Pass `--apply` to commit.
 *
 * ROLLBACK
 * --------
 * Delete the added fields. isAssignedCoach() still works off the untouched
 * selectedCoachId/assignmentStatus pair fields, so the app keeps functioning at
 * every point.
 *
 * USAGE
 * Requires Application Default Credentials (for example `gcloud auth
 * application-default login`); Firebase CLI login alone is not an Admin SDK
 * credential.
 *
 *   node scripts/backfillAssignments.cjs --project=fytrak-d754f
 *   node scripts/backfillAssignments.cjs --project=fytrak-d754f --apply
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const projectArg = args.find((a) => a.startsWith("--project="));
const projectId = projectArg ? projectArg.split("=")[1] : process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.error("Missing --project=<id> (or GCLOUD_PROJECT).");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const BATCH_LIMIT = 400;

const pairKey = (traineeId, coachId) => `${traineeId}\u0000${coachId}`;
const legacyThreadId = (traineeId, coachId) => [traineeId, coachId].sort().join("_");

async function commit(writes) {
  if (!APPLY || writes.length === 0) return;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
}

async function run() {
  console.log(`\nProject: ${projectId}`);
  console.log(`Mode:    ${APPLY ? "APPLY (writes)" : "DRY RUN (no writes)"}\n`);

  const [assignmentsSnap, threadsSnap, assignedUsersSnap] = await Promise.all([
    db.collection("assignments").get(),
    db.collection("chatThreads").get(),
    db.collection("users").where("assignmentStatus", "==", "assigned").get(),
  ]);

  // Cache trainee documents once rather than re-reading per assignment.
  const traineeIds = new Set();
  assignmentsSnap.docs.forEach((d) => {
    const t = d.data().traineeId;
    if (t) traineeIds.add(String(t));
  });
  threadsSnap.docs.forEach((d) => {
    const t = d.data().traineeId;
    if (t) traineeIds.add(String(t));
  });
  assignedUsersSnap.docs.forEach((d) => traineeIds.add(d.id));

  const trainees = new Map();
  assignedUsersSnap.docs.forEach((doc) => trainees.set(doc.id, doc.data()));
  const ids = [...traineeIds];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db.collection("users").doc(id));
    const docs = await db.getAll(...refs);
    docs.forEach((doc) => trainees.set(doc.id, doc.exists ? doc.data() : null));
  }

  const writes = [];
  const stats = {
    active: 0,
    unverified: 0,
    alreadyMigrated: 0,
    bootstrappedAssignments: 0,
    bootstrappedThreads: 0,
    threadsActive: 0,
    threadsEnded: 0,
  };
  const assignments = assignmentsSnap.docs.map((doc) => ({ doc, data: doc.data() }));
  const threadsById = new Map(threadsSnap.docs.map((doc) => [doc.id, { doc, data: doc.data() }]));

  // Some MVP data predates both metadata collections: the assigned user pair
  // and chats/{sortedPair}/messages are the only surviving relationship facts.
  // Bootstrap deterministic legacy records so reruns remain idempotent.
  for (const traineeDoc of assignedUsersSnap.docs) {
    const traineeId = traineeDoc.id;
    const trainee = traineeDoc.data();
    const coachId = typeof trainee.selectedCoachId === "string" ? trainee.selectedCoachId : "";
    if (!coachId) throw new Error(`Assigned trainee ${traineeId} has no selectedCoachId`);

    let assignment = assignments.find((entry) =>
      String(entry.data.traineeId || "") === traineeId
      && String(entry.data.coachId || "") === coachId
    );
    if (!assignment) {
      const assignmentId = `${traineeId}_${coachId}`;
      assignment = {
        doc: { id: assignmentId, ref: db.collection("assignments").doc(assignmentId) },
        data: {
          traineeId,
          coachId,
          sourceRequestId: assignmentId,
          createdAt: trainee.updatedAt || null,
        },
      };
      assignments.push(assignment);
      stats.bootstrappedAssignments += 1;
    }

    const expectedThreadId = legacyThreadId(traineeId, coachId);
    if (!threadsById.has(expectedThreadId)) {
      const messagesSnapshot = await db.collection("chats").doc(expectedThreadId)
        .collection("messages").orderBy("createdAt", "desc").get();
      const messages = messagesSnapshot.docs.map((doc) => doc.data());
      const latest = messages[0] || null;
      const oldest = messages[messages.length - 1] || null;
      const unreadByCoach = messages.filter((message) =>
        message.receiverId === coachId && message.status !== "read"
      ).length;
      const unreadByTrainee = messages.filter((message) =>
        message.receiverId === traineeId && message.status !== "read"
      ).length;
      threadsById.set(expectedThreadId, {
        doc: { id: expectedThreadId, ref: db.collection("chatThreads").doc(expectedThreadId) },
        data: {
          threadId: expectedThreadId,
          assignmentId: assignment.doc.id,
          traineeId,
          coachId,
          participants: [traineeId, coachId],
          lastMessageText: latest ? (latest.type === "image" ? "Image" : String(latest.text || "")) : "",
          lastMessageType: latest?.type === "image" ? "image" : "text",
          lastSenderId: typeof latest?.senderId === "string" ? latest.senderId : null,
          lastMessageAt: latest?.createdAt || null,
          unreadByCoach,
          unreadByTrainee,
          createdAt: oldest?.createdAt || trainee.updatedAt || null,
        },
      });
      stats.bootstrappedThreads += 1;
    }
  }

  const assignmentsById = new Map(assignments.map((entry) => [entry.doc.id, entry]));
  const threadsByPair = new Map();

  for (const thread of threadsById.values()) {
    const key = pairKey(String(thread.data.traineeId || ""), String(thread.data.coachId || ""));
    const entries = threadsByPair.get(key) || [];
    entries.push(thread);
    threadsByPair.set(key, entries);
  }

  // The user document is independent evidence of the currently active pair.
  // If more than one assignment matches that pair, only an existing explicit
  // activeAssignmentId may disambiguate it; otherwise the migration aborts.
  const candidatesByTrainee = new Map();
  for (const assignment of assignments) {
    const traineeId = String(assignment.data.traineeId || "");
    const coachId = String(assignment.data.coachId || "");
    const trainee = trainees.get(traineeId);
    const confirmed = Boolean(
      trainee && trainee.selectedCoachId === coachId && trainee.assignmentStatus === "assigned"
    );
    if (!confirmed) continue;
    const entries = candidatesByTrainee.get(traineeId) || [];
    entries.push(assignment);
    candidatesByTrainee.set(traineeId, entries);
  }

  const activeByTrainee = new Map();
  for (const [traineeId, candidates] of candidatesByTrainee) {
    const pointer = trainees.get(traineeId)?.activeAssignmentId;
    const pointed = typeof pointer === "string"
      ? candidates.find((entry) => entry.doc.id === pointer)
      : undefined;
    if (pointed) {
      activeByTrainee.set(traineeId, pointed);
    } else if (candidates.length === 1) {
      activeByTrainee.set(traineeId, candidates[0]);
    } else {
      throw new Error(`Ambiguous active assignments for trainee ${traineeId}: ${candidates.map((e) => e.doc.id).join(", ")}`);
    }
  }

  const resolvedThreadByAssignment = new Map();
  const resolveThread = (assignment) => {
    const { doc, data } = assignment;
    const traineeId = String(data.traineeId || "");
    const coachId = String(data.coachId || "");
    const pairThreads = threadsByPair.get(pairKey(traineeId, coachId)) || [];
    const explicit = typeof data.threadId === "string" ? threadsById.get(data.threadId) : null;
    const linked = pairThreads.filter((thread) => thread.data.assignmentId === doc.id);
    if (explicit) return explicit;
    if (linked.length === 1) return linked[0];
    if (linked.length > 1) throw new Error(`Multiple threads link assignment ${doc.id}`);
    if (threadsById.has(doc.id)) return threadsById.get(doc.id);
    const legacy = threadsById.get(legacyThreadId(traineeId, coachId));
    if (legacy) return legacy;
    if (pairThreads.length === 1) return pairThreads[0];
    if (pairThreads.length > 1) throw new Error(`Ambiguous threads for assignment ${doc.id}`);
    return null;
  };

  // --- assignments -------------------------------------------------------
  for (const assignment of assignments) {
    const { doc, data } = assignment;
    const traineeId = String(data.traineeId || "");
    const isActive = activeByTrainee.get(traineeId)?.doc.id === doc.id;
    const thread = resolveThread(assignment);
    if (isActive && !thread) throw new Error(`Active assignment ${doc.id} has no chat thread`);
    if (thread) resolvedThreadByAssignment.set(doc.id, thread.doc.id);

    if (data.schemaVersion === 2) stats.alreadyMigrated += 1;
    if (isActive) stats.active += 1;
    else stats.unverified += 1;

    writes.push({
      ref: doc.ref,
      data: {
        traineeId: String(data.traineeId || ""),
        coachId: String(data.coachId || ""),
        sourceRequestId: data.sourceRequestId || doc.id,
        ...(thread ? { threadId: thread.doc.id } : {}),
        status: isActive ? "active" : "ended",
        startedAt: data.startedAt || data.createdAt || (isActive ? FieldValue.serverTimestamp() : null),
        endedAt: isActive ? null : (data.endedAt || null),
        endedBy: isActive ? null : (data.endedBy || null),
        endReason: isActive ? null : (data.endReason || "backfill_unverified"),
        schemaVersion: 2,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  for (const [traineeId, trainee] of trainees) {
    const active = activeByTrainee.get(traineeId);
    const desired = active?.doc.id || null;
    if ((trainee?.activeAssignmentId || null) !== desired) {
      writes.push({
        ref: db.collection("users").doc(traineeId),
        data: { activeAssignmentId: desired, updatedAt: FieldValue.serverTimestamp() },
      });
    }
  }

  // --- chat threads ------------------------------------------------------
  for (const thread of threadsById.values()) {
    const { doc, data } = thread;
    const traineeId = String(data.traineeId || "");
    const coachId = String(data.coachId || "");
    let linked = typeof data.assignmentId === "string" ? assignmentsById.get(data.assignmentId) : null;
    if (!linked || String(linked.data.traineeId || "") !== traineeId || String(linked.data.coachId || "") !== coachId) {
      linked = assignments.find((entry) => resolvedThreadByAssignment.get(entry.doc.id) === doc.id) || null;
    }

    const active = activeByTrainee.get(traineeId);
    const isActive = Boolean(linked && active?.doc.id === linked.doc.id && String(linked.data.coachId || "") === coachId);
    if (isActive) stats.threadsActive += 1;
    else stats.threadsEnded += 1;

    writes.push({
      ref: doc.ref,
      data: {
        threadId: doc.id,
        traineeId,
        coachId,
        participants: [traineeId, coachId],
        lastMessageText: typeof data.lastMessageText === "string" ? data.lastMessageText : "",
        lastMessageType: data.lastMessageType === "image" ? "image" : "text",
        lastSenderId: typeof data.lastSenderId === "string" ? data.lastSenderId : null,
        lastMessageAt: data.lastMessageAt || null,
        unreadByCoach: Number(data.unreadByCoach) || 0,
        unreadByTrainee: Number(data.unreadByTrainee) || 0,
        createdAt: data.createdAt || FieldValue.serverTimestamp(),
        status: isActive ? "active" : "ended",
        assignmentId: linked?.doc.id || null,
        schemaVersion: 2,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  console.log("assignments");
  console.log(`  confirmed active     : ${stats.active}`);
  console.log(`  ended (unverified)   : ${stats.unverified}`);
  console.log(`  already migrated     : ${stats.alreadyMigrated}`);
  console.log(`  bootstrapped         : ${stats.bootstrappedAssignments}`);
  console.log("chatThreads");
  console.log(`  active               : ${stats.threadsActive}`);
  console.log(`  ended                : ${stats.threadsEnded}`);
  console.log(`  bootstrapped         : ${stats.bootstrappedThreads}`);
  console.log(`\nPending writes: ${writes.length}`);

  await commit(writes);
  console.log(APPLY ? "\nApplied.\n" : "\nDry run only — re-run with --apply to write.\n");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
