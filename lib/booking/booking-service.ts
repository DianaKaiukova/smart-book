import "server-only";

import {
  bookNowRange,
  canCheckIn,
  findConflicts,
  validateBookNow,
  validateSlot,
  type TimeRange,
} from "@/lib/booking/availability";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getRoomStatus } from "@/lib/reconciliation/room-status";

// BookingService: the only place that mutates bookings. Every function takes the
// acting user and enforces ownership/role itself (callers may be actions, routes or
// assistant tools).

type Actor = Pick<SessionUser, "id" | "role">;

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export type CreatedBooking = {
  id: string;
  roomId: string;
  start: string;
  end: string;
  /** Set when the booking took over a ghost booking. */
  releasedGhostBookingId?: string;
};

async function createBooking(
  actor: Actor,
  roomId: string,
  range: TimeRange,
  kind: "NOW" | "SCHEDULED",
): Promise<ActionResult<CreatedBooking>> {
  const room = await db.room.findUnique({ where: { id: roomId }, select: { id: true } });
  if (!room) return fail(`Room ${roomId} does not exist.`);

  // Hero flow: a member may take over a ghost booking for an immediate booking.
  let grabbableGhostId: string | undefined;
  if (kind === "NOW") {
    const status = await getRoomStatus(roomId);
    if (status?.state === "ghost_booking" && status.activeBooking?.userId !== actor.id) {
      grabbableGhostId = status.activeBooking?.id;
    }
  }

  return db.$transaction(async (tx) => {
    const candidates = await tx.booking.findMany({
      where: { roomId, start: { lt: range.end }, end: { gt: range.start } },
      select: { id: true, start: true, end: true, status: true },
    });
    const conflicts = findConflicts(candidates, range).filter((b) => b.id !== grabbableGhostId);
    if (conflicts.length > 0) {
      const first = conflicts[0];
      return fail(
        `${roomId} is already booked ${timeFormat.format(first.start)}–${timeFormat.format(first.end)}.`,
      );
    }

    const releasedGhost =
      grabbableGhostId && candidates.some((b) => b.id === grabbableGhostId)
        ? await tx.booking.updateMany({
            where: { id: grabbableGhostId, status: { in: ["RESERVED", "CHECKED_IN"] } },
            data: { status: "GHOST_RELEASED" },
          })
        : undefined;

    const booking = await tx.booking.create({
      data: { roomId, userId: actor.id, start: range.start, end: range.end, kind },
    });

    return ok({
      id: booking.id,
      roomId,
      start: booking.start.toISOString(),
      end: booking.end.toISOString(),
      releasedGhostBookingId: releasedGhost?.count ? grabbableGhostId : undefined,
    });
  });
}

export async function bookNow(
  actor: Actor,
  roomId: string,
  minutes: number,
  now = new Date(),
): Promise<ActionResult<CreatedBooking>> {
  const rule = validateBookNow(minutes);
  if (!rule.ok) return rule;
  return createBooking(actor, roomId, bookNowRange(now, minutes), "NOW");
}

export async function bookSlot(
  actor: Actor,
  roomId: string,
  range: TimeRange,
  now = new Date(),
): Promise<ActionResult<CreatedBooking>> {
  const rule = validateSlot(range, now);
  if (!rule.ok) return rule;
  return createBooking(actor, roomId, range, "SCHEDULED");
}

async function loadOwnedBooking(actor: Actor, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false as const, error: "Booking not found." };
  if (booking.userId !== actor.id && actor.role !== "ADMIN") {
    return { ok: false as const, error: "You can only change your own bookings." };
  }
  return { ok: true as const, booking };
}

export async function cancelBooking(
  actor: Actor,
  bookingId: string,
  now = new Date(),
): Promise<ActionResult<{ id: string }>> {
  const loaded = await loadOwnedBooking(actor, bookingId);
  if (!loaded.ok) return fail(loaded.error);
  const { booking } = loaded;
  if (booking.status !== "RESERVED" && booking.status !== "CHECKED_IN") {
    return fail("This booking can no longer be cancelled.");
  }
  if (booking.end <= now) return fail("This booking has already ended.");
  await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  return ok({ id: booking.id }, "Booking cancelled.");
}

export async function checkIn(
  actor: Actor,
  bookingId: string,
  now = new Date(),
): Promise<ActionResult<{ id: string }>> {
  const loaded = await loadOwnedBooking(actor, bookingId);
  if (!loaded.ok) return fail(loaded.error);
  const rule = canCheckIn(loaded.booking, now);
  if (!rule.ok) return rule;
  await db.booking.update({
    where: { id: bookingId },
    data: { status: "CHECKED_IN", checkedInAt: now },
  });
  return ok({ id: bookingId }, "Checked in.");
}

/** Admin reclaim of a ghost booking → GHOST_RELEASED (frees the slot). */
export async function reclaimGhostBooking(
  actor: Actor,
  roomId: string,
): Promise<ActionResult<{ bookingId: string; holderName: string }>> {
  if (actor.role !== "ADMIN") return fail("Only admins can reclaim ghost bookings.");
  const status = await getRoomStatus(roomId);
  if (!status) return fail(`Room ${roomId} does not exist.`);
  if (status.state !== "ghost_booking" || !status.activeBooking) {
    return fail(`${roomId} is not a ghost booking right now.`);
  }
  const { id, holderName } = status.activeBooking;
  const updated = await db.booking.updateMany({
    where: { id, status: { in: ["RESERVED", "CHECKED_IN"] } },
    data: { status: "GHOST_RELEASED" },
  });
  if (updated.count === 0) return fail("The booking changed in the meantime.");
  return ok({ bookingId: id, holderName }, `Released ${roomId}. ${holderName} has been notified.`);
}

// ---- Queries -------------------------------------------------------------

export type BookingView = {
  id: string;
  roomId: string;
  roomName: string;
  start: string;
  end: string;
  kind: "NOW" | "SCHEDULED" | "CLASS" | "MEETING";
  status: "RESERVED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "GHOST_RELEASED";
  checkedInAt: string | null;
};

const bookingViewSelect = {
  id: true,
  roomId: true,
  start: true,
  end: true,
  kind: true,
  status: true,
  checkedInAt: true,
  room: { select: { name: true } },
} as const;

type BookingRow = {
  id: string;
  roomId: string;
  start: Date;
  end: Date;
  kind: BookingView["kind"];
  status: BookingView["status"];
  checkedInAt: Date | null;
  room: { name: string };
};

function toView(row: BookingRow): BookingView {
  return {
    id: row.id,
    roomId: row.roomId,
    roomName: row.room.name,
    start: row.start.toISOString(),
    end: row.end.toISOString(),
    kind: row.kind,
    status: row.status,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
  };
}

/** The user's current + upcoming bookings, plus recent history. */
export async function listMyBookings(userId: string, now = new Date()) {
  const recentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [upcoming, history] = await Promise.all([
    db.booking.findMany({
      where: { userId, status: { in: ["RESERVED", "CHECKED_IN"] }, end: { gt: now } },
      select: bookingViewSelect,
      orderBy: { start: "asc" },
    }),
    db.booking.findMany({
      where: {
        userId,
        start: { gte: recentFrom },
        OR: [
          { status: { in: ["COMPLETED", "CANCELLED", "GHOST_RELEASED"] } },
          { end: { lte: now } },
        ],
      },
      select: bookingViewSelect,
      orderBy: { start: "desc" },
      take: 20,
    }),
  ]);
  return { upcoming: upcoming.map(toView), history: history.map(toView) };
}

/** Busy intervals for a room's calendar (no holder identities). */
export async function listRoomBusySlots(roomId: string, from: Date, to: Date | null, viewerId: string) {
  const rows = await db.booking.findMany({
    where: {
      roomId,
      status: { in: ["RESERVED", "CHECKED_IN", "COMPLETED"] },
      ...(to ? { start: { lt: to } } : {}),
      end: { gt: from },
    },
    select: { id: true, start: true, end: true, userId: true },
    orderBy: { start: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
    isMine: r.userId === viewerId,
  }));
}

export type AdminBookingView = BookingView & { holderName: string; holderEmail: string };

export async function listAllBookings(now = new Date()): Promise<AdminBookingView[]> {
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await db.booking.findMany({
    where: { end: { gte: from } },
    select: { ...bookingViewSelect, user: { select: { name: true, email: true } } },
    orderBy: { start: "asc" },
    take: 300,
  });
  return rows.map((row) => ({
    ...toView(row),
    holderName: row.user.name,
    holderEmail: row.user.email,
  }));
}
