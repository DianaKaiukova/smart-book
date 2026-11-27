import "server-only";

import type { AdminState, AdminStats } from "@/lib/admin/admin-types";
import { appConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { getSimulator } from "@/lib/occupancy/source";
import { computeRoomStatuses } from "@/lib/reconciliation/room-status";
import type { LiveRoomStatus } from "@/lib/reconciliation/room-status-types";

async function computeStats(now: Date, statuses: LiveRoomStatus[]): Promise<AdminStats> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const today = await db.booking.findMany({
    where: { start: { gte: dayStart, lt: dayEnd } },
    select: { start: true, end: true, status: true, checkedInAt: true },
  });
  const held = today.filter((b) => b.status !== "CANCELLED");
  const started = held.filter((b) => b.start <= now);
  const bookedMs = held
    .filter((b) => b.status !== "GHOST_RELEASED")
    .reduce((sum, b) => sum + (b.end.getTime() - b.start.getTime()), 0);

  return {
    bookingsToday: held.length,
    bookedHoursToday: Math.round((bookedMs / 3_600_000) * 10) / 10,
    checkedInRate: started.length ? started.filter((b) => b.checkedInAt).length / started.length : null,
    ghostsReleasedToday: today.filter((b) => b.status === "GHOST_RELEASED").length,
    roomsInUseNow: statuses.filter((s) => s.occupied).length,
    roomCount: statuses.length,
  };
}

export async function getAdminState(): Promise<AdminState> {
  const now = new Date();
  const [statuses, rooms] = await Promise.all([
    computeRoomStatuses({ now }),
    db.room.findMany({ select: { id: true, name: true, floor: true, capacity: true } }),
  ]);
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  return {
    now: now.toISOString(),
    occupancySource: appConfig.occupancySource,
    ghostAfterMinutes: appConfig.ghostAfterMinutes,
    rooms: statuses.map((s) => {
      const room = roomById.get(s.roomId);
      return { ...s, name: room?.name ?? s.roomId, floor: room?.floor ?? "", capacity: room?.capacity ?? 0 };
    }),
    sim: getSimulator()?.snapshot() ?? null,
    stats: await computeStats(now, statuses),
  };
}
