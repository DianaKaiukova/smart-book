// Central role model. MEMBER is the legacy student role; STUDENT is the same
// thing for new accounts. TEACHER schedules classes; ADMIN is facilities.

export type AppRole = "MEMBER" | "STUDENT" | "TEACHER" | "ADMIN";

export const APP_ROLES: readonly AppRole[] = ["MEMBER", "STUDENT", "TEACHER", "ADMIN"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export function isAdmin(role: AppRole): boolean {
  return role === "ADMIN";
}

export function isTeacher(role: AppRole): boolean {
  return role === "TEACHER";
}

/** MEMBER and STUDENT are both "students". */
export function isStudent(role: AppRole): boolean {
  return role === "STUDENT" || role === "MEMBER";
}

/** A human label for a role. */
export function roleLabel(role: AppRole): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "TEACHER":
      return "Teacher";
    default:
      return "Student";
  }
}

export type RoomCategory = "LECTURE" | "SEMINAR" | "LAB" | "STUDY" | "MEETING";

/** Students may only book STUDY / MEETING rooms; teachers and admins book anything.
 *  Rooms with no category yet are treated as student-bookable (backward compatible). */
export function canBookRoomCategory(role: AppRole, category: RoomCategory | null | undefined): boolean {
  if (isAdmin(role) || isTeacher(role)) return true;
  return category == null || category === "STUDY" || category === "MEETING";
}
