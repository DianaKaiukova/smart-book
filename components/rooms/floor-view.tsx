"use client";

import { Ghost, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { NoiseBadge, StatusBadge } from "@/components/rooms/status-badge";
import { STATE_META } from "@/components/rooms/status-meta";
import { SegmentedToggleButton } from "@/components/ui/segmented-toggle-button";
import { cn } from "@/lib/cn";
import { formatRange, formatTime } from "@/lib/format";
import type { RoomState } from "@/lib/reconciliation/engine";
import type { PublicRoomStatus, StateResponse } from "@/lib/reconciliation/room-status-types";
import type { RoomView } from "@/lib/rooms/rooms-types";
import { usePolling } from "@/lib/use-polling";

const LEGEND: RoomState[] = ["free", "ghost_booking", "booked", "booked_in_use", "occupied"];
const FILTERS = ["All rooms", "Free now"] as const;

export function FloorView({
  rooms,
  initial,
  pollIntervalMs,
}: {
  rooms: RoomView[];
  initial: StateResponse;
  pollIntervalMs: number;
}) {
  const { data, error } = usePolling<StateResponse>("/api/state", pollIntervalMs, initial);
  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))], [rooms]);
  const [floor, setFloor] = useState(floors[0] ?? "");
  const [freeOnly, setFreeOnly] = useState(false);

  const statusById = useMemo(() => new Map(data.rooms.map((s) => [s.roomId, s])), [data]);
  const counts = useMemo(() => {
    const c: Partial<Record<RoomState, number>> = {};
    for (const s of data.rooms) c[s.state] = (c[s.state] ?? 0) + 1;
    return c;
  }, [data]);

  const visible = rooms.filter((r) => {
    if (r.floor !== floor) return false;
    if (!freeOnly) return true;
    const state = statusById.get(r.id)?.state;
    return state === "free" || state === "ghost_booking";
  });
  // Corridor layout: first half along the top wall, second half along the bottom.
  const half = Math.ceil(visible.length / 2);
  const rows = freeOnly ? [visible] : [visible.slice(0, half), visible.slice(half)];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {floors.length > 1 ? (
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {floors.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFloor(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  f === floor ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                Floor {f}
              </button>
            ))}
          </div>
        ) : null}
        <SegmentedToggleButton
          options={FILTERS}
          defaultIndex={0}
          onChange={(index) => setFreeOnly(index === 1)}
          className="w-56"
        />
        <span className={cn("ml-auto flex items-center gap-1.5 text-xs", error ? "text-rose-600" : "text-neutral-400")}>
          <span className={cn("size-2 rounded-full", error ? "bg-rose-500" : "animate-pulse bg-emerald-500")} />
          {error ? "Connection lost — retrying" : `Live · ${formatTime(data.now)}`}
        </span>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", STATE_META[state].dot)} />
            {STATE_META[state].short}
            <span className="tabular-nums text-neutral-400">{counts[state] ?? 0}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
        {rows.map((row, index) => (
          <div key={index}>
            {index === 1 ? (
              <div className="my-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-neutral-300">
                <span className="h-px flex-1 bg-neutral-200" /> corridor <span className="h-px flex-1 bg-neutral-200" />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {row.map((room) => (
                <RoomTile key={room.id} room={room} status={statusById.get(room.id)} />
              ))}
            </div>
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">No free rooms on this floor right now.</p>
        ) : null}
      </div>
    </div>
  );
}

function RoomTile({ room, status }: { room: RoomView; status?: PublicRoomStatus }) {
  const state = status?.state ?? "free";
  const booking = status?.activeBooking;

  return (
    <Link
      href={`/rooms/${encodeURIComponent(room.id)}`}
      className={cn(
        "group flex min-h-28 flex-col gap-1.5 rounded-xl border p-3 transition-colors",
        STATE_META[state].tile,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-neutral-900">{room.id}</span>
        <span className="flex items-center gap-0.5 text-xs text-neutral-500">
          <Users className="size-3" aria-hidden />
          {room.capacity}
        </span>
      </div>
      <span className="truncate text-xs text-neutral-600">{room.name}</span>
      <StatusBadge state={state} className="self-start" />
      <div className="mt-auto flex flex-col gap-0.5 text-[11px] text-neutral-600">
        {state === "ghost_booking" ? (
          <span className="flex items-center gap-1 font-medium text-fuchsia-700">
            <Ghost className="size-3" aria-hidden /> Grab it now
          </span>
        ) : booking ? (
          <span className="truncate">
            {booking.isMine ? "You" : booking.holderFirstName} · {formatRange(booking.start, booking.end)}
          </span>
        ) : status?.nextBooking ? (
          <span className="truncate">Free until {formatTime(status.nextBooking.start)}</span>
        ) : null}
        {status ? <NoiseBadge level={status.noiseLevel} db={status.noiseDb} sensorOnline={status.sensorOnline} /> : null}
      </div>
    </Link>
  );
}
