import { connection, NextResponse } from "next/server";

import { getDoorState } from "@/lib/rooms/door-state";

/** Public kiosk endpoint for the door display — no auth, first names only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/rooms/[id]/status">) {
  await connection();
  const { id } = await ctx.params;
  const state = await getDoorState(decodeURIComponent(id));
  if (!state) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
