import { NextResponse } from "next/server";

import { getAdminState } from "@/lib/admin/admin-state";
import { getSessionUser } from "@/lib/auth/session";

/** Full live state for the facilities dashboard (holder names, sim snapshot). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(await getAdminState(), { headers: { "Cache-Control": "no-store" } });
}
