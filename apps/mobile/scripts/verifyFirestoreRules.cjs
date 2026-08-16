const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  writeBatch,
} = require("firebase/firestore");

setLogLevel("error");

const projectId = process.env.GCLOUD_PROJECT || "demo-fytrak";
const rulesPath = path.resolve(__dirname, "../../../firestore.rules");
const rules = fs.readFileSync(rulesPath, "utf8");

const requestId = "trainee_1_coach_1";
const threadId = "coach_1_trainee_1";

async function seed(testEnv, seedFn) {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedFn(context.firestore());
  });
}

async function seedUsers(testEnv, traineeOverrides = {}) {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, "users", "coach_1"), {
      role: "coach",
      name: "Coach One",
      assignmentStatus: "unassigned",
    });
    await setDoc(doc(db, "users", "coach_2"), {
      role: "coach",
      name: "Coach Two",
      assignmentStatus: "unassigned",
    });
    await setDoc(doc(db, "users", "trainee_1"), {
      role: "trainee",
      name: "Trainee One",
      assignmentStatus: "unassigned",
      profile: { basic: { goal: "strength" } },
      ...traineeOverrides,
    });
  });
}

async function seedPendingRequest(testEnv) {
  await seedUsers(testEnv, {
    assignmentStatus: "pending",
    selectedCoachId: "coach_1",
    selectedCoachName: "Coach One",
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "coachRequests", requestId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      coachName: "Coach One",
      traineeName: "Trainee One",
      traineeGoal: "strength",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

async function seedAssignedRelationship(testEnv) {
  await seedUsers(testEnv, {
    assignmentStatus: "assigned",
    selectedCoachId: "coach_1",
    selectedCoachName: "Coach One",
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "coachRequests", requestId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      coachName: "Coach One",
      traineeName: "Trainee One",
      traineeGoal: "strength",
      status: "accepted",
      createdAt: serverTimestamp(),
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, "assignments", requestId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      status: "active",
      sourceRequestId: requestId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, "chatThreads", threadId), {
      threadId,
      traineeId: "trainee_1",
      coachId: "coach_1",
      participants: ["trainee_1", "coach_1"],
      lastMessageText: "",
      lastMessageType: "text",
      lastSenderId: null,
      lastMessageAt: null,
      unreadByCoach: 0,
      unreadByTrainee: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  try {
    await seedUsers(testEnv);
    const traineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const otherDb = testEnv.authenticatedContext("other_user").firestore();

    await assertSucceeds(updateDoc(doc(traineeDb, "users", "trainee_1"), {
      bio: "Training for strength.",
      updatedAt: serverTimestamp(),
    }));

    // Account timezone capture is a one-time, owner-only write with a narrow
    // field set. It must not make arbitrary profile/security fields writable.
    await assertSucceeds(updateDoc(doc(traineeDb, "users", "trainee_1"), {
      timezone: "Africa/Tunis",
      timezoneSource: "captured",
      timezoneCapturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(traineeDb, "users", "trainee_1"), {
      timezone: "Europe/Paris",
      timezoneSource: "captured",
      timezoneCapturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(otherDb, "users", "trainee_1"), {
      timezone: "Europe/Paris",
      timezoneSource: "captured",
      timezoneCapturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(traineeDb, "users", "trainee_1"), {
      timezone: "",
      timezoneSource: "captured",
      timezoneCapturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    const coachTimezoneDb = testEnv.authenticatedContext("coach_1").firestore();
    await assertSucceeds(updateDoc(doc(coachTimezoneDb, "users", "coach_1"), {
      timezone: "Africa/Tunis",
      timezoneSource: "captured",
      timezoneCapturedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(traineeDb, "users", "trainee_1"), {
      assignmentStatus: "assigned",
      updatedAt: serverTimestamp(),
    }));

    await assertFails(updateDoc(doc(traineeDb, "users", "trainee_1"), {
      "clientSummary.internalFlag": true,
      "clientSummary.updatedAt": serverTimestamp(),
    }));

    await assertFails(setDoc(doc(traineeDb, "coachRequests", requestId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      coachName: "Coach One",
      traineeName: "Trainee One",
      traineeGoal: "strength",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(setDoc(doc(otherDb, "coachRequests", "trainee_1_coach_2"), {
      traineeId: "trainee_1",
      coachId: "coach_2",
      coachName: "Coach Two",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    const requestBatch = writeBatch(traineeDb);
    requestBatch.set(doc(traineeDb, "users", "trainee_1"), {
      assignmentStatus: "pending",
      selectedCoachId: "coach_1",
      selectedCoachName: "Coach One",
      activeAssignmentId: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    requestBatch.set(doc(traineeDb, "coachRequests", requestId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      coachName: "Coach One",
      traineeName: "Trainee One",
      traineeGoal: "strength",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      respondedAt: null,
      cancelledAt: null,
    });
    await assertSucceeds(requestBatch.commit());

    await seedPendingRequest(testEnv);
    const coachDb = testEnv.authenticatedContext("coach_1").firestore();
    const outsiderCoachDb = testEnv.authenticatedContext("coach_2").firestore();

    await assertFails(getDoc(doc(outsiderCoachDb, "users", "trainee_1")));
    await assertSucceeds(getDoc(doc(coachDb, "coachRequests", requestId)));

    const unsafeApproval = writeBatch(coachDb);
    unsafeApproval.set(doc(coachDb, "coachRequests", requestId), {
      status: "accepted",
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    unsafeApproval.set(doc(coachDb, "users", "trainee_1"), {
      assignmentStatus: "assigned",
      updatedAt: serverTimestamp(),
    }, { merge: true });
    unsafeApproval.set(doc(coachDb, "assignments", requestId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      status: "active",
      sourceRequestId: requestId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    unsafeApproval.set(doc(coachDb, "chatThreads", threadId), {
      threadId,
      traineeId: "trainee_1",
      coachId: "coach_1",
      participants: ["trainee_1", "coach_1"],
      lastMessageText: "",
      lastMessageType: "text",
      lastSenderId: null,
      lastMessageAt: null,
      unreadByCoach: 0,
      unreadByTrainee: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await assertFails(unsafeApproval.commit());

    const v0AssignmentId = "assignment_v0_1";
    const validApproval = writeBatch(coachDb);
    validApproval.update(doc(coachDb, "coachRequests", requestId), {
      status: "accepted",
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validApproval.set(doc(coachDb, "users", "trainee_1"), {
      assignmentStatus: "assigned",
      selectedCoachId: "coach_1",
      selectedCoachName: "Coach One",
      activeAssignmentId: v0AssignmentId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    validApproval.set(doc(coachDb, "assignments", v0AssignmentId), {
      traineeId: "trainee_1",
      coachId: "coach_1",
      threadId: v0AssignmentId,
      status: "active",
      sourceRequestId: requestId,
      startedAt: serverTimestamp(),
      endedAt: null,
      endedBy: null,
      endReason: null,
      schemaVersion: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    validApproval.set(doc(coachDb, "chatThreads", v0AssignmentId), {
      threadId: v0AssignmentId,
      assignmentId: v0AssignmentId,
      status: "active",
      traineeId: "trainee_1",
      coachId: "coach_1",
      participants: ["trainee_1", "coach_1"],
      lastMessageText: "",
      lastMessageType: "text",
      lastSenderId: null,
      lastMessageAt: null,
      unreadByCoach: 0,
      unreadByTrainee: 0,
      schemaVersion: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(validApproval.commit());

    await seedAssignedRelationship(testEnv);
    const assignedCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const assignedTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();

    await assertSucceeds(getDoc(doc(assignedCoachDb, "users", "trainee_1")));
    await assertSucceeds(getDoc(doc(assignedCoachDb, "assignments", requestId)));
    await assertSucceeds(getDoc(doc(assignedCoachDb, "chatThreads", threadId)));

    await assertSucceeds(updateDoc(doc(assignedCoachDb, "chatThreads", threadId), {
      unreadByCoach: 0,
      updatedAt: serverTimestamp(),
    }));

    await assertSucceeds(setDoc(doc(assignedCoachDb, "users", "trainee_1", "coachNotes", "note_1"), {
      coachId: "coach_1",
      text: "Follow up on sleep quality.",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await assertFails(setDoc(doc(outsiderCoachDb, "users", "trainee_1", "coachNotes", "note_2"), {
      coachId: "coach_2",
      text: "This should not be allowed.",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    const messageRef = doc(collection(assignedTraineeDb, "chats", threadId, "messages"));
    const messageBatch = writeBatch(assignedTraineeDb);
    messageBatch.set(messageRef, {
      threadId,
      senderId: "trainee_1",
      receiverId: "coach_1",
      participants: ["trainee_1", "coach_1"],
      type: "text",
      text: "Coach, here is my update.",
      status: "sent",
      createdAt: serverTimestamp(),
      readAt: null,
    });
    messageBatch.update(doc(assignedTraineeDb, "chatThreads", threadId), {
      lastMessageText: "Coach, here is my update.",
      lastMessageType: "text",
      lastSenderId: "trainee_1",
      lastMessageAt: serverTimestamp(),
      unreadByCoach: 1,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(messageBatch.commit());

    await assertFails(addDoc(collection(outsiderCoachDb, "chats", threadId, "messages"), {
      threadId,
      senderId: "coach_2",
      receiverId: "trainee_1",
      participants: ["coach_2", "trainee_1"],
      type: "text",
      text: "Unauthorized message.",
      status: "sent",
      createdAt: serverTimestamp(),
      readAt: null,
    }));

    await assertFails(addDoc(collection(assignedTraineeDb, "auditEvents"), {
      actorId: "trainee_1",
      eventName: "assignment_requested",
      entityType: "coachRequest",
      entityId: requestId,
      createdAt: serverTimestamp(),
    }));

    const requestSnap = await getDoc(doc(assignedCoachDb, "coachRequests", requestId));
    assert.equal(requestSnap.data().status, "accepted");

    // --- foods collection is readable by any signed-in user, never writable ---
    await seedUsers(testEnv);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "foods", "couscous"), {
        name: "Couscous",
        searchName: "couscous",
        calories: 176,
        protein: 6,
        carbs: 36,
        fats: 0.3,
      });
    });
    const foodReaderDb = testEnv.authenticatedContext("trainee_1").firestore();
    await assertSucceeds(getDoc(doc(foodReaderDb, "foods", "couscous")));
    await assertFails(setDoc(doc(foodReaderDb, "foods", "couscous"), { calories: 0 }));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "foods", "couscous")));

    // --- roster list must work past Firestore's 10-document-access-call cap ---
    // Regression guard: the old `allow read` used isAssignedCoach(), which issues
    // one get() per returned doc, so a coach with >10 clients got permission-denied
    // on the entire roster query and saw a silently empty dashboard.
    await seed(testEnv, async (db) => {
      await setDoc(doc(db, "users", "coach_1"), {
        role: "coach",
        name: "Coach One",
        assignmentStatus: "unassigned",
      });
      for (let i = 0; i < 15; i += 1) {
        await setDoc(doc(db, "users", `client_${i}`), {
          role: "trainee",
          name: `Client ${i}`,
          assignmentStatus: "assigned",
          selectedCoachId: "coach_1",
          selectedCoachName: "Coach One",
        });
      }
    });
    const rosterCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const rosterSnap = await assertSucceeds(getDocs(query(
      collection(rosterCoachDb, "users"),
      where("selectedCoachId", "==", "coach_1"),
      where("assignmentStatus", "==", "assigned"),
      limit(100)
    )));
    assert.equal(rosterSnap.size, 15, "coach must see all 15 assigned clients");

    // A different coach must not be able to list another coach's roster.
    const foreignCoachDb = testEnv.authenticatedContext("coach_2").firestore();
    await assertFails(getDocs(query(
      collection(foreignCoachDb, "users"),
      where("selectedCoachId", "==", "coach_1"),
      where("assignmentStatus", "==", "assigned"),
      limit(100)
    )));

    // --- trainee may complete, but never forge, a coach prescription ---
    await seedAssignedRelationship(testEnv);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "trainee_1", "prescribedWorkouts", "presc_1"), {
        coachId: "coach_1",
        coachName: "Coach One",
        title: "Push Day",
        exercises: [{ name: "Bench Press", targetSets: 3, targetReps: "8" }],
        isCompleted: false,
        assignedAt: serverTimestamp(),
      });
    });
    const prescTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const prescCoachDb = testEnv.authenticatedContext("coach_1").firestore();

    // trainee CAN flip only the completion flags
    await assertSucceeds(setDoc(
      doc(prescTraineeDb, "users", "trainee_1", "prescribedWorkouts", "presc_1"),
      { isCompleted: true, completedAt: serverTimestamp() },
      { merge: true }
    ));
    // trainee CANNOT rewrite the prescription content
    await assertFails(setDoc(
      doc(prescTraineeDb, "users", "trainee_1", "prescribedWorkouts", "presc_1"),
      { title: "Rewritten by trainee" },
      { merge: true }
    ));
    // trainee CANNOT author a prescription from scratch
    await assertFails(setDoc(
      doc(prescTraineeDb, "users", "trainee_1", "prescribedWorkouts", "forged"),
      {
        coachId: "coach_1",
        coachName: "Coach One",
        title: "Forged",
        exercises: [],
        isCompleted: false,
        assignedAt: serverTimestamp(),
      }
    ));
    // the assigned coach still can
    await assertSucceeds(setDoc(
      doc(prescCoachDb, "users", "trainee_1", "prescribedWorkouts", "presc_2"),
      {
        coachId: "coach_1",
        coachName: "Coach One",
        title: "Pull Day",
        exercises: [],
        isCompleted: false,
        assignedAt: serverTimestamp(),
      }
    ));

    // --- Phase B: assignment-scoped chat access ---------------------------
    //
    // Ending an assignment must revoke the COACH's access to the thread and to
    // every message in it, while leaving the CLIENT's own history intact.
    // Before Phase B the message rule also accepted anyone named as
    // senderId/receiverId on the message itself, so revocation did nothing.
    await seed(testEnv, async () => {});
    await seedUsers(testEnv, {
      assignmentStatus: "assigned",
      selectedCoachId: "coach_1",
      selectedCoachName: "Coach One",
      activeAssignmentId: "assignment_active_1",
    });

    const activeThreadId = "assignment_active_1";
    // Legacy documents used different ids for assignment and thread.
    const endedAssignmentId = "trainee_1_coach_1";
    const endedThreadId = "coach_1_trainee_1";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Current relationship.
      await setDoc(doc(db, "chatThreads", activeThreadId), {
        threadId: activeThreadId,
        assignmentId: activeThreadId,
        status: "active",
        traineeId: "trainee_1",
        coachId: "coach_1",
        participants: ["trainee_1", "coach_1"],
        schemaVersion: 2,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "assignments", endedAssignmentId), {
        traineeId: "trainee_1",
        coachId: "coach_1",
        threadId: endedThreadId,
        status: "ended",
        schemaVersion: 2,
      });
      await setDoc(doc(db, "chats", activeThreadId, "messages", "m_active"), {
        threadId: activeThreadId,
        senderId: "trainee_1",
        receiverId: "coach_1",
        type: "text",
        text: "current relationship",
        createdAt: serverTimestamp(),
      });

      // A PREVIOUS relationship with the very same coach.
      await setDoc(doc(db, "chatThreads", endedThreadId), {
        threadId: endedThreadId,
        assignmentId: endedAssignmentId,
        status: "ended",
        traineeId: "trainee_1",
        coachId: "coach_1",
        participants: ["trainee_1", "coach_1"],
        schemaVersion: 2,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "chats", endedThreadId, "messages", "m_ended"), {
        threadId: endedThreadId,
        senderId: "trainee_1",
        receiverId: "coach_1",
        type: "text",
        text: "previous relationship",
        createdAt: serverTimestamp(),
      });

      // Legacy thread with no `status` field at all — must still work.
      await setDoc(doc(db, "chatThreads", "legacy_thread"), {
        threadId: "legacy_thread",
        traineeId: "trainee_1",
        coachId: "coach_1",
        participants: ["trainee_1", "coach_1"],
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "chats", "legacy_thread", "messages", "m_legacy"), {
        threadId: "legacy_thread",
        senderId: "trainee_1",
        receiverId: "coach_1",
        type: "text",
        text: "legacy",
        createdAt: serverTimestamp(),
      });
    });

    const chatCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const chatTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const outsiderDb = testEnv.authenticatedContext("coach_2").firestore();

    // Active thread: both parties have full access.
    await assertSucceeds(getDoc(doc(chatCoachDb, "chatThreads", activeThreadId)));
    await assertSucceeds(getDoc(doc(chatTraineeDb, "chatThreads", activeThreadId)));
    await assertSucceeds(getDoc(doc(chatCoachDb, "chats", activeThreadId, "messages", "m_active")));
    await assertSucceeds(getDoc(doc(chatTraineeDb, "chats", activeThreadId, "messages", "m_active")));

    // Ended thread: the coach loses the thread AND its messages...
    await assertFails(getDoc(doc(chatCoachDb, "chatThreads", endedThreadId)));
    await assertFails(getDoc(doc(chatCoachDb, "chats", endedThreadId, "messages", "m_ended")));
    // ...even though they are still listed in participants and named as the
    // message receiver. This is the regression the old rule allowed.
    await assertFails(setDoc(doc(chatCoachDb, "chats", endedThreadId, "messages", "m_new"), {
      threadId: endedThreadId,
      senderId: "coach_1",
      receiverId: "trainee_1",
      type: "text",
      text: "should be blocked",
      createdAt: serverTimestamp(),
    }));

    // ...but the client keeps their own conversation history.
    await assertSucceeds(getDoc(doc(chatTraineeDb, "chatThreads", endedThreadId)));
    await assertSucceeds(getDoc(doc(chatTraineeDb, "chats", endedThreadId, "messages", "m_ended")));

    // Legacy threads with no status default to active, so nothing breaks
    // between the backfill and the rules deploy.
    await assertSucceeds(getDoc(doc(chatCoachDb, "chatThreads", "legacy_thread")));
    await assertSucceeds(getDoc(doc(chatCoachDb, "chats", "legacy_thread", "messages", "m_legacy")));

    // An unrelated coach reaches nothing, active or otherwise.
    await assertFails(getDoc(doc(outsiderDb, "chatThreads", activeThreadId)));
    await assertFails(getDoc(doc(outsiderDb, "chats", activeThreadId, "messages", "m_active")));

    // The coach inbox query must filter to active threads; an unfiltered query
    // that can return an ended thread is denied in full.
    await assertSucceeds(getDocs(query(
      collection(chatCoachDb, "chatThreads"),
      where("participants", "array-contains", "coach_1"),
      where("status", "==", "active"),
      orderBy("lastMessageAt", "desc"),
      limit(100)
    )));
    // activeAssignmentId is backend-only: a client cannot repoint themselves at
    // another relationship to reach its thread.
    await assertFails(updateDoc(doc(chatTraineeDb, "users", "trainee_1"), {
      activeAssignmentId: endedThreadId,
    }));

    // --- Phase C: daily report metadata ------------------------------------
    //
    // Review state is trustworthy because the client cannot write review
    // fields, while only the currently assigned coach may update the narrow
    // three-field review state.
    await seedAssignedRelationship(testEnv);

    const reportDateKey = "2026-08-03";
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "trainee_1", "dailyReports", reportDateKey),
        {
          clientDateKey: reportDateKey,
          timezone: "Africa/Tunis",
          traineeId: "trainee_1",
          coachId: "coach_1",
          hasActivity: true,
          hasWorkout: true,
          hasMeals: false,
          hasWater: false,
          hasMetrics: false,
          hasPhoto: false,
          reviewStatus: "pending_review",
          reviewAvailableAt: serverTimestamp(),
          reviewedAt: null,
          reviewedByCoachId: null,
          reopenCount: 0,
          schemaVersion: 1,
        }
      );
    });

    const reportTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const reportCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const reportOutsiderDb = testEnv.authenticatedContext("coach_2").firestore();

    // Both parties to the current relationship may READ it.
    await assertSucceeds(getDoc(doc(reportTraineeDb, "users", "trainee_1", "dailyReports", reportDateKey)));
    await assertSucceeds(getDoc(doc(reportCoachDb, "users", "trainee_1", "dailyReports", reportDateKey)));
    // An unrelated coach may not.
    await assertFails(getDoc(doc(reportOutsiderDb, "users", "trainee_1", "dailyReports", reportDateKey)));

    // The client cannot forge review state.
    await assertFails(updateDoc(doc(reportTraineeDb, "users", "trainee_1", "dailyReports", reportDateKey), {
      reviewStatus: "reviewed",
      reviewedAt: serverTimestamp(),
      reviewedByCoachId: "coach_1",
    }));
    // The assigned coach may mark the existing report reviewed.
    await assertSucceeds(updateDoc(doc(reportCoachDb, "users", "trainee_1", "dailyReports", reportDateKey), {
      reviewStatus: "reviewed",
      reviewedAt: serverTimestamp(),
      reviewedByCoachId: "coach_1",
    }));
    // The owner may append narrowly scoped activity metadata.
    await assertSucceeds(updateDoc(doc(reportTraineeDb, "users", "trainee_1", "dailyReports", reportDateKey), {
      hasMeals: true,
      hasActivity: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 1,
    }));
    await assertSucceeds(setDoc(doc(reportTraineeDb, "users", "trainee_1", "dailyReports", "2026-08-04"), {
      clientDateKey: "2026-08-04",
      timezone: "Africa/Tunis",
      traineeId: "trainee_1",
      hasActivity: true,
      hasWorkout: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 1,
    }));
    // Activity markers are intentionally sparse. Adding a second dimension to
    // a marker without the other Boolean fields must remain valid.
    const sparseReportRef = doc(
      reportTraineeDb,
      "users",
      "trainee_1",
      "dailyReports",
      "2026-08-06"
    );
    await assertSucceeds(setDoc(sparseReportRef, {
      clientDateKey: "2026-08-06",
      timezone: "Africa/Tunis",
      traineeId: "trainee_1",
      hasActivity: true,
      hasMeals: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 1,
    }));
    await assertSucceeds(updateDoc(sparseReportRef, {
      hasActivity: true,
      hasWater: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 1,
    }));
    // Neither the coach nor the client may create a pre-reviewed report.
    await assertFails(setDoc(doc(reportCoachDb, "users", "trainee_1", "dailyReports", "2026-08-04"), {
      clientDateKey: "2026-08-04",
      reviewStatus: "reviewed",
    }));

    // --- V0 deletion reconciliation ----------------------------------------
    //
    // Deleting the last meal or photo of a day must be able to clear that day's
    // presence flag, WITHOUT touching the record that a coach reviewed the day.
    await seedAssignedRelationship(testEnv);

    const delDateKey = "2026-08-05";
    const seedReport = async (overrides = {}) => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), "users", "trainee_1", "dailyReports", delDateKey),
          {
            clientDateKey: delDateKey,
            timezone: "Africa/Tunis",
            traineeId: "trainee_1",
            hasActivity: true,
            hasWorkout: false,
            hasMeals: true,
            hasWater: false,
            hasMetrics: false,
            hasPhoto: true,
            lastActivityAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            schemaVersion: 1,
            ...overrides,
          }
        );
      });
    };

    await seedReport();
    const delTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const delCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const delReportRef = doc(delTraineeDb, "users", "trainee_1", "dailyReports", delDateKey);

    // Clearing hasMeals while another kind of activity remains: hasActivity stays true.
    await assertSucceeds(updateDoc(delReportRef, {
      hasWorkout: false, hasMeals: false, hasWater: false, hasMetrics: false, hasPhoto: true,
      hasActivity: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    // Clearing the LAST kind: hasActivity must be allowed to go false.
    await assertSucceeds(updateDoc(delReportRef, {
      hasWorkout: false, hasMeals: false, hasWater: false, hasMetrics: false, hasPhoto: false,
      hasActivity: false,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    // hasActivity must agree with the flags — no claiming activity that is not there...
    await assertFails(updateDoc(delReportRef, {
      hasWorkout: false, hasMeals: false, hasWater: false, hasMetrics: false, hasPhoto: false,
      hasActivity: true,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    // ...and no hiding activity that is.
    await assertFails(updateDoc(delReportRef, {
      hasWorkout: true, hasMeals: false, hasWater: false, hasMetrics: false, hasPhoto: false,
      hasActivity: false,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    // Deletion reconciliation must never erase review history.
    await seedReport({ reviewStatus: "reviewed", reviewedByCoachId: "coach_1", reviewedAt: serverTimestamp() });
    await assertFails(updateDoc(delReportRef, {
      hasMeals: false,
      hasActivity: true,
      reviewStatus: "live",
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(delReportRef, {
      hasMeals: false,
      hasActivity: true,
      reviewedByCoachId: null,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    // The coach still cannot touch activity flags while reviewing.
    await assertFails(updateDoc(doc(delCoachDb, "users", "trainee_1", "dailyReports", delDateKey), {
      reviewStatus: "reviewed",
      reviewedAt: serverTimestamp(),
      reviewedByCoachId: "coach_1",
      hasMeals: false,
    }));

    // Photo documents contain permanent public CDN URLs in V0. The assigned
    // coach learns presence through dailyReports.hasPhoto, but must not receive
    // the URL-bearing document itself.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "users", "trainee_1", "photos", "2026-08-05"),
        {
          date: "2026-08-05",
          clientDateKey: "2026-08-05",
          traineeId: "trainee_1",
          url: "https://cdn.example.test/permanent-photo.jpg",
          createdAt: serverTimestamp(),
        }
      );
    });
    await assertSucceeds(getDoc(
      doc(delTraineeDb, "users", "trainee_1", "photos", "2026-08-05")
    ));
    await assertFails(getDoc(
      doc(delCoachDb, "users", "trainee_1", "photos", "2026-08-05")
    ));

    // --- Phase D: dated plan scheduling -----------------------------------
    await seedAssignedRelationship(testEnv);
    const planCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const planTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const outsideCoachDb = testEnv.authenticatedContext("coach_2").firestore();

    const workoutBody = {
      coachId: "coach_1",
      coachName: "Coach One",
      title: "Push day",
      exercises: [],
      isCompleted: false,
      assignedAt: serverTimestamp(),
    };

    // The assigned coach may author a DATED prescription.
    await assertSucceeds(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribedWorkouts", "sched_1"),
      { ...workoutBody, scheduledDateKey: "2026-08-05", status: "published" }
    ));
    // ...and an undated one, exactly as before Phase D.
    await assertSucceeds(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribedWorkouts", "sched_undated"),
      workoutBody
    ));
    // A malformed date is rejected before it can poison dated resolution.
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribedWorkouts", "sched_bad"),
      { ...workoutBody, scheduledDateKey: "05-08-2026" }
    ));
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribedWorkouts", "sched_bad2"),
      { ...workoutBody, scheduledDateKey: 20260805 }
    ));
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribedWorkouts", "sched_bad3"),
      { ...workoutBody, scheduledDateKey: "2026-08-05", status: "sneaky" }
    ));
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribedWorkouts", "sched_bad_month"),
      { ...workoutBody, scheduledDateKey: "2026-13-05" }
    ));

    // A client cannot author a prescription, dated or otherwise...
    await assertFails(setDoc(
      doc(planTraineeDb, "users", "trainee_1", "prescribedWorkouts", "forged"),
      { ...workoutBody, scheduledDateKey: "2026-08-05" }
    ));
    // ...nor reschedule one the coach already wrote. Their permitted mutation
    // is completion only, which cannot reach the scheduling fields.
    await assertFails(updateDoc(
      doc(planTraineeDb, "users", "trainee_1", "prescribedWorkouts", "sched_1"),
      { scheduledDateKey: "2026-08-09" }
    ));
    await assertSucceeds(updateDoc(
      doc(planTraineeDb, "users", "trainee_1", "prescribedWorkouts", "sched_1"),
      { isCompleted: true, completedAt: serverTimestamp() }
    ));
    // An unrelated coach cannot schedule anything for this client.
    await assertFails(setDoc(
      doc(outsideCoachDb, "users", "trainee_1", "prescribedWorkouts", "outsider"),
      { ...workoutBody, coachId: "coach_2", scheduledDateKey: "2026-08-05" }
    ));

    // Same contract for nutrition prescriptions.
    const mealBody = {
      coachId: "coach_1",
      coachName: "Coach One",
      title: "Cut day",
      macros: { calories: 2100, protein: 160, carbs: 220, fats: 65 },
      isApplied: false,
      assignedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribed_meals", "meal_sched"),
      { ...mealBody, scheduledDateKey: "2026-08-05", status: "published" }
    ));
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "prescribed_meals", "meal_bad"),
      { ...mealBody, scheduledDateKey: "not-a-date" }
    ));
    await assertFails(setDoc(
      doc(planTraineeDb, "users", "trainee_1", "prescribed_meals", "meal_forged"),
      { ...mealBody, scheduledDateKey: "2026-08-05" }
    ));

    // Programs carry startDateKey under the same validation.
    const programBody = {
      coachId: "coach_1",
      coachName: "Coach One",
      title: "8-week block",
      description: "",
      level: "INTERMEDIATE",
      durationWeeks: 1,
      weeks: [{ id: "w1", weekNumber: 1, title: "Week 1", sessions: [] }],
      assignedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(
      doc(planCoachDb, "users", "trainee_1", "programs", "prog_sched"),
      { ...programBody, startDateKey: "2026-08-03", status: "published" }
    ));
    await assertSucceeds(setDoc(
      doc(planCoachDb, "users", "trainee_1", "programs", "prog_undated"),
      programBody
    ));
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "programs", "prog_bad"),
      { ...programBody, startDateKey: "2026/08/03" }
    ));
    await assertFails(setDoc(
      doc(planCoachDb, "users", "trainee_1", "programs", "prog_bad_month"),
      { ...programBody, startDateKey: "2026-00-03" }
    ));
    await assertFails(setDoc(
      doc(planTraineeDb, "users", "trainee_1", "programs", "prog_forged"),
      { ...programBody, startDateKey: "2026-08-03" }
    ));

    // -----------------------------------------------------------------
    // PROGRAM PRESCRIPTIONS AND PROGRAM-SOURCED WORKOUT LOGS
    // -----------------------------------------------------------------
    await seedAssignedRelationship(testEnv);
    const progCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const progTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const progOtherCoachDb = testEnv.authenticatedContext("coach_2").firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", "coach_2"), { role: "coach" }, { merge: true });
      await setDoc(doc(db, "users", "trainee_1", "programs", "prog_live"), {
        ...programBody, startDateKey: "2026-08-16", status: "published",
      });
    });

    // The assigned coach authors the prescription.
    await assertSucceeds(setDoc(
      doc(progCoachDb, "users", "trainee_1", "programs", "prog_new"),
      { ...programBody, startDateKey: "2026-09-01", status: "published" }
    ));
    // An unrelated coach cannot.
    await assertFails(setDoc(
      doc(progOtherCoachDb, "users", "trainee_1", "programs", "prog_outsider"),
      { ...programBody, startDateKey: "2026-09-01", status: "published" }
    ));
    // The TRAINEE can read their program...
    await assertSucceeds(getDoc(doc(progTraineeDb, "users", "trainee_1", "programs", "prog_live")));
    // ...but must never modify the prescription's contents.
    await assertFails(setDoc(
      doc(progTraineeDb, "users", "trainee_1", "programs", "prog_forged"),
      { ...programBody, startDateKey: "2026-09-01" }
    ));
    await assertFails(updateDoc(
      doc(progTraineeDb, "users", "trainee_1", "programs", "prog_live"),
      { title: "Easier program" }
    ));
    // Including marking a session complete — which is WHY completion is derived
    // from the workout log instead of written onto the program.
    await assertFails(updateDoc(
      doc(progTraineeDb, "users", "trainee_1", "programs", "prog_live"),
      { weeks: [] }
    ));
    // Programs are create-only in V0, so not even the coach may edit one.
    await assertFails(updateDoc(
      doc(progCoachDb, "users", "trainee_1", "programs", "prog_live"),
      { title: "Renamed" }
    ));

    // ---- Program-sourced workout logs -------------------------------------
    const validSource = {
      sourceType: "program",
      sourceProgramId: "prog_live",
      sourceProgramSessionId: "sess_1",
      sourceScheduledDateKey: "2026-08-18",
    };
    const logBody = { name: "Upper Push A", exercises: [], createdAt: serverTimestamp() };

    // A plain workout, with no claim at all.
    await assertSucceeds(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_plain"), logBody));
    // A well-formed program claim.
    await assertSucceeds(setDoc(
      doc(progTraineeDb, "users", "trainee_1", "workouts", "w_program"),
      { ...logBody, ...validSource }
    ));

    // HALF-POPULATED CLAIMS ARE REFUSED — a claim pointing at nothing is the
    // state this phase exists to prevent.
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_a"),
      { ...logBody, sourceType: "program" }));
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_b"),
      { ...logBody, ...validSource, sourceProgramId: "" }));
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_c"),
      { ...logBody, ...validSource, sourceProgramSessionId: "" }));
    // Malformed or non-existent dates.
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_d"),
      { ...logBody, ...validSource, sourceScheduledDateKey: "18/08/2026" }));
    // Out-of-range month and day. The original pattern accepted both, and this
    // is the assertion that caught it once the suite was actually run.
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_e"),
      { ...logBody, ...validSource, sourceScheduledDateKey: "2026-13-01" }));
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_e2"),
      { ...logBody, ...validSource, sourceScheduledDateKey: "2026-00-01" }));
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_e3"),
      { ...logBody, ...validSource, sourceScheduledDateKey: "2026-01-32" }));
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_e4"),
      { ...logBody, ...validSource, sourceScheduledDateKey: "2026-01-00" }));
    // An unknown source kind.
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_f"),
      { ...logBody, ...validSource, sourceType: "nutrition" }));
    // Source fields without the discriminator.
    await assertFails(setDoc(doc(progTraineeDb, "users", "trainee_1", "workouts", "w_g"),
      { ...logBody, sourceProgramId: "prog_live" }));

    // The coach can READ the log — that is how completion is reviewed — but
    // cannot write one on the trainee's behalf.
    await assertSucceeds(getDoc(doc(progCoachDb, "users", "trainee_1", "workouts", "w_program")));
    await assertFails(setDoc(
      doc(progCoachDb, "users", "trainee_1", "workouts", "w_by_coach"),
      { ...logBody, ...validSource }
    ));

    // -----------------------------------------------------------------
    // PHASE 4: PLAN ADJUSTMENT AND HISTORICAL IMMUTABILITY
    //
    // An adjustment APPENDS a new dated prescription; it never edits one. The
    // coach update branch is gone from all three plan collections, so a
    // prescription for a day the client already trained cannot be rewritten
    // after the fact.
    // -----------------------------------------------------------------

    await seedAssignedRelationship(testEnv);
    const adjCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const adjTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const adjOutsiderDb = testEnv.authenticatedContext("coach_2").firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", "coach_2"), { role: "coach" }, { merge: true });
      // An existing prescription and program to attempt edits against.
      await setDoc(doc(db, "users", "trainee_1", "prescribedWorkouts", "existing_w"), {
        ...workoutBody, scheduledDateKey: "2026-09-01", status: "published",
      });
      await setDoc(doc(db, "users", "trainee_1", "prescribed_meals", "existing_m"), {
        coachId: "coach_1", coachName: "Coach One", title: "Cut day",
        description: "", macros: { calories: 2000, protein: 160, carbs: 200, fats: 60 },
        isApplied: false, scheduledDateKey: "2026-09-01", status: "published",
      });
      await setDoc(doc(db, "users", "trainee_1", "programs", "existing_p"), {
        ...programBody, startDateKey: "2026-08-03", status: "published",
      });
    });

    // The assigned coach may CREATE a dated workout and a dated meal.
    await assertSucceeds(setDoc(
      doc(adjCoachDb, "users", "trainee_1", "prescribedWorkouts", "adj_w"),
      { ...workoutBody, scheduledDateKey: "2026-09-02", status: "published" }
    ));
    await assertSucceeds(setDoc(
      doc(adjCoachDb, "users", "trainee_1", "prescribed_meals", "adj_m"),
      {
        coachId: "coach_1", coachName: "Coach One", title: "Revised cut",
        description: "", macros: { calories: 1900, protein: 170, carbs: 180, fats: 55 },
        isApplied: false, scheduledDateKey: "2026-09-02", status: "published",
        assignedAt: serverTimestamp(),
      }
    ));
    // An assigned coach cannot stamp another coach's identity onto content.
    await assertFails(setDoc(
      doc(adjCoachDb, "users", "trainee_1", "prescribedWorkouts", "forged_author_w"),
      { ...workoutBody, coachId: "coach_2", scheduledDateKey: "2026-09-02", status: "published" }
    ));

    // An UNASSIGNED coach may not create either.
    await assertFails(setDoc(
      doc(adjOutsiderDb, "users", "trainee_1", "prescribedWorkouts", "outsider_w"),
      { ...workoutBody, coachId: "coach_2", scheduledDateKey: "2026-09-03", status: "published" }
    ));
    await assertFails(setDoc(
      doc(adjOutsiderDb, "users", "trainee_1", "prescribed_meals", "outsider_m"),
      { coachId: "coach_2", title: "Nope", isApplied: false, scheduledDateKey: "2026-09-03" }
    ));

    // HISTORICAL IMMUTABILITY: the coach cannot UPDATE anything that exists.
    await assertFails(updateDoc(
      doc(adjCoachDb, "users", "trainee_1", "prescribedWorkouts", "existing_w"),
      { title: "Rewritten after the fact" }
    ));
    await assertFails(updateDoc(
      doc(adjCoachDb, "users", "trainee_1", "prescribedWorkouts", "existing_w"),
      { scheduledDateKey: "2026-09-05" }
    ));
    await assertFails(updateDoc(
      doc(adjCoachDb, "users", "trainee_1", "prescribed_meals", "existing_m"),
      { title: "Rewritten after the fact" }
    ));
    await assertFails(updateDoc(
      doc(adjCoachDb, "users", "trainee_1", "programs", "existing_p"),
      { startDateKey: "2026-08-10" }
    ));
    await assertFails(updateDoc(
      doc(adjCoachDb, "users", "trainee_1", "programs", "existing_p"),
      { title: "Renamed block" }
    ));

    // The TRAINEE keeps exactly the narrow updates they had.
    await assertSucceeds(updateDoc(
      doc(adjTraineeDb, "users", "trainee_1", "prescribedWorkouts", "existing_w"),
      { isCompleted: true, completedAt: serverTimestamp() }
    ));
    await assertSucceeds(updateDoc(
      doc(adjTraineeDb, "users", "trainee_1", "prescribed_meals", "existing_m"),
      { isApplied: true, appliedAt: serverTimestamp() }
    ));
    // ...and nothing wider. A trainee must not edit prescription CONTENT.
    await assertFails(updateDoc(
      doc(adjTraineeDb, "users", "trainee_1", "prescribedWorkouts", "existing_w"),
      { title: "Easier session" }
    ));
    await assertFails(updateDoc(
      doc(adjTraineeDb, "users", "trainee_1", "prescribedWorkouts", "existing_w"),
      { isCompleted: true, title: "Easier session" }
    ));
    await assertFails(updateDoc(
      doc(adjTraineeDb, "users", "trainee_1", "prescribed_meals", "existing_m"),
      { macros: { calories: 4000, protein: 10, carbs: 10, fats: 10 } }
    ));

    // -----------------------------------------------------------------
    // THE REVISION AND ITS PRESCRIPTION COMMIT TOGETHER
    // -----------------------------------------------------------------
    const revisionBody = {
      traineeId: "trainee_1",
      coachId: "coach_1",
      kind: "workout",
      effectiveFromDateKey: "2026-09-10",
      prescriptionId: "batched_presc",
      reason: "He has missed the Saturday session four weeks running.",
      summary: "Four sessions down to three",
      createdAt: serverTimestamp(),
    };

    // One batch: the prescription, and the revision naming it.
    const goodBatch = writeBatch(adjCoachDb);
    goodBatch.set(
      doc(adjCoachDb, "users", "trainee_1", "prescribedWorkouts", "batched_presc"),
      { ...workoutBody, scheduledDateKey: "2026-09-10", status: "published" }
    );
    goodBatch.set(
      doc(adjCoachDb, "users", "trainee_1", "planRevisions", "batched_rev"),
      revisionBody
    );
    await assertSucceeds(goodBatch.commit());

    // A standalone revision cannot point at an existing or missing document.
    await assertFails(setDoc(
      doc(adjCoachDb, "users", "trainee_1", "planRevisions", "standalone_existing"),
      { ...revisionBody, createdAt: serverTimestamp() }
    ));
    await assertFails(setDoc(
      doc(adjCoachDb, "users", "trainee_1", "planRevisions", "standalone_missing"),
      { ...revisionBody, prescriptionId: "does_not_exist", createdAt: serverTimestamp() }
    ));

    // Nutrition uses the same atomic contract and the matching collection.
    const nutritionBatch = writeBatch(adjCoachDb);
    nutritionBatch.set(
      doc(adjCoachDb, "users", "trainee_1", "prescribed_meals", "batched_meal"),
      {
        coachId: "coach_1", coachName: "Coach One", title: "Revised cut",
        description: "", macros: { calories: 1900, protein: 170, carbs: 180, fats: 55 },
        isApplied: false, scheduledDateKey: "2026-09-12", status: "published",
      }
    );
    nutritionBatch.set(
      doc(adjCoachDb, "users", "trainee_1", "planRevisions", "batched_meal_rev"),
      {
        ...revisionBody,
        kind: "nutrition",
        effectiveFromDateKey: "2026-09-12",
        prescriptionId: "batched_meal",
        createdAt: serverTimestamp(),
      }
    );
    await assertSucceeds(nutritionBatch.commit());

    // MALFORMED OR INCOMPLETE REVISIONS ARE REFUSED.
    const badRevision = async (overrides, id) => {
      const prescriptionId = `p_${id}`;
      const batch = writeBatch(adjCoachDb);
      batch.set(
        doc(adjCoachDb, "users", "trainee_1", "prescribedWorkouts", prescriptionId),
        { ...workoutBody, scheduledDateKey: "2026-09-11", status: "published" }
      );
      batch.set(
        doc(adjCoachDb, "users", "trainee_1", "planRevisions", `r_${id}`),
        {
          ...revisionBody,
          effectiveFromDateKey: "2026-09-11",
          prescriptionId,
          ...overrides,
          createdAt: overrides.createdAt ?? serverTimestamp(),
        }
      );
      await assertFails(batch.commit());
    };

    // No prescriptionId — the empty record this whole phase removed.
    await badRevision({ prescriptionId: "" }, "no_presc_id");
    await badRevision({ prescriptionId: null }, "null_presc_id");
    // No reason.
    await badRevision({ reason: "" }, "no_reason");
    // A "program" revision would claim a change that cannot have happened.
    await badRevision({ kind: "program" }, "program_kind");
    await badRevision({ kind: "diet" }, "bad_kind");
    // Malformed or missing effective date.
    await badRevision({ effectiveFromDateKey: "10/09/2026" }, "bad_date");
    await badRevision({ effectiveFromDateKey: "2026-13-01" }, "bad_month");
    // Forged authorship, or a revision filed against another trainee.
    await badRevision({ coachId: "coach_2" }, "forged_coach");
    await badRevision({ traineeId: "trainee_2" }, "wrong_trainee");
    // Client-supplied timestamps, and unexpected extra keys.
    await badRevision({ createdAt: new Date("2020-01-01") }, "backdated");
    await badRevision({ extra: "smuggled" }, "extra_key");
    // Bounded free text.
    await badRevision({ reason: "x".repeat(501) }, "long_reason");
    await badRevision({ summary: "x".repeat(501) }, "long_summary");
    // A well-shaped revision still fails when it names a different date than
    // the new prescription created beside it.
    await badRevision({ effectiveFromDateKey: "2026-09-12" }, "date_mismatch");

    // Append-only: a committed revision can never be edited or removed.
    await assertFails(updateDoc(
      doc(adjCoachDb, "users", "trainee_1", "planRevisions", "batched_rev"),
      { reason: "Actually a different reason" }
    ));
    // Neither the trainee nor an unrelated coach may write one at all.
    await assertFails(setDoc(
      doc(adjTraineeDb, "users", "trainee_1", "planRevisions", "self_written"),
      { ...revisionBody, coachId: "trainee_1" }
    ));
    await assertFails(setDoc(
      doc(adjOutsiderDb, "users", "trainee_1", "planRevisions", "outsider_rev"),
      { ...revisionBody, coachId: "coach_2" }
    ));
    // The trainee CAN read them — a plan that changed under them without
    // explanation is the complaint this collection answers.
    await assertSucceeds(getDoc(
      doc(adjTraineeDb, "users", "trainee_1", "planRevisions", "batched_rev")
    ));

    // -----------------------------------------------------------------
    // PAIN ACKNOWLEDGEMENT
    //
    // The CLIENT writes the pain report; the COACH clears it. A client able
    // to write these keys could dismiss their own injury warning before the
    // coach ever saw it, which is the one thing this signal exists to stop.
    // -----------------------------------------------------------------
    const painCoachDb = testEnv.authenticatedContext("coach_1").firestore();
    const painTraineeDb = testEnv.authenticatedContext("trainee_1").firestore();
    const otherCoachDb = testEnv.authenticatedContext("coach_2").firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", "trainee_1"), {
        role: "trainee",
        assignmentStatus: "assigned",
        selectedCoachId: "coach_1",
        clientSummary: { lastPainAt: new Date(), lastPainDateKey: "2026-08-04" },
      }, { merge: true });
      await setDoc(doc(db, "users", "coach_2"), { role: "coach" }, { merge: true });
    });

    const ackPayload = {
      "clientSummary.lastPainAcknowledgedAt": serverTimestamp(),
      "clientSummary.lastPainAcknowledgedByCoachId": "coach_1",
      "clientSummary.lastPainAcknowledgedDateKey": "2026-08-04",
    };

    // The assigned coach may acknowledge.
    await assertSucceeds(updateDoc(doc(painCoachDb, "users", "trainee_1"), ackPayload));

    // An unrelated coach may not.
    await assertFails(updateDoc(doc(otherCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedByCoachId": "coach_2",
    }));

    // The CLIENT may not acknowledge their own pain report.
    await assertFails(updateDoc(doc(painTraineeDb, "users", "trainee_1"), ackPayload));

    // The coach id must be the caller — no acknowledging on someone's behalf.
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedByCoachId": "coach_2",
    }));

    // The timestamp must be the server clock. A back-dated acknowledgement
    // could sit before the report and silence it permanently.
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedAt": new Date("2020-01-01"),
    }));

    // The date key must be a real YYYY-MM-DD.
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedDateKey": "04/08/2026",
    }));
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedDateKey": "2026-13-01",
    }));

    // Only the three acknowledgement keys. A coach must not ride along and
    // rewrite the report itself, or any other part of the summary.
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainNote": "rewritten by the coach",
    }));
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAt": serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      role: "coach",
    }));

    // -----------------------------------------------------------------
    // PAIN ACKNOWLEDGEMENT MUST NAME THE REPORT IT ANSWERS
    //
    // `isPainPending` is `lastPainAt > lastPainAcknowledgedAt`. So an
    // acknowledgement that does not match a real, existing report does not
    // just do nothing — it sets the acknowledged timestamp to now, which
    // suppresses every report the client files until the next one arrives
    // AFTER this write. Acknowledging a day that was never reported is
    // therefore a way to blank the queue, not a harmless no-op.
    // -----------------------------------------------------------------

    // 1. An acknowledgement matching the reported day succeeds.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "trainee_1"), {
        role: "trainee",
        assignmentStatus: "assigned",
        selectedCoachId: "coach_1",
        clientSummary: { lastPainAt: new Date(), lastPainDateKey: "2026-08-04" },
      });
    });
    await assertSucceeds(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedDateKey": "2026-08-04",
    }));

    // 2. A different, perfectly well-formed date fails. This is the case the
    //    regex alone let through: "2026-08-05" is a valid key for a day the
    //    client never reported pain on.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "trainee_1"), {
        role: "trainee",
        assignmentStatus: "assigned",
        selectedCoachId: "coach_1",
        clientSummary: { lastPainAt: new Date(), lastPainDateKey: "2026-08-04" },
      });
    });
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedDateKey": "2026-08-05",
    }));

    // 3. No `lastPainDateKey` on the summary — nothing to match against, so
    //    there is nothing to acknowledge.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "trainee_1"), {
        role: "trainee",
        assignmentStatus: "assigned",
        selectedCoachId: "coach_1",
        clientSummary: { lastPainAt: new Date() },
      });
    });
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), ackPayload));

    // 4. No `lastPainAt` — the queue has no timestamp to compare, so an
    //    acknowledgement here would be answering a report that does not exist.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "trainee_1"), {
        role: "trainee",
        assignmentStatus: "assigned",
        selectedCoachId: "coach_1",
        clientSummary: { lastPainDateKey: "2026-08-04" },
      });
    });
    await assertFails(updateDoc(doc(painCoachDb, "users", "trainee_1"), ackPayload));

    // 5 and 6. Restore a valid report, then confirm identity still holds even
    //    when the date matches: an unrelated coach and the client themselves
    //    are both refused.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "trainee_1"), {
        role: "trainee",
        assignmentStatus: "assigned",
        selectedCoachId: "coach_1",
        clientSummary: { lastPainAt: new Date(), lastPainDateKey: "2026-08-04" },
      });
    });
    // 5. An unrelated coach, with a correctly matched date key.
    await assertFails(updateDoc(doc(otherCoachDb, "users", "trainee_1"), {
      ...ackPayload,
      "clientSummary.lastPainAcknowledgedByCoachId": "coach_2",
    }));
    // 6. The client, with a correctly matched date key. This is the case the
    //    whole split exists for.
    await assertFails(updateDoc(doc(painTraineeDb, "users", "trainee_1"), ackPayload));

    console.log("Firestore rules checks passed.");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
