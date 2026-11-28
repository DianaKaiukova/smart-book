import "server-only";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { findConflicts } from "@/lib/booking/availability";
import type { SessionUser } from "@/lib/auth/session";
import { canBookRoomCategory, isStudent, type RoomCategory } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { seriesOccurrences } from "@/lib/courses/series";
import { minutesToLabel, WEEKDAY_LABELS } from "@/lib/time/zoned";

// All course / class / meeting mutations and reads. Each function enforces role
// and ownership itself (callers are Server Actions and pages).

type Actor = Pick<SessionUser, "id" | "role">;

const DURATION_MIN = 15;
const DURATION_MAX = 240; // 4h

type SeriesInput = {
  roomId: string;
  weekday: number;
  startMin: number;
  endMin: number;
  frequency: "WEEKLY" | "BIWEEKLY";
  startDate: Date;
  endDate: Date;
};

function validateSeriesInput(input: SeriesInput): string | null {
  if (input.weekday < 0 || input.weekday > 6) return "Pick a weekday.";
  const minutes = input.endMin - input.startMin;
  if (minutes < DURATION_MIN) return `Sessions must be at least ${DURATION_MIN} minutes.`;
  if (minutes > DURATION_MAX) return `Sessions can be at most ${DURATION_MAX / 60} hours.`;
  if (input.endDate < input.startDate) return "End date must be after the start date.";
  return null;
}

/** Create the series row + expand it into Booking rows, flagging conflicting weeks. */
async function materializeSeries(
  kind: "CLASS" | "MEETING",
  ownerId: string,
  title: string,
  courseId: string | null,
  input: SeriesInput,
): Promise<ActionResult<{ seriesId: string; created: number; conflicts: string[] }>> {
  return db.$transaction(async (tx) => {
    const series = await tx.bookingSeries.create({
      data: {
        kind,
        title,
        ownerId,
        roomId: input.roomId,
        courseId: courseId ?? undefined,
        weekday: input.weekday,
        startMin: input.startMin,
        endMin: input.endMin,
        frequency: input.frequency,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    const occ = seriesOccurrences(input);
    let created = 0;
    const conflicts: string[] = [];
    for (const o of occ) {
      const candidates = await tx.booking.findMany({
        where: { roomId: input.roomId, start: { lt: o.end }, end: { gt: o.start } },
        select: { id: true, start: true, end: true, status: true },
      });
      if (findConflicts(candidates, o).length > 0) {
        conflicts.push(o.start.toISOString());
        continue;
      }
      await tx.booking.create({
        data: {
          roomId: input.roomId,
          userId: ownerId,
          seriesId: series.id,
          courseId: courseId ?? undefined,
          start: o.start,
          end: o.end,
          kind,
        },
      });
      created += 1;
    }
    return ok(
      { seriesId: series.id, created, conflicts },
      created > 0
        ? `Scheduled ${created} session${created === 1 ? "" : "s"}${conflicts.length ? `; ${conflicts.length} week(s) skipped (room already booked).` : "."}`
        : "No sessions could be booked — the room is taken for every week. Try another room or time.",
    );
  });
}

// ---- Courses (teacher) ---------------------------------------------------

export async function createCourse(
  actor: Actor,
  input: { code: string; title: string; termStart: Date; termEnd: Date },
): Promise<ActionResult<{ id: string }>> {
  if (actor.role !== "TEACHER" && actor.role !== "ADMIN") return fail("Only teachers can create courses.");
  if (input.termEnd < input.termStart) return fail("Term end must be after the start.");
  const course = await db.course.create({
    data: {
      code: input.code,
      title: input.title,
      teacherId: actor.id,
      termStart: input.termStart,
      termEnd: input.termEnd,
    },
    select: { id: true },
  });
  return ok({ id: course.id }, "Course created.");
}

async function loadOwnedCourse(actor: Actor, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { ok: false as const, error: "Course not found." };
  if (course.teacherId !== actor.id && actor.role !== "ADMIN") {
    return { ok: false as const, error: "You can only manage your own courses." };
  }
  return { ok: true as const, course };
}

export async function addStudents(
  actor: Actor,
  courseId: string,
  emails: string[],
): Promise<ActionResult<{ added: number; matched: number; pending: number }>> {
  const loaded = await loadOwnedCourse(actor, courseId);
  if (!loaded.ok) return fail(loaded.error);

  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) return fail("Add at least one email.");

  const students = await db.user.findMany({
    where: { email: { in: clean } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(students.map((s) => [s.email, s.id]));

  let matched = 0;
  let pending = 0;
  for (const email of clean) {
    const studentId = byEmail.get(email);
    if (studentId) matched += 1;
    else pending += 1;
    await db.enrollment.upsert({
      where: { courseId_email: { courseId, email } },
      create: {
        courseId,
        email,
        studentId: studentId ?? undefined,
        status: studentId ? "ACTIVE" : "PENDING",
      },
      update: studentId ? { studentId, status: "ACTIVE" } : {},
    });
  }
  return ok(
    { added: clean.length, matched, pending },
    `${clean.length} on the roster — ${matched} active, ${pending} pending sign-up.`,
  );
}

export async function scheduleClass(
  actor: Actor,
  courseId: string,
  input: Omit<SeriesInput, "startDate" | "endDate">,
): Promise<ActionResult<{ seriesId: string; created: number; conflicts: string[] }>> {
  const loaded = await loadOwnedCourse(actor, courseId);
  if (!loaded.ok) return fail(loaded.error);
  const full: SeriesInput = { ...input, startDate: loaded.course.termStart, endDate: loaded.course.termEnd };
  const error = validateSeriesInput(full);
  if (error) return fail(error);
  const room = await db.room.findUnique({ where: { id: input.roomId }, select: { id: true } });
  if (!room) return fail("Room not found.");
  return materializeSeries("CLASS", loaded.course.teacherId, loaded.course.title, courseId, full);
}

// ---- Student recurring meetings ------------------------------------------

export async function createMeeting(
  actor: Actor,
  input: { title: string } & SeriesInput,
): Promise<ActionResult<{ seriesId: string; created: number; conflicts: string[] }>> {
  const error = validateSeriesInput(input);
  if (error) return fail(error);
  const room = await db.room.findUnique({ where: { id: input.roomId }, select: { id: true, category: true } });
  if (!room) return fail("Room not found.");
  if (!canBookRoomCategory(actor.role, room.category as RoomCategory | null)) {
    return fail("Students can only book study and meeting rooms.");
  }
  const title = input.title.trim() || "Study group";
  return materializeSeries("MEETING", actor.id, title, null, input);
}

/** Delete a series and cancel its future bookings. */
export async function cancelSeries(actor: Actor, seriesId: string): Promise<ActionResult<{ id: string }>> {
  const series = await db.bookingSeries.findUnique({ where: { id: seriesId }, select: { id: true, ownerId: true } });
  if (!series) return fail("Series not found.");
  if (series.ownerId !== actor.id && actor.role !== "ADMIN") return fail("You can only cancel your own series.");
  await db.bookingSeries.delete({ where: { id: seriesId } }); // bookings cascade
  return ok({ id: seriesId }, "Series cancelled.");
}

// ---- Queries -------------------------------------------------------------

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  studentCount: number;
  schedule: string[]; // e.g. ["Mon 09:00–11:00 · N.1.42"]
};

function scheduleLabel(s: {
  weekday: number;
  startMin: number;
  endMin: number;
  frequency: string;
  roomId: string;
}): string {
  const every = s.frequency === "BIWEEKLY" ? "biweekly " : "";
  return `${every}${WEEKDAY_LABELS[s.weekday]} ${minutesToLabel(s.startMin)}–${minutesToLabel(s.endMin)} · ${s.roomId}`;
}

export async function listTeacherCourses(teacherId: string): Promise<CourseSummary[]> {
  const rows = await db.course.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      _count: { select: { enrollments: true } },
      series: { select: { weekday: true, startMin: true, endMin: true, frequency: true, roomId: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    studentCount: c._count.enrollments,
    schedule: c.series.map(scheduleLabel),
  }));
}

export type CourseDetail = {
  id: string;
  code: string;
  title: string;
  roster: { email: string; name: string | null; status: string }[];
  series: { id: string; label: string }[];
};

export async function getCourseDetail(actor: Actor, courseId: string): Promise<CourseDetail | null> {
  const loaded = await loadOwnedCourse(actor, courseId);
  if (!loaded.ok) return null;
  const [enrollments, series] = await Promise.all([
    db.enrollment.findMany({
      where: { courseId },
      orderBy: { email: "asc" },
      select: { email: true, status: true, student: { select: { name: true } } },
    }),
    db.bookingSeries.findMany({
      where: { courseId },
      select: { id: true, weekday: true, startMin: true, endMin: true, frequency: true, roomId: true },
    }),
  ]);
  return {
    id: loaded.course.id,
    code: loaded.course.code,
    title: loaded.course.title,
    roster: enrollments.map((e) => ({ email: e.email, name: e.student?.name ?? null, status: e.status })),
    series: series.map((s) => ({ id: s.id, label: scheduleLabel(s) })),
  };
}

export type CalendarEvent = {
  id: string;
  title: string;
  roomId: string;
  roomName: string;
  start: string;
  end: string;
  source: "class" | "meeting" | "booking" | "study";
  mine: boolean;
};

/** Everything on a user's calendar in [from, to): their own bookings plus,
 *  for students, the sessions of courses they're enrolled in. */
export async function listCalendarEvents(
  user: Pick<SessionUser, "id" | "role">,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  let enrolledCourseIds: string[] = [];
  if (isStudent(user.role)) {
    const enr = await db.enrollment.findMany({
      where: { studentId: user.id, status: "ACTIVE" },
      select: { courseId: true },
    });
    enrolledCourseIds = enr.map((e) => e.courseId);
  }

  const rows = await db.booking.findMany({
    where: {
      status: { in: ["RESERVED", "CHECKED_IN", "COMPLETED"] },
      start: { lt: to },
      end: { gt: from },
      OR: [{ userId: user.id }, ...(enrolledCourseIds.length ? [{ courseId: { in: enrolledCourseIds } }] : [])],
    },
    orderBy: { start: "asc" },
    select: {
      id: true,
      roomId: true,
      start: true,
      end: true,
      kind: true,
      userId: true,
      room: { select: { name: true } },
      series: { select: { title: true } },
      course: { select: { code: true, title: true } },
      deadline: { select: { title: true } },
    },
  });

  return rows.map((r) => {
    const source: CalendarEvent["source"] =
      r.kind === "CLASS"
        ? "class"
        : r.kind === "MEETING"
          ? "meeting"
          : r.kind === "STUDY"
            ? "study"
            : "booking";
    const title =
      source === "class" && r.course
        ? `${r.course.code} · ${r.course.title}`
        : source === "meeting"
          ? (r.series?.title ?? "Study group")
          : source === "study"
            ? `Study: ${r.deadline?.title ?? "focus"}`
            : r.room.name;
    return {
      id: r.id,
      title,
      roomId: r.roomId,
      roomName: r.room.name,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      source,
      mine: r.userId === user.id,
    };
  });
}
