import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { computeRoomStatuses, toPublicRoomStatus } from "@/lib/reconciliation/room-status";
import type { StateResponse } from "@/lib/reconciliation/room-status-types";

/** Live floor state for signed-in users (holder identities reduced to first names). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statuses = await computeRoomStatuses();
  const body: StateResponse = {
    now: new Date().toISOString(),
    rooms: statuses.map((s) => toPublicRoomStatus(s, user.id)),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
