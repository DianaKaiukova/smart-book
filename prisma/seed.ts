import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

// Real bookable rooms of the AAU Klagenfurt Nordtrakt (building N), from campusplan.aau.at.
// Codes, room types and seminar-room capacities are real; capacities of meeting/project rooms
// (not published) and all amenities are demo assumptions.
const SEMINAR = ["projector", "whiteboard"];
const MEETING = ["monitor", "whiteboard"];

const ROOMS = [
  { id: "N.0.07", name: "Seminar Room", floor: "Level 0", capacity: 18, amenities: SEMINAR },
  { id: "N.0.14a", name: "Meeting Room", floor: "Level 0", capacity: 8, amenities: MEETING },
  { id: "N.0.15", name: "Seminar Room", floor: "Level 0", capacity: 20, amenities: SEMINAR },
  { id: "N.0.16", name: "Seminar Room", floor: "Level 0", capacity: 5, amenities: ["whiteboard"] },
  { id: "N.0.18", name: "Seminar Room", floor: "Level 0", capacity: 18, amenities: SEMINAR },
  { id: "N.0.27", name: "Seminar Room", floor: "Level 0", capacity: 24, amenities: SEMINAR },
  { id: "N.0.41a", name: "Meeting Room", floor: "Level 0", capacity: 8, amenities: MEETING },
  { id: "N.0.42", name: "Seminar Room", floor: "Level 0", capacity: 24, amenities: SEMINAR },
  { id: "N.0.43", name: "Seminar Room", floor: "Level 0", capacity: 24, amenities: SEMINAR },
  { id: "N.0.44", name: "Seminar Room", floor: "Level 0", capacity: 18, amenities: SEMINAR },
  { id: "N.0.45", name: "Seminar Room", floor: "Level 0", capacity: 36, amenities: [...SEMINAR, "videoconf"] },
  { id: "N.0.54", name: "Self Access Center", floor: "Level 0", capacity: 10, amenities: ["monitor", "silent"] },
  { id: "N.0.55a", name: "Meeting Room", floor: "Level 0", capacity: 8, amenities: MEETING },
  { id: "N.0.56", name: "Seminar Room", floor: "Level 0", capacity: 20, amenities: SEMINAR },
  { id: "N.0.67", name: "Seminar Room", floor: "Level 0", capacity: 20, amenities: SEMINAR },
  { id: "N.1.02a", name: "Project Room", floor: "Level 1", capacity: 6, amenities: ["whiteboard", "monitor", "videoconf"] },
  { id: "N.1.04", name: "Seminar Room", floor: "Level 1", capacity: 24, amenities: SEMINAR },
  { id: "N.1.12", name: "Seminar Room", floor: "Level 1", capacity: 24, amenities: SEMINAR },
  { id: "N.1.25", name: "Seminar Room", floor: "Level 1", capacity: 20, amenities: SEMINAR },
  { id: "N.1.31a", name: "Meeting Room", floor: "Level 1", capacity: 8, amenities: MEETING },
  { id: "N.1.42", name: "Seminar Room", floor: "Level 1", capacity: 24, amenities: SEMINAR },
  { id: "N.1.43", name: "Seminar Room", floor: "Level 1", capacity: 48, amenities: [...SEMINAR, "videoconf"] },
  { id: "N.1.44", name: "Seminar Room", floor: "Level 1", capacity: 48, amenities: [...SEMINAR, "videoconf"] },
  { id: "N.1.45", name: "Seminar Room", floor: "Level 1", capacity: 6, amenities: ["whiteboard"] },
  { id: "N.1.51a", name: "Meeting Room", floor: "Level 1", capacity: 8, amenities: MEETING },
  { id: "N.1.71", name: "Seminar Room", floor: "Level 1", capacity: 16, amenities: SEMINAR },
  { id: "N.2.00", name: "Meeting Room", floor: "Level 2", capacity: 8, amenities: MEETING },
  { id: "N.2.01", name: "Seminar Room", floor: "Level 2", capacity: 20, amenities: SEMINAR },
  { id: "N.2.08", name: "Research Lab", floor: "Level 2", capacity: 8, amenities: ["monitor", "whiteboard"] },
  { id: "N.2.22a", name: "Meeting Room", floor: "Level 2", capacity: 8, amenities: MEETING },
  { id: "N.2.35", name: "Seminar Room", floor: "Level 2", capacity: 48, amenities: [...SEMINAR, "videoconf"] },
  { id: "N.2.38", name: "Seminar Room", floor: "Level 2", capacity: 12, amenities: SEMINAR },
  { id: "N.2.57", name: "Seminar Room", floor: "Level 2", capacity: 20, amenities: SEMINAR },
  { id: "N.2.57a", name: "Meeting Room", floor: "Level 2", capacity: 8, amenities: MEETING },
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
  // Drop rooms that are no longer part of the building (their bookings cascade).
  await db.room.deleteMany({ where: { id: { notIn: ROOMS.map((r) => r.id) } } });
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
    { roomId: "N.0.42", userId: holder, start: at(1, 9), end: at(1, 11) },
    { roomId: "N.0.42", userId: member, start: at(1, 14), end: at(1, 15, 30) },
    { roomId: "N.0.56", userId: holder, start: at(1, 10), end: at(1, 12) },
    { roomId: "N.1.43", userId: holder, start: at(2, 13), end: at(2, 16) },
    { roomId: "N.0.14a", userId: member, start: at(3, 10), end: at(3, 11) },
    { roomId: "N.2.35", userId: holder, start: at(1, 16), end: at(1, 18) },
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
