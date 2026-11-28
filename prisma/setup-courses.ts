// Additive setup for the courses/timetable feature: tag rooms with a category
// and create a demo teacher account. Safe to re-run; does not delete anything.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function categoryFor(name: string): "LECTURE" | "SEMINAR" | "LAB" | "STUDY" | "MEETING" {
  if (/lab/i.test(name)) return "LAB";
  if (/seminar/i.test(name)) return "SEMINAR";
  if (/self access|study/i.test(name)) return "STUDY";
  if (/meeting|project/i.test(name)) return "MEETING";
  return "SEMINAR";
}

async function main() {
  const rooms = await db.room.findMany({ select: { id: true, name: true } });
  for (const r of rooms) {
    await db.room.update({ where: { id: r.id }, data: { category: categoryFor(r.name) } });
  }

  const teacherPw = process.env.SEED_TEACHER_PASSWORD || "teacher1234";
  await db.user.upsert({
    where: { email: "teacher@smartbook.dev" },
    update: { role: "TEACHER" },
    create: {
      email: "teacher@smartbook.dev",
      name: "Dr. Tom Teacher",
      role: "TEACHER",
      passwordHash: await bcrypt.hash(teacherPw, 10),
    },
  });

  const byCat = await db.room.groupBy({ by: ["category"], _count: true });
  console.log("Room categories:", JSON.stringify(byCat));
  console.log("Teacher ready: teacher@smartbook.dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
