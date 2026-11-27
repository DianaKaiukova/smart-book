"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { reclaimGhostBooking } from "@/lib/booking/booking-service";
import { db } from "@/lib/db";
import { resetDemoBookings } from "@/lib/occupancy/sim-scenario";
import { getSimulator } from "@/lib/occupancy/source";
import { clearSignals } from "@/lib/occupancy/store";

async function admin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user?.role === "ADMIN" ? user : null;
}

const FORBIDDEN = "Admins only.";
const roomIdSchema = z.string().trim().regex(/^[A-Za-z]+\.\d+\.\d+[a-z]?$/, 'Room id must look like "N.1.42" or "N.0.14a".').max(32);

export async function reclaimGhostAction(roomId: unknown): Promise<ActionResult<{ bookingId: string; holderName: string }>> {
  const user = await admin();
  if (!user) return fail(FORBIDDEN);
  const parsed = z.string().min(1).max(32).safeParse(roomId);
  if (!parsed.success) return fail("Invalid room.");
  const result = await reclaimGhostBooking(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

// ---- Room CRUD ----

const roomSchema = z.object({
  id: roomIdSchema,
  name: z.string().trim().min(1, "Name is required.").max(60),
  floor: z.string().trim().min(1, "Floor is required.").max(8),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1.").max(200),
  amenities: z
    .string()
    .max(200)
    .transform((s) => [...new Set(s.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean))].slice(0, 10)),
});

export type RoomFormState = { error?: string; success?: string } | undefined;

function readRoomForm(formData: FormData) {
  return roomSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    floor: formData.get("floor"),
    capacity: formData.get("capacity"),
    amenities: formData.get("amenities") ?? "",
  });
}

export async function createRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  if (!(await admin())) return { error: FORBIDDEN };
  const parsed = readRoomForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid room." };
  const { amenities, ...room } = parsed.data;
  const exists = await db.room.findUnique({ where: { id: room.id }, select: { id: true } });
  if (exists) return { error: `Room ${room.id} already exists.` };
  await db.room.create({ data: { ...room, amenities: JSON.stringify(amenities) } });
  refresh();
  return { success: `Created ${room.id}.` };
}

export async function updateRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  if (!(await admin())) return { error: FORBIDDEN };
  const parsed = readRoomForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid room." };
  const { amenities, id, ...room } = parsed.data;
  const updated = await db.room.updateMany({ where: { id }, data: { ...room, amenities: JSON.stringify(amenities) } });
  if (updated.count === 0) return { error: `Room ${id} no longer exists.` };
  refresh();
  return { success: `Saved ${id}.` };
}

export async function deleteRoomAction(roomId: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await admin())) return fail(FORBIDDEN);
  const parsed = z.string().min(1).max(32).safeParse(roomId);
  if (!parsed.success) return fail("Invalid room.");
  const active = await db.booking.count({
    where: { roomId: parsed.data, status: { in: ["RESERVED", "CHECKED_IN"] }, end: { gt: new Date() } },
  });
  if (active > 0) return fail(`${parsed.data} has ${active} active or upcoming booking(s). Cancel them first.`);
  await db.room.delete({ where: { id: parsed.data } }).catch(() => undefined);
  refresh();
  return ok({ id: parsed.data }, `Deleted ${parsed.data}.`);
}

// ---- Simulator controls (demo only) ----

const overrideSchema = z.object({
  roomId: z.string().min(1).max(32),
  occupied: z.boolean().nullable(),
});

export async function setSimOccupancyAction(input: unknown): Promise<ActionResult> {
  if (!(await admin())) return fail(FORBIDDEN);
  const sim = getSimulator();
  if (!sim) return fail("The simulator is off (OCCUPANCY_SOURCE=board).");
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid override.");
  if (parsed.data.occupied === null) sim.clearManual(parsed.data.roomId);
  else sim.setManual(parsed.data.roomId, { occupied: parsed.data.occupied });
  return ok(undefined);
}

export async function restartDemoAction(): Promise<ActionResult> {
  if (!(await admin())) return fail(FORBIDDEN);
  const sim = getSimulator();
  if (!sim) return fail("The simulator is off (OCCUPANCY_SOURCE=board).");
  await resetDemoBookings();
  clearSignals();
  sim.restartScenario();
  refresh();
  return ok(undefined, "Demo scenario restarted.");
}
