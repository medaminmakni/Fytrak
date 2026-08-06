import type {
  AssignmentStatus as SharedAssignmentStatus,
  UserRole as SharedUserRole,
} from "../../../../packages/shared/src";

export type UserRole = Exclude<SharedUserRole, "admin">;
export type AssignmentStatus = SharedAssignmentStatus;

export type SessionState = {
  isAuthenticated: boolean;
  role: UserRole;
  profileCompleted: boolean;
  assignmentStatus: AssignmentStatus;
  selectedCoachId: string | null;
  selectedCoachName: string | null;
};
