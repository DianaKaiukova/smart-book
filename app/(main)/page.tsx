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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">Building Z</h1>
        <p className="text-[15px] leading-6 text-ink-secondary">
          Live room status. <span className="font-semibold text-warning">Ghost</span> rooms are booked but nobody is
          there.
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
    <div className="grid animate-pulse grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="h-36 rounded-(--radius) border border-line bg-surface" />
      ))}
    </div>
  );
}
