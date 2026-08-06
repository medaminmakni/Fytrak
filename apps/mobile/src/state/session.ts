import type { AssignmentStatus, SessionState, UserRole } from "./types";

export const defaultSessionData = {
  role: "trainee" as UserRole,
  profileCompleted: false,
  assignmentStatus: "unassigned" as AssignmentStatus,
  selectedCoachId: null as string | null,
  selectedCoachName: null as string | null,
};

export const initialSessionState: SessionState = {
  isAuthenticated: false,
  ...defaultSessionData,
};

const normalizeAssignmentStatus = (value: unknown): AssignmentStatus => {
  return value === "pending" ||
    value === "assigned" ||
    value === "rejected" ||
    value === "expired"
    ? value
    : "unassigned";
};

const normalizeRole = (value: unknown): UserRole => {
  return value === "coach" ? "coach" : "trainee";
};

export const toSessionState = (input: any): SessionState => {
  return {
    isAuthenticated: true,
    role: normalizeRole(input?.role),
    profileCompleted: Boolean(input?.profileCompleted),
    assignmentStatus: normalizeAssignmentStatus(input?.assignmentStatus),
    selectedCoachId: typeof input?.selectedCoachId === "string" ? input.selectedCoachId : null,
    selectedCoachName: typeof input?.selectedCoachName === "string" ? input.selectedCoachName : null,
  };
};

export const authenticatedSessionState = (
  overrides: Partial<SessionState> = {}
): SessionState => ({
  ...initialSessionState,
  isAuthenticated: true,
  ...overrides,
});
