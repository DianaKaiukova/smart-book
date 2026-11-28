import "server-only";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isStudent } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addDays, compareYmd, localYmd, wallToUtc, type Ymd } from "@/lib/time/zoned";

// The study planner: reads a student's real busy time (classes, meetings,
// bookings), finds free gaps, and books spaced focus blocks before each deadline.

type Actor = Pick<SessionUser, "id" | "role">;

const BLOCK_MIN = 90; // length of a focus block
const DAY_START = 9 * 60; // 09:00
const DAY_END = 20 * 60; // 20:00
const STEP = 60; // candidate start granularity

type Interval = { start: number; end: number };

function overlaps(aStart: number, aEnd: number, b: Interval): boolean {
  return aStart < b.end && b.start < aEnd;
}

function daysBetween(from: Ymd, to: Ymd): Ymd[] {
  const out: Ymd[] = [];
  let cur = from;
  for (let i = 0; i < 200 && compareYmd(cur, to) <= 0; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Pick `count` days spread as evenly as possible across `days`. */
function spreadDays(days: Ymd[], count: number): Ymd[] {
  if (count >= days.length) return days;
  const picked = new Map<string, Ymd>();
  for (let i = 0; i < count; i++) {
    const idx = count === 1 ? 0 : Math.round((i * (days.length - 1)) / (count - 1));
    const d = days[idx];
    picked.set(`${d.y}-${d.m}-${d.d}`, d);
  }
  return [...picked.values()];
}

/** First free 90-min slot on a day that the student isn't already busy in. */
function findSlotForDay(day: Ymd, busy: Interval[], now: Date): { start: Date; end: Date } | null {
  for (let m = DAY_START; m + BLOCK_MIN <= DAY_END; m += STEP) {
    const start = wallToUtc(day, m);
    const end = wallToUtc(day, m + BLOCK_MIN);
    if (start.getTime() <= now.getTime()) continue;
    if (busy.some((b) => overlaps(start.getTime(), end.getTime(), b))) continue;
    return { start, end };
  }
  return null;
}

async function firstFreeStudyRoom(roomIds: string[], start: Date, end: Date): Promise<string | null> {
  for (const roomId of roomIds) {
    const clash = await db.booking.findFirst({
      where: {
        roomId,
        status: { in: ["RESERVED", "CHECKED_IN", "COMPLETED"] },
        start: { lt: end },
        end: { gt: start },
      },
      select: { id: true },
    });
    if (!clash) return roomId;
  }
  return null;
}

async function studentBusyIntervals(user: Actor, from: Date, to: Date): Promise<Interval[]> {
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
    select: { start: true, end: true },
  });
  return rows.map((r) => ({ start: r.start.getTime(), end: r.end.getTime() }));
}

// ---- Deadlines -----------------------------------------------------------

export async function addDeadline(
  actor: Actor,
  input: { title: string; subject?: string; dueDate: Date; hours: number },
): Promise<ActionResult<{ id: string }>> {
  if (input.dueDate.getTime() <= Date.now()) return fail("The due date must be in the future.");
  if (input.hours <= 0 || input.hours > 100) return fail("Enter a realistic number of study hours.");
  const d = await db.deadline.create({
    data: {
      userId: actor.id,
      title: input.title,
      subject: input.subject || null,
      dueDate: input.dueDate,
      hours: input.hours,
    },
    select: { id: true },
  });
  return ok({ id: d.id }, "Deadline added.");
}

export async function deleteDeadline(actor: Actor, id: string): Promise<ActionResult<{ id: string }>> {
  const d = await db.deadline.findUnique({ where: { id }, select: { userId: true } });
  if (!d || d.userId !== actor.id) return fail("Deadline not found.");
  await db.deadline.delete({ where: { id } }); // study blocks keep but unlink (SetNull)
  await db.booking.deleteMany({ where: { deadlineId: id, kind: "STUDY", start: { gt: new Date() } } });
  return ok({ id }, "Deadline removed.");
}

export type DeadlineView = {
  id: string;
  title: string;
  subject: string | null;
  dueDate: string;
  hours: number;
  plannedBlocks: number;
};

export async function listDeadlines(userId: string): Promise<DeadlineView[]> {
  const rows = await db.deadline.findMany({
    where: { userId },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      subject: true,
      dueDate: true,
      hours: true,
      _count: { select: { blocks: true } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    title: d.title,
    subject: d.subject,
    dueDate: d.dueDate.toISOString(),
    hours: d.hours,
    plannedBlocks: d._count.blocks,
  }));
}

// ---- The planner ---------------------------------------------------------

export type PlanResult = {
  booked: number;
  perDeadline: { title: string; placed: number; needed: number }[];
};

/** Clear future study blocks and re-plan from scratch (self-healing). */
export async function generateStudyPlan(actor: Actor): Promise<ActionResult<PlanResult>> {
  const now = new Date();
  await db.booking.deleteMany({ where: { userId: actor.id, kind: "STUDY", start: { gt: now } } });

  const deadlines = await db.deadline.findMany({
    where: { userId: actor.id, dueDate: { gt: now } },
    orderBy: { dueDate: "asc" },
  });
  if (deadlines.length === 0) return fail("Add a deadline first, then generate a plan.");

  const lastDue = deadlines[deadlines.length - 1].dueDate;
  const busy = await studentBusyIntervals(actor, now, lastDue);
  const rooms = await db.room.findMany({
    where: { category: { in: ["STUDY", "MEETING"] } },
    select: { id: true },
  });
  const roomIds = rooms.map((r) => r.id);

  const perDeadline: PlanResult["perDeadline"] = [];
  let booked = 0;

  for (const d of deadlines) {
    const needed = Math.max(1, Math.ceil(d.hours / (BLOCK_MIN / 60)));
    const fromYmd = localYmd(now);
    const toYmd = localYmd(new Date(d.dueDate.getTime() - 86_400_000)); // day before the deadline
    let days = daysBetween(fromYmd, toYmd);
    if (days.length === 0) days = [localYmd(now)];
    const targetDays = spreadDays(days, needed);

    let placed = 0;
    for (const day of targetDays) {
      const slot = findSlotForDay(day, busy, now);
      if (!slot) continue;
      const roomId = await firstFreeStudyRoom(roomIds, slot.start, slot.end);
      if (!roomId) continue;
      await db.booking.create({
        data: { roomId, userId: actor.id, kind: "STUDY", deadlineId: d.id, start: slot.start, end: slot.end },
      });
      busy.push({ start: slot.start.getTime(), end: slot.end.getTime() });
      placed += 1;
      booked += 1;
    }
    perDeadline.push({ title: d.title, placed, needed });
  }

  return ok(
    { booked, perDeadline },
    booked > 0
      ? `Planned ${booked} focus block${booked === 1 ? "" : "s"} around your classes.`
      : "Couldn't find free gaps — your schedule may already be full.",
  );
}

/** Remove all future study blocks. */
export async function clearStudyPlan(actor: Actor): Promise<ActionResult<{ cleared: number }>> {
  const res = await db.booking.deleteMany({ where: { userId: actor.id, kind: "STUDY", start: { gt: new Date() } } });
  return ok({ cleared: res.count }, res.count ? `Cleared ${res.count} study block(s).` : "No study blocks to clear.");
}
