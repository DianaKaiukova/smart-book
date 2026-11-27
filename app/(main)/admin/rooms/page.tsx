import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RoomEditor } from "@/components/admin/room-editor";
import { requireAdmin } from "@/lib/auth/session";
import { listRooms } from "@/lib/rooms/rooms";

export const metadata: Metadata = { title: "Manage rooms" };

export default function AdminRoomsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Manage rooms</h1>
        <p className="text-sm text-ink-muted">
          The door kiosk for a room lives at <code className="rounded bg-subtle px-1">/door/&lt;room id&gt;</code>.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-subtle" />}>
        <RoomsContent />
      </Suspense>
    </div>
  );
}

async function RoomsContent() {
  await requireAdmin();
  const rooms = await listRooms();
  return <RoomEditor rooms={rooms} />;
}
