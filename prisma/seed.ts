import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const ROOMS = [
  { id: "Z.1.01", name: "Study Room 1", floor: "Z-1", capacity: 4, amenities: ["whiteboard"] },
  { id: "Z.1.02", name: "Study Room 2", floor: "Z-1", capacity: 4, amenities: ["whiteboard", "monitor"] },
  { id: "Z.1.03", name: "Project Room 3", floor: "Z-1", capacity: 8, amenities: ["whiteboard", "monitor", "videoconf"] },
  { id: "Z.1.04", name: "Study Room 4", floor: "Z-1", capacity: 2, amenities: [] },
  { id: "Z.1.05", name: "Study Room 5", floor: "Z-1", capacity: 4, amenities: ["monitor"] },
  { id: "Z.1.06", name: "Silent Room 6", floor: "Z-1", capacity: 2, amenities: ["silent"] },
  { id: "Z.1.07", name: "Study Room 7", floor: "Z-1", capacity: 6, amenities: ["whiteboard"] },
  { id: "Z.1.08", name: "Seminar Room 8", floor: "Z-1", capacity: 16, amenities: ["projector", "whiteboard"] },
  { id: "Z.1.09", name: "Study Room 9", floor: "Z-1", capacity: 4, amenities: ["whiteboard", "monitor"] },
  { id: "Z.1.10", name: "Study Room 10", floor: "Z-1", capacity: 4, amenities: ["monitor"] },
  { id: "Z.1.11", name: "Study Room 11", floor: "Z-1", capacity: 6, amenities: ["whiteboard"] },
  { id: "Z.1.12", name: "Focus Pod 12", floor: "Z-1", capacity: 1, amenities: ["silent"] },
  { id: "Z.2.01", name: "Study Room 2.1", floor: "Z-2", capacity: 4, amenities: ["whiteboard"] },
  { id: "Z.2.02", name: "Project Room 2.2", floor: "Z-2", capacity: 10, amenities: ["projector", "videoconf"] },
  { id: "Z.2.03", name: "Silent Room 2.3", floor: "Z-2", capacity: 2, amenities: ["silent"] },
  { id: "Z.2.04", name: "Study Room 2.4", floor: "Z-2", capacity: 6, amenities: ["whiteboard", "monitor"] },
];

const USERS = [
  { email: "admin@smartbook.dev", name: "Fiona Facilities", role: "ADMIN" as const, password: "admin1234" },
  { email: "member@smartbook.dev", name: "Mia Member", role: "MEMBER" as const, password: "member1234" },
  { email: "holder@smartbook.dev", name: "Harry Holder", role: "MEMBER" as const, password: "holder1234" },
];

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  for (const room of ROOMS) {
    const data = { ...room, amenities: JSON.stringify(room.amenities) };
    await db.room.upsert({ where: { id: room.id }, update: data, create: data });
  }

  const userIds: Record<string, string> = {};
  for (const { password, ...user } of USERS) {
    const passwordHash = await bcrypt.hash(password, 10);
    const saved = await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: { ...user, passwordHash },
    });
    userIds[user.email] = saved.id;
  }

  // Future demo bookings so calendars are not empty. Current-time demo bookings
  // (ghost / auto check-in) are created by the simulator when it starts.
  await db.booking.deleteMany({ where: { kind: "SCHEDULED", start: { gt: new Date() } } });
  const member = userIds["member@smartbook.dev"];
  const holder = userIds["holder@smartbook.dev"];
  const future = [
    { roomId: "Z.1.02", userId: holder, start: at(1, 9), end: at(1, 11) },
    { roomId: "Z.1.02", userId: member, start: at(1, 14), end: at(1, 15, 30) },
    { roomId: "Z.1.05", userId: holder, start: at(1, 10), end: at(1, 12) },
    { roomId: "Z.1.08", userId: holder, start: at(2, 13), end: at(2, 16) },
    { roomId: "Z.1.07", userId: member, start: at(3, 10), end: at(3, 11) },
    { roomId: "Z.2.02", userId: holder, start: at(1, 16), end: at(1, 18) },
  ];
  for (const booking of future) {
    await db.booking.create({ data: { ...booking, kind: "SCHEDULED" } });
  }

  console.log(`Seeded ${ROOMS.length} rooms, ${USERS.length} users, ${future.length} future bookings.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
