import "server-only";

import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { z } from "zod";

import type { PendingAction } from "@/lib/assistant/types";
import type { SessionUser } from "@/lib/auth/session";
import { findConflicts, validateBookNow, validateSlot } from "@/lib/booking/availability";
import { bookNow, bookSlot, cancelBooking, listMyBookings } from "@/lib/booking/booking-service";
import { BOOKING_RULES } from "@/lib/booking/rules";
import { appConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { isGrabbable } from "@/lib/reconciliation/engine";
import { computeRoomStatuses } from "@/lib/reconciliation/room-status";
import type { LiveRoomStatus } from "@/lib/reconciliation/room-status-types";
import { listRooms, roomDistance, type RoomView } from "@/lib/rooms/rooms";

export type ToolContext = { user: SessionUser; now: Date; timeZone: string };
export type ToolOutcome = { result: unknown; pendingAction?: PendingAction };

// ---- time helpers (render in the user's timezone so the model never converts) ----

function timeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute"), wd: get("weekday") };
}

export function localLabel(date: Date, timeZone: string): string {
  const p = timeParts(date, timeZone);
  return `${p.wd} ${p.y}-${p.m}-${p.d} ${p.hh}:${p.mm}`;
}

function hhmm(date: Date, timeZone: string): string {
  const p = timeParts(date, timeZone);
  return `${p.hh}:${p.mm}`;
}

/** Offset (minutes, local − UTC) of a timezone at an instant. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = timeParts(date, timeZone);
  const asUtc = Date.UTC(Number(p.y), Number(p.m) - 1, Number(p.d), Number(p.hh), Number(p.mm));
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

export function isoWithOffset(date: Date, timeZone: string): string {
  const offset = tzOffsetMinutes(date, timeZone);
  const local = new Date(date.getTime() + offset * 60_000);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${local.toISOString().slice(0, 19)}${off}`;
}

/** Local midnight of a yyyy-mm-dd day in the user's timezone. */
function localDayStart(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60_000);
}

// ---- tool schemas ----

const isoDateTime = z.iso.datetime({ offset: true });

const findFreeRoomArgs = z.object({
  near: z.string().max(32).optional(),
  minCapacity: z.number().int().min(1).max(100).optional(),
  start: isoDateTime.optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  quiet: z.boolean().optional(),
  amenities: z.array(z.string().max(32)).max(5).optional(),
});
const roomArgs = z.object({ roomId: z.string().min(1).max(32) });
const availabilityArgs = roomArgs.extend({ date: z.iso.date().optional() });
const floorArgs = z.object({ floor: z.string().max(8).optional() });
const bookArgs = z.object({
  roomId: z.string().min(1).max(32),
  start: isoDateTime.optional(),
  durationMinutes: z.number().int().min(15).max(240),
});
const cancelArgs = z.object({ bookingId: z.string().min(1).max(64) });

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ChatCompletionFunctionTool {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
  };
}

const ROOM_ID = { type: "string", description: 'Room id like "N.1.42"' };
const START = {
  type: "string",
  description: "ISO 8601 start with the user's UTC offset, e.g. 2026-05-04T14:00:00+02:00. Omit for 'now'.",
};

export function toolDefinitions(role: SessionUser["role"]): ChatCompletionFunctionTool[] {
  const tools = [
    fn("get_floor_status", "Live status of every room (free / booked / in use / occupied / ghost booking, noise).", {
      floor: { type: "string", description: 'Optional floor filter, e.g. "Level 1"' },
    }),
    fn(
      "find_free_room",
      "Find rooms free for a time window (default: now for 60 min), ranked by proximity and quietness. Ghost-booked rooms count as available now.",
      {
        near: { ...ROOM_ID, description: "Rank rooms closest to this room id first" },
        minCapacity: { type: "integer" },
        start: START,
        durationMinutes: { type: "integer", description: "Default 60" },
        quiet: { type: "boolean", description: "Prefer quiet rooms" },
        amenities: { type: "array", items: { type: "string" }, description: "e.g. whiteboard, monitor, projector" },
      },
    ),
    fn("check_availability", "Bookings of one room on one day plus its live status.", {
      roomId: ROOM_ID,
      date: { type: "string", description: "yyyy-mm-dd in the user's timezone; default today" },
    }, ["roomId"]),
    fn(
      "book_room",
      "Propose a booking. Does NOT book: the user must press Confirm in the UI.",
      { roomId: ROOM_ID, start: START, durationMinutes: { type: "integer" } },
      ["roomId", "durationMinutes"],
    ),
    fn("cancel_booking", "Propose cancelling one of the user's bookings. The user must press Confirm.", {
      bookingId: { type: "string" },
    }, ["bookingId"]),
    fn("my_bookings", "The user's current and upcoming bookings (with booking ids).", {}),
    fn("explain_room", "Explain why a room shows its current status (sensor data vs booking).", { roomId: ROOM_ID }, [
      "roomId",
    ]),
  ];
  if (role === "ADMIN") {
    tools.push(fn("report_ghost_bookings", "Admin: all current ghost bookings with holder names.", {}));
  }
  return tools;
}

// ---- implementations ----

function describeStatus(s: LiveRoomStatus, ctx: ToolContext, includeNames: boolean) {
  const holder = s.activeBooking
    ? s.activeBooking.userId === ctx.user.id
      ? "you"
      : includeNames
        ? s.activeBooking.holderName
        : s.activeBooking.holderName.split(" ")[0]
    : undefined;
  return {
    roomId: s.roomId,
    state: s.state,
    sensorOnline: s.sensorOnline,
    occupied: s.sensorOnline ? s.occupied : "unknown",
    noise: s.noiseLevel ? `${s.noiseLevel} (${Math.round(s.noiseDb ?? 0)} dB)` : undefined,
    booking: s.activeBooking
      ? {
          holder,
          from: hhmm(new Date(s.activeBooking.start), ctx.timeZone),
          until: hhmm(new Date(s.activeBooking.end), ctx.timeZone),
          checkedIn: s.activeBooking.status === "CHECKED_IN",
        }
      : undefined,
    nextBookingAt: s.nextBooking ? hhmm(new Date(s.nextBooking.start), ctx.timeZone) : undefined,
  };
}

async function getFloorStatus(raw: unknown, ctx: ToolContext) {
  const { floor } = floorArgs.parse(raw);
  const [rooms, statuses] = await Promise.all([listRooms(), computeRoomStatuses({ now: ctx.now })]);
  const allowed = new Set(rooms.filter((r) => !floor || r.floor === floor).map((r) => r.id));
  return statuses.filter((s) => allowed.has(s.roomId)).map((s) => describeStatus(s, ctx, ctx.user.role === "ADMIN"));
}

async function blockingBookings(roomIds: string[], start: Date, end: Date) {
  return db.booking.findMany({
    where: { roomId: { in: roomIds }, start: { lt: end }, end: { gt: start } },
    select: { id: true, roomId: true, start: true, end: true, status: true },
  });
}

async function findFreeRoom(raw: unknown, ctx: ToolContext) {
  const args = findFreeRoomArgs.parse(raw);
  const duration = args.durationMinutes ?? 60;
  const start = args.start ? new Date(args.start) : ctx.now;
  const isNow = start.getTime() - ctx.now.getTime() < BOOKING_RULES.pastStartGraceMinutes * 60_000;
  const end = new Date(start.getTime() + duration * 60_000);

  const rooms = (await listRooms()).filter(
    (r) =>
      (!args.minCapacity || r.capacity >= args.minCapacity) &&
      (args.amenities ?? []).every((a) => r.amenities.some((x) => x.toLowerCase() === a.toLowerCase())),
  );
  const ids = rooms.map((r) => r.id);
  const [statuses, bookings] = await Promise.all([
    computeRoomStatuses({ roomIds: ids, now: ctx.now }),
    blockingBookings(ids, start, end),
  ]);
  const statusById = new Map(statuses.map((s) => [s.roomId, s]));

  const candidates = rooms.flatMap((room: RoomView) => {
    const status = statusById.get(room.id);
    const ghostId = isNow && status?.state === "ghost_booking" ? status.activeBooking?.id : undefined;
    if (isNow && status && !isGrabbable(status.state)) return [];
    const conflicts = findConflicts(
      bookings.filter((b) => b.roomId === room.id),
      { start, end },
    ).filter((b) => b.id !== ghostId);
    if (conflicts.length > 0) return [];
    return [{ room, status, ghost: Boolean(ghostId) }];
  });

  candidates.sort((a, b) => {
    const near = args.near ? roomDistance(args.near, a.room.id) - roomDistance(args.near, b.room.id) : 0;
    if (near !== 0) return near;
    if (args.quiet) {
      const noise = (a.status?.noiseDb ?? 50) - (b.status?.noiseDb ?? 50);
      if (Math.abs(noise) > 1) return noise;
    }
    return Number(a.ghost) - Number(b.ghost);
  });

  return {
    window: `${localLabel(start, ctx.timeZone)} – ${hhmm(end, ctx.timeZone)}${isNow ? " (now)" : ""}`,
    rooms: candidates.slice(0, 6).map(({ room, status, ghost }) => ({
      roomId: room.id,
      name: room.name,
      floor: room.floor,
      capacity: room.capacity,
      amenities: room.amenities,
      noise: status?.noiseLevel ? `${status.noiseLevel} (${Math.round(status.noiseDb ?? 0)} dB)` : "unknown",
      distance: args.near ? roomDistance(args.near, room.id) : undefined,
      note: ghost ? "Ghost booking: booked but empty — booking now releases the no-show booking." : undefined,
    })),
    totalMatches: candidates.length,
  };
}

async function checkAvailability(raw: unknown, ctx: ToolContext) {
  const { roomId, date } = availabilityArgs.parse(raw);
  const room = (await listRooms()).find((r) => r.id === roomId);
  if (!room) return { error: `Unknown room ${roomId}.` };
  const today = timeParts(ctx.now, ctx.timeZone);
  const day = date ?? `${today.y}-${today.m}-${today.d}`;
  const from = localDayStart(day, ctx.timeZone);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const [[status], bookings] = await Promise.all([
    computeRoomStatuses({ roomIds: [roomId], now: ctx.now }),
    db.booking.findMany({
      where: { roomId, status: { in: ["RESERVED", "CHECKED_IN"] }, start: { lt: to }, end: { gt: from } },
      select: { start: true, end: true, userId: true },
      orderBy: { start: "asc" },
    }),
  ]);
  return {
    room: { id: room.id, name: room.name, capacity: room.capacity, amenities: room.amenities },
    day,
    liveStatus: status ? describeStatus(status, ctx, false) : undefined,
    busy: bookings.map((b) => ({
      from: hhmm(b.start, ctx.timeZone),
      until: hhmm(b.end, ctx.timeZone),
      mine: b.userId === ctx.user.id,
    })),
  };
}

async function proposeBooking(raw: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const args = bookArgs.parse(raw);
  const room = (await listRooms()).find((r) => r.id === args.roomId);
  if (!room) return { result: { error: `Unknown room ${args.roomId}.` } };

  const start = args.start ? new Date(args.start) : undefined;
  const isNow = !start || start.getTime() - ctx.now.getTime() < BOOKING_RULES.pastStartGraceMinutes * 60_000;
  const effectiveStart = isNow ? ctx.now : start!;
  const end = new Date(effectiveStart.getTime() + args.durationMinutes * 60_000);

  const rule = isNow ? validateBookNow(args.durationMinutes) : validateSlot({ start: effectiveStart, end }, ctx.now);
  if (!rule.ok) return { result: { error: rule.error } };

  const [status] = isNow ? await computeRoomStatuses({ roomIds: [room.id], now: ctx.now }) : [];
  const ghostId = status?.state === "ghost_booking" ? status.activeBooking?.id : undefined;
  const conflicts = findConflicts(await blockingBookings([room.id], effectiveStart, end), {
    start: effectiveStart,
    end,
  }).filter((b) => b.id !== ghostId);
  if (conflicts.length > 0) {
    return {
      result: {
        error: `${room.id} is not free then (booked ${hhmm(conflicts[0].start, ctx.timeZone)}–${hhmm(conflicts[0].end, ctx.timeZone)}).`,
      },
    };
  }

  const when = isNow
    ? `now until ${hhmm(end, ctx.timeZone)}`
    : `${localLabel(effectiveStart, ctx.timeZone)}–${hhmm(end, ctx.timeZone)}`;
  const summary = `Book ${room.id} (${room.name}) ${when}${ghostId ? " — releases the ghost booking" : ""}`;
  const pendingAction: PendingAction = {
    type: "book_room",
    args: { roomId: room.id, start: isNow ? undefined : effectiveStart.toISOString(), durationMinutes: args.durationMinutes },
    summary,
  };
  return {
    result: { status: "awaiting_user_confirmation", summary, note: "Not booked yet. Ask the user to press Confirm." },
    pendingAction,
  };
}

async function proposeCancel(raw: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const { bookingId } = cancelArgs.parse(raw);
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, roomId: true, start: true, end: true, userId: true, status: true } });
  if (!booking || (booking.userId !== ctx.user.id && ctx.user.role !== "ADMIN")) {
    return { result: { error: "No such booking of yours. Call my_bookings to get booking ids." } };
  }
  if (booking.status !== "RESERVED" && booking.status !== "CHECKED_IN") {
    return { result: { error: "That booking is no longer active." } };
  }
  const summary = `Cancel your booking of ${booking.roomId}, ${localLabel(booking.start, ctx.timeZone)}–${hhmm(booking.end, ctx.timeZone)}`;
  return {
    result: { status: "awaiting_user_confirmation", summary, note: "Not cancelled yet. Ask the user to press Confirm." },
    pendingAction: { type: "cancel_booking", args: { bookingId }, summary },
  };
}

async function myBookings(_raw: unknown, ctx: ToolContext) {
  const { upcoming } = await listMyBookings(ctx.user.id, ctx.now);
  return upcoming.map((b) => ({
    bookingId: b.id,
    roomId: b.roomId,
    from: localLabel(new Date(b.start), ctx.timeZone),
    until: hhmm(new Date(b.end), ctx.timeZone),
    status: b.status,
  }));
}

async function explainRoom(raw: unknown, ctx: ToolContext) {
  const { roomId } = roomArgs.parse(raw);
  const [status] = await computeRoomStatuses({ roomIds: [roomId], now: ctx.now });
  if (!status) return { error: `Unknown room ${roomId}.` };
  const facts = describeStatus(status, ctx, ctx.user.role === "ADMIN");
  const reasons: Record<LiveRoomStatus["state"], string> = {
    free: "No active booking and the sensor sees nobody (or has no data).",
    occupied: "Nobody booked it, but the presence sensor detects people — someone is using it without a booking.",
    booked: status.sensorOnline
      ? `Booked, the holder is not there yet. If it stays empty it becomes a ghost booking${status.ghostAt ? ` at ${hhmm(new Date(status.ghostAt), ctx.timeZone)}` : ""}.`
      : "Booked. The sensor has no recent data, so it is never flagged as a ghost.",
    booked_in_use: "Booked and the sensor confirms people are inside (being in the room checks the holder in automatically).",
    ghost_booking: `Booked, but the sensor has reported it empty for longer than the grace period (${appConfig.ghostAfterMinutes} min after start without check-in). Anyone can book it now; that releases the no-show booking.`,
  };
  return { ...facts, explanation: reasons[status.state] };
}

async function reportGhosts(_raw: unknown, ctx: ToolContext) {
  if (ctx.user.role !== "ADMIN") return { error: "Admins only." };
  const statuses = await computeRoomStatuses({ now: ctx.now });
  return statuses
    .filter((s) => s.state === "ghost_booking")
    .map((s) => ({
      roomId: s.roomId,
      holder: s.activeBooking?.holderName,
      booked: s.activeBooking ? `${hhmm(new Date(s.activeBooking.start), ctx.timeZone)}–${hhmm(new Date(s.activeBooking.end), ctx.timeZone)}` : undefined,
      ghostSince: s.ghostAt ? hhmm(new Date(s.ghostAt), ctx.timeZone) : undefined,
    }));
}

const HANDLERS: Record<string, (raw: unknown, ctx: ToolContext) => Promise<unknown>> = {
  get_floor_status: getFloorStatus,
  find_free_room: findFreeRoom,
  check_availability: checkAvailability,
  my_bookings: myBookings,
  explain_room: explainRoom,
  report_ghost_bookings: reportGhosts,
};

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolOutcome> {
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { result: { error: "Arguments were not valid JSON." } };
  }
  try {
    if (name === "book_room") return await proposeBooking(args, ctx);
    if (name === "cancel_booking") return await proposeCancel(args, ctx);
    const handler = HANDLERS[name];
    if (!handler) return { result: { error: `Unknown tool ${name}.` } };
    return { result: await handler(args, ctx) };
  } catch (error) {
    if (error instanceof z.ZodError) return { result: { error: "Invalid arguments", issues: error.issues.map((i) => i.message) } };
    throw error;
  }
}

/** Runs a write the user explicitly confirmed. Re-checks everything via BookingService. */
export async function executeConfirmedAction(action: PendingAction, user: SessionUser, timeZone: string) {
  if (action.type === "cancel_booking") {
    return cancelBooking(user, action.args.bookingId);
  }
  const { roomId, start, durationMinutes } = action.args;
  const result = start
    ? await bookSlot(user, roomId, { start: new Date(start), end: new Date(new Date(start).getTime() + durationMinutes * 60_000) })
    : await bookNow(user, roomId, durationMinutes);
  if (!result.ok) return result;
  const message = `Booked ${roomId}, ${localLabel(new Date(result.data.start), timeZone)}–${hhmm(new Date(result.data.end), timeZone)}${result.data.releasedGhostBookingId ? " (the ghost booking was released)" : ""}.`;
  return { ...result, message };
}
