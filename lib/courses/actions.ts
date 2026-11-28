"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/lib/auth/session";
import {
  addStudents,
  cancelSeries,
  createCourse,
  createMeeting,
  scheduleClass,
} from "@/lib/courses/courses-service";

// Server Actions: authenticate + validate inside each one.

const NOT_SIGNED_IN = "Please sign in again.";

/** "YYYY-MM-DD" → a Date at campus-local noon (stable under tz conversion). */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .transform((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  });

const roomIdSchema = z.string().min(1).max(32);
const seriesCore = {
  roomId: roomIdSchema,
  weekday: z.coerce.number().int().min(0).max(6),
  startMin: z.coerce.number().int().min(0).max(1439),
  endMin: z.coerce.number().int().min(1).max(1440),
  frequency: z.enum(["WEEKLY", "BIWEEKLY"]),
};

const createCourseSchema = z.object({
  code: z.string().trim().min(1).max(20),
  title: z.string().trim().min(2).max(120),
  termStart: dateOnly,
  termEnd: dateOnly,
});

export async function createCourseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid course.");
  const result = await createCourse(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

const addStudentsSchema = z.object({
  courseId: z.string().min(1).max(64),
  emails: z.string().min(1).max(5000),
});

export async function addStudentsAction(
  input: unknown,
): Promise<ActionResult<{ added: number; matched: number; pending: number }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = addStudentsSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid roster input.");
  const emails = parsed.data.emails.split(/[\s,;]+/).filter(Boolean);
  const result = await addStudents(user, parsed.data.courseId, emails);
  if (result.ok) refresh();
  return result;
}

const scheduleClassSchema = z.object({ courseId: z.string().min(1).max(64), ...seriesCore });

export async function scheduleClassAction(
  input: unknown,
): Promise<ActionResult<{ seriesId: string; created: number; conflicts: string[] }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = scheduleClassSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid class schedule.");
  const { courseId, ...rule } = parsed.data;
  const result = await scheduleClass(user, courseId, rule);
  if (result.ok) refresh();
  return result;
}

const createMeetingSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  startDate: dateOnly,
  endDate: dateOnly,
  ...seriesCore,
});

export async function createMeetingAction(
  input: unknown,
): Promise<ActionResult<{ seriesId: string; created: number; conflicts: string[] }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid meeting.");
  const { title, ...rest } = parsed.data;
  const result = await createMeeting(user, { title, ...rest });
  if (result.ok) refresh();
  return result;
}

export async function cancelSeriesAction(seriesId: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = z.string().min(1).max(64).safeParse(seriesId);
  if (!parsed.success) return fail("Invalid series.");
  const result = await cancelSeries(user, parsed.data);
  if (result.ok) refresh();
  return result;
}
