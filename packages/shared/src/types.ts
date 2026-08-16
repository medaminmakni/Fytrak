export type UserRole = "trainee" | "coach" | "admin";

export type DateKeyProvenance = "client_timezone" | "device_inferred";

export type ClientDateMetadata = {
  date?: string;
  clientDateKey?: string;
  timezone?: string | null;
  dateKeyProvenance?: DateKeyProvenance;
};

export type AssignmentStatus =
  | "unassigned"
  | "pending"
  | "assigned"
  | "rejected"
  | "expired";

export type CoachRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired";

export type CoachVerificationStatus =
  | "not_submitted"
  | "under_review"
  | "verified"
  | "rejected";

export type ChatMessageType = "text" | "image";

export type ChatImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export type ChatMessageStatus = "sent" | "read";

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  type: ChatMessageType;
  text: string;
  image?: ChatImage;
  status: ChatMessageStatus;
  createdAt: string;
  readAt: string | null;
};

export type CoachRequest = {
  id: string;
  traineeId: string;
  coachId: string;
  coachName?: string;
  traineeName?: string;
  traineeGoal?: string;
  status: CoachRequestStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  respondedAt?: unknown;
  cancelledAt?: unknown;
  expiresAt?: unknown;
};

export type Assignment = {
  id: string;
  traineeId: string;
  coachId: string;
  threadId: string;
  status: "active" | "ended";
  sourceRequestId: string;
  startedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  endedAt?: unknown;
  endedBy?: string | null;
  endReason?: string | null;
  schemaVersion?: number;
};

export type ChatThread = {
  threadId: string;
  assignmentId: string;
  status: "active" | "ended";
  traineeId: string;
  coachId: string;
  participants: string[];
  lastMessageText: string;
  lastMessageType: ChatMessageType;
  lastMessageAt: unknown | null;
  lastSenderId: string | null;
  unreadByCoach: number;
  unreadByTrainee: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  endedAt?: unknown;
  schemaVersion?: number;
};

export type ClientSummary = {
  workoutsLast7Days?: number;
  mealsLast7Days?: number;
  avgDailyProtein?: number;
  lastWorkoutAt?: unknown;
  /**
   * The CLIENT-local calendar day of the most recent workout, as stored at
   * write time.
   *
   * Derived keys re-resolve against whatever timezone the client currently has,
   * so a client who moves timezone would silently rewrite the day of every
   * historical session. This pins it: the day a workout happened is decided
   * once, by the person who did it, and never changes afterwards.
   */
  lastWorkoutDateKey?: string;
  lastMealAt?: unknown;
  lastMessageAt?: unknown;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  unreadCoachCount?: number;
  /**
   * The most recent session where the client reported pain.
   *
   * Denormalised onto the summary the coach roster already reads, so pain can
   * drive the dashboard queue without a listener per client. V0 has no
   * scheduler and no functions; this is the smallest write that makes a safety
   * signal visible.
   */
  lastPainAt?: unknown;
  lastPainNote?: string;
  lastPainDateKey?: string;
  updatedAt?: unknown;
};

export type CoachNote = {
  id: string;
  traineeId: string;
  coachId: string;
  text: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CheckInTaskStatus = "open" | "completed" | "dismissed";

export type CheckInTask = {
  id: string;
  traineeId: string;
  coachId: string;
  title: string;
  description?: string;
  status: CheckInTaskStatus;
  dueDate?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown;
};

export type EventName =
  | "assignment_requested"
  | "assignment_approved"
  | "assignment_rejected"
  | "assignment_cancelled"
  | "chat_thread_created"
  | "coach_message_sent"
  | "coach_note_added"
  | "checkin_task_created"
  | "checkin_task_updated"
  | "client_summary_rebuilt"
  | "subscription_event_received"
  | "workout_completed"
  | "meal_logged"
  | "checkin_submitted"
  | "adherence_updated";

export type AuditEvent = {
  id: string;
  actorId: string;
  eventName: EventName;
  entityType:
    | "coachRequest"
    | "assignment"
    | "chatThread"
    | "workout"
    | "meal"
    | "profile"
    | "subscription"
    | "clientSummary"
    | "coachNote"
    | "checkInTask";
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
};
