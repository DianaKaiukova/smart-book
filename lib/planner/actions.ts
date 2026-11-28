"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/lib/auth/session";
import {
  addDeadline,
  clearStudyPlan,
  deleteDeadline,
  generateStudyPlan,
  type PlanResult,
} from "@/lib/planner/planner-service";

const NOT_SIGNED_IN = "Please sign in again.";

const addDeadlineSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subject: z.string().trim().max(60).optional().default(""),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  hours: z.coerce.number().min(0.5).max(100),
});

export async function addDeadlineAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = addDeadlineSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid deadline.");
  const [y, m, d] = parsed.data.dueDate.split("-").map(Number);
  const dueDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 0)); // end of the due day
  const result = await addDeadline(user, {
    title: parsed.data.title,
    subject: parsed.data.subject,
    dueDate,
    hours: parsed.data.hours,
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteDeadlineAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = z.string().min(1).max(64).safeParse(id);
  if (!parsed.success) return fail("Invalid deadline.");
  const result = await deleteDeadline(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function generatePlanAction(): Promise<ActionResult<PlanResult>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const result = await generateStudyPlan(user);
  if (result.ok) refresh();
  return result;
}

export async function clearPlanAction(): Promise<ActionResult<{ cleared: number }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const result = await clearStudyPlan(user);
  if (result.ok) refresh();
  return result;
}
