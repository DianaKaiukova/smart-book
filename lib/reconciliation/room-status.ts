import "server-only";

import { appConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { globalSingleton } from "@/lib/global-singleton";
import { ensureOccupancySource } from "@/lib/occupancy/source";
import { getSignal } from "@/lib/occupancy/store";
import type { RoomSignal } from "@/lib/occupancy/types";
import {
  reconcileRoom,
  type PreviousState,
  type ReconcileConfig,
} from "@/lib/reconciliation/engine";
import type {
  LiveBooking,
  LiveRoomStatus,
  PublicBooking,
  PublicRoomStatus,
} from "@/lib/reconciliation/room-status-types";

const previousStates = globalSingleton(
  "__smartbook_room_states",
  () => new Map<string, PreviousState>(),
);

const ACTIVE = ["RESERVED", "CHECKED_IN"] as const;
const NEXT_BOOKING_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

export const reconcileConfig: ReconcileConfig = {
  ghostAfterMs: appConfig.ghostAfterMinutes * 60_000,
  ghostAfterCheckedInMs: appConfig.ghostAfterCheckedInMinutes * 60_000,
  quietBelowDb: appConfig.quietBelowDb,
  loudFromDb: appConfig.loudFromDb,
};

function freshSignal(roomId: string, now: Date): RoomSignal | undefined {
  const signal = getSignal(roomId);
  if (!signal) return undefined;
  return now.getTime() - signal.ts.getTime() <= appConfig.signalStaleAfterMs ? signal : undefined;
}

/** Past `end` → COMPLETED (§5). */
export async function completePastBookings(now: Date): Promise<void> {
  await db.booking.updateMany({
    where: { status: { in: [...ACTIVE] }, end: { lte: now } },
    data: { status: "COMPLETED" },
  });
}

type ComputeOptions = { roomIds?: string[]; now?: Date };

/**
 * Recompute live RoomStatus for rooms. Applies side effects of the rules:
 * auto check-in by presence (S1) and completion of past bookings.
 */
export async function computeRoomStatuses(options: ComputeOptions = {}): Promise<LiveRoomStatus[]> {
  ensureOccupancySource();
  const now = options.now ?? new Date();
  const roomFilter = options.roomIds ? { in: options.roomIds } : undefined;

  await completePastBookings(now);

  const [rooms, activeBookings, upcomingBookings] = await Promise.all([
    db.room.findMany({
      where: roomFilter ? { id: roomFilter } : undefined,
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    db.booking.findMany({
      where: {
        roomId: roomFilter,
        status: { in: [...ACTIVE] },
        start: { lte: now },
        end: { gt: now },
      },
      include: { user: { select: { name: true } } },
    }),
    db.booking.findMany({
      where: {
        roomId: roomFilter,
        status: { in: [...ACTIVE] },
        start: { gt: now, lte: new Date(now.getTime() + NEXT_BOOKING_LOOKAHEAD_MS) },
      },
      include: { user: { select: { name: true } } },
      orderBy: { start: "asc" },
    }),
  ]);

  const autoCheckIns: string[] = [];

  const statuses = rooms.map((room): LiveRoomStatus => {
    const booking = activeBookings.find((b) => b.roomId === room.id);
    const next = upcomingBookings.find((b) => b.roomId === room.id);
    const signal = freshSignal(room.id, now);

    const result = reconcileRoom({
      now,
      booking,
      signal,
      previous: previousStates.get(room.id),
      config: reconcileConfig,
    });
    previousStates.set(room.id, { state: result.state, since: result.since });

    let activeBooking: LiveBooking | undefined;
    if (booking) {
      const autoCheckedIn = result.autoCheckInBookingId === booking.id;
      if (autoCheckedIn) autoCheckIns.push(booking.id);
      activeBooking = {
        id: booking.id,
        userId: booking.userId,
        holderName: booking.user.name,
        start: booking.start.toISOString(),
        end: booking.end.toISOString(),
        status: autoCheckedIn ? "CHECKED_IN" : (booking.status as LiveBooking["status"]),
        checkedInAt: autoCheckedIn
          ? now.toISOString()
          : (booking.checkedInAt?.toISOString() ?? null),
      };
    }

    return {
      roomId: room.id,
      state: result.state,
      since: result.since.toISOString(),
      booked: result.booked,
      occupied: result.occupied,
      sensorOnline: Boolean(signal),
      noiseDb: signal?.noiseDb,
      noiseLevel: result.noiseLevel,
      peopleCount: signal?.peopleCount,
      ghostAt: result.ghostAt?.toISOString(),
      activeBooking,
      nextBooking: next
        ? {
            id: next.id,
            userId: next.userId,
            holderName: next.user.name,
            start: next.start.toISOString(),
            end: next.end.toISOString(),
          }
        : undefined,
    };
  });

  if (autoCheckIns.length > 0) {
    // Guard on status so a concurrent manual check-in/cancel wins.
    await db.booking.updateMany({
      where: { id: { in: autoCheckIns }, status: "RESERVED" },
      data: { status: "CHECKED_IN", checkedInAt: now },
    });
  }

  return statuses;
}

export async function getRoomStatus(roomId: string): Promise<LiveRoomStatus | undefined> {
  const [status] = await computeRoomStatuses({ roomIds: [roomId] });
  return status;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function toPublicRoomStatus(status: LiveRoomStatus, viewerId?: string): PublicRoomStatus {
  const { activeBooking, nextBooking, ...rest } = status;
  const active: PublicBooking | undefined = activeBooking
    ? {
        id: activeBooking.id,
        holderFirstName: firstName(activeBooking.holderName),
        isMine: activeBooking.userId === viewerId,
        start: activeBooking.start,
        end: activeBooking.end,
        checkedIn: activeBooking.status === "CHECKED_IN",
      }
    : undefined;
  return {
    ...rest,
    activeBooking: active,
    nextBooking: nextBooking
      ? {
          id: nextBooking.id,
          holderFirstName: firstName(nextBooking.holderName),
          isMine: nextBooking.userId === viewerId,
          start: nextBooking.start,
          end: nextBooking.end,
        }
      : undefined,
  };
}
