import "server-only";

import { db } from "@/lib/db";

// Creates the bookings the scripted sim scenario needs, relative to "now",
// so the demo works whenever it is started.

export const DEMO_HOLDER_EMAIL = "holder@smartbook.dev";

const DEMO_BOOKINGS = [
  { roomId: "N.0.27", startOffsetMin: -20, durationMin: 90 },
  { roomId: "N.0.15", startOffsetMin: -1, durationMin: 60 },
  { roomId: "N.0.18", startOffsetMin: 0, durationMin: 60 },
] as const;

export async function ensureDemoBookings(now = new Date()): Promise<number> {
  const holder = await db.user.findUnique({ where: { email: DEMO_HOLDER_EMAIL }, select: { id: true } });
  if (!holder) return 0;

  let created = 0;
  for (const demo of DEMO_BOOKINGS) {
    const start = new Date(now.getTime() + demo.startOffsetMin * 60_000);
    const end = new Date(start.getTime() + demo.durationMin * 60_000);
    const room = await db.room.findUnique({ where: { id: demo.roomId }, select: { id: true } });
    if (!room) continue;

    const conflict = await db.booking.findFirst({
      where: {
        roomId: demo.roomId,
        status: { in: ["RESERVED", "CHECKED_IN"] },
        start: { lt: end },
        end: { gt: start },
      },
      select: { id: true },
    });
    if (conflict) continue;

    await db.booking.create({
      data: { roomId: demo.roomId, userId: holder.id, start, end, kind: "SCHEDULED" },
    });
    created += 1;
  }
  return created;
}

/** Restart support: drop active bookings in the scripted rooms, then recreate them relative to now. */
export async function resetDemoBookings(now = new Date()): Promise<number> {
  await db.booking.deleteMany({
    where: {
      roomId: { in: DEMO_BOOKINGS.map((b) => b.roomId) },
      status: { in: ["RESERVED", "CHECKED_IN", "GHOST_RELEASED"] },
      start: { lte: new Date(now.getTime() + 2 * 60 * 60_000) },
      end: { gt: now },
    },
  });
  return ensureDemoBookings(now);
}
