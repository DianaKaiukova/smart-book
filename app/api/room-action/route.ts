import { NextResponse } from "next/server";

import { roomActionEventSchema } from "@/lib/occupancy/schema";

// S5 seam (out of scope for this build): the door board will POST voice/gesture
// RoomActionEvents here. The contract is validated now so the board team can integrate.
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = roomActionEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid room action", issues: parsed.error.issues }, { status: 400 });
  }
  return NextResponse.json(
    { error: "Room actions from the door board are not implemented yet.", received: parsed.data },
    { status: 501 },
  );
}
