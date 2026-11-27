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
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Manage rooms</h1>
        <p className="text-sm text-neutral-500">
          The door kiosk for a room lives at <code className="rounded bg-neutral-100 px-1">/door/&lt;room id&gt;</code>.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />}>
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
