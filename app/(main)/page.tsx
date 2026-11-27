import type { Metadata } from "next";
import { Suspense } from "react";

import { FloorView } from "@/components/rooms/floor-view";
import { requireUser } from "@/lib/auth/session";
import { appConfig } from "@/lib/config";
import { computeRoomStatuses, toPublicRoomStatus } from "@/lib/reconciliation/room-status";
import { listRooms } from "@/lib/rooms/rooms";

export const metadata: Metadata = { title: "Rooms" };

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Building Z</h1>
        <p className="text-sm text-neutral-500">
          Live room status. Rooms marked <span className="font-medium text-fuchsia-700">Ghost</span> are booked but
          empty — you can grab them right now.
        </p>
      </div>
      <Suspense fallback={<FloorSkeleton />}>
        <LiveFloor />
      </Suspense>
    </div>
  );
}

async function LiveFloor() {
  const user = await requireUser();
  const [rooms, statuses] = await Promise.all([listRooms(), computeRoomStatuses()]);
  return (
    <FloorView
      rooms={rooms}
      initial={{ now: new Date().toISOString(), rooms: statuses.map((s) => toPublicRoomStatus(s, user.id)) }}
      pollIntervalMs={appConfig.pollIntervalMs}
    />
  );
}

function FloorSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="h-28 rounded-xl bg-neutral-100" />
      ))}
    </div>
  );
}
