import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RoomDetail } from "@/components/rooms/room-detail";
import { requireUser } from "@/lib/auth/session";
import { listRoomBusySlots } from "@/lib/booking/booking-service";
import { appConfig } from "@/lib/config";
import { computeRoomStatuses, toPublicRoomStatus } from "@/lib/reconciliation/room-status";
import { getRoom } from "@/lib/rooms/rooms";

export default function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex items-center gap-1 self-start text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All rooms
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-subtle" />}>
        <RoomContent params={params} />
      </Suspense>
    </div>
  );
}

async function RoomContent({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const roomId = decodeURIComponent((await params).id);
  const room = await getRoom(roomId);
  if (!room) notFound();

  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  const [[status], busy] = await Promise.all([
    computeRoomStatuses({ roomIds: [roomId], now }),
    // No upper bound: rooms can be booked on any future date.
    listRoomBusySlots(roomId, from, null, user.id),
  ]);

  return (
    <RoomDetail
      room={room}
      initial={{ now: now.toISOString(), rooms: status ? [toPublicRoomStatus(status, user.id)] : [] }}
      busy={busy}
      pollIntervalMs={appConfig.pollIntervalMs}
    />
  );
}
