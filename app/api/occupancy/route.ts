import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { ingestOccupancyEvent } from "@/lib/occupancy/ingest";
import { occupancyPayloadSchema } from "@/lib/occupancy/schema";

// Board seam: the PSOC Edge bridge POSTs OccupancyEvents here (single or batch).
// Auth: `x-occupancy-key` header == OCCUPANCY_INGEST_KEY, or an admin session.
// With no key configured, dev mode accepts unauthenticated posts.

function keyMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function isAuthorized(request: Request): Promise<boolean> {
  const expected = appConfig.occupancyIngestKey;
  if (expected && keyMatches(request.headers.get("x-occupancy-key"), expected)) return true;
  const user = await getSessionUser();
  if (user?.role === "ADMIN") return true;
  return !expected && process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = occupancyPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid occupancy event", issues: parsed.error.issues }, { status: 400 });
  }

  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const known = new Set(
    (await db.room.findMany({ where: { id: { in: events.map((e) => e.roomId) } }, select: { id: true } })).map(
      (r) => r.id,
    ),
  );
  const unknownRooms = [...new Set(events.filter((e) => !known.has(e.roomId)).map((e) => e.roomId))];

  let accepted = 0;
  for (const event of events) {
    if (!known.has(event.roomId)) continue;
    await ingestOccupancyEvent(event);
    accepted += 1;
  }

  return NextResponse.json({ accepted, unknownRooms }, { status: accepted > 0 ? 202 : 422 });
}
