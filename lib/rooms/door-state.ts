import "server-only";

import { db } from "@/lib/db";
import { computeRoomStatuses, toPublicRoomStatus } from "@/lib/reconciliation/room-status";
import type { DoorState } from "@/lib/rooms/door-types";
import { getRoom } from "@/lib/rooms/rooms";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Everything the public door kiosk shows. No full names, no emails. */
export async function getDoorState(roomId: string): Promise<DoorState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [[status], upcoming] = await Promise.all([
    computeRoomStatuses({ roomIds: [roomId], now }),
    db.booking.findMany({
      where: { roomId, status: { in: ["RESERVED", "CHECKED_IN"] }, start: { gt: now, lte: endOfDay } },
      select: { start: true, end: true, user: { select: { name: true } } },
      orderBy: { start: "asc" },
      take: 4,
    }),
  ]);
  if (!status) return null;

  return {
    now: now.toISOString(),
    room: { id: room.id, name: room.name, floor: room.floor, capacity: room.capacity, amenities: room.amenities },
    status: toPublicRoomStatus(status),
    upcomingToday: upcoming.map((b) => ({
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      holderFirstName: firstName(b.user.name),
    })),
  };
}
