"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { usePublishLiveStatus } from "@/components/layout/live-status";
import { NoiseBadge } from "@/components/rooms/status-badge";
import { STATE_META } from "@/components/rooms/status-meta";
import { cn } from "@/lib/cn";
import { formatRange, formatTime } from "@/lib/format";
import type { PublicRoomStatus, StateResponse } from "@/lib/reconciliation/room-status-types";
import type { RoomView } from "@/lib/rooms/rooms-types";
import { usePolling } from "@/lib/use-polling";

const STAGGER_MS = 30;

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
  usePublishLiveStatus(data.now, Boolean(error));

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))], [rooms]);
  const [floor, setFloor] = useState(floors[0] ?? "");
  const [freeOnly, setFreeOnly] = useState(false);

  const statusById = useMemo(() => new Map(data.rooms.map((s) => [s.roomId, s])), [data]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {floors.length > 1 ? (
          <div role="tablist" aria-label="Floor" className="inline-flex gap-1 rounded-(--radius) bg-subtle p-1">
            {floors.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={f === floor}
                onClick={() => setFloor(f)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  f === floor
                    ? "bg-accent text-white shadow-(--shadow-sm)"
                    : "text-ink-secondary hover:text-ink",
                )}
              >
                Floor {f}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <FreeNowSwitch checked={freeOnly} onChange={setFreeOnly} />
      </div>

      <div className="flex flex-col">
        {rows.map((row, rowIndex) => (
          <div key={`${floor}-${rowIndex}`}>
            {rowIndex === 1 ? <CorridorDivider /> : null}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
              {row.map((room, i) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  status={statusById.get(room.id)}
                  delayMs={(rowIndex * half + i) * STAGGER_MS}
                />
              ))}
            </div>
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-ink-secondary">No free rooms on this floor right now.</p>
        ) : null}
      </div>
    </div>
  );
}

function FreeNowSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm font-medium text-ink-secondary hover:text-ink"
    >
      Free now only
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow-(--shadow-sm) transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

function CorridorDivider() {
  return (
    <div className="relative my-4 flex items-center justify-center" role="separator">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <span className="relative bg-canvas px-3 text-xs font-medium tracking-[0.08em] text-ink-muted uppercase">
        Corridor
      </span>
    </div>
  );
}

function RoomCard({
  room,
  status,
  delayMs,
}: {
  room: RoomView;
  status?: PublicRoomStatus;
  delayMs: number;
}) {
  const state = status?.state ?? "free";
  const booking = status?.activeBooking;
  const dimmed = state === "booked_in_use";

  return (
    <article
      data-state={state}
      className={cn("room-card", STATE_META[state].stripe)}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          {/* Stretched link: the whole card navigates to the room. */}
          <Link
            href={`/rooms/${encodeURIComponent(room.id)}`}
            className="text-[17px] font-semibold tracking-[-0.01em] text-ink tabular-nums outline-none after:absolute after:inset-0 after:rounded-(--radius) focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {room.id}
          </Link>
          <span className="flex items-center gap-1 text-sm text-ink-secondary tabular-nums" title="Capacity">
            <Users className="size-4" aria-hidden />
            <span className="sr-only">Capacity</span>
            {room.capacity}
          </span>
        </div>
        <span className={cn("truncate text-sm text-ink-secondary", dimmed && "text-ink-muted")}>{room.name}</span>
      </div>

      <span
        className={cn(
          "mt-2.5 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-[13px] font-semibold",
          STATE_META[state].pill,
        )}
      >
        <span aria-hidden className={cn("size-2 rounded-full", STATE_META[state].dot)} />
        {STATE_META[state].short}
      </span>

      <div className="mt-auto pt-3">
        <div className="flex flex-col gap-1 border-t border-line pt-2.5 text-[13px] leading-5 text-ink-secondary tabular-nums">
          {booking ? (
            <span className="truncate">
              {booking.isMine ? "You" : booking.holderFirstName}: {formatRange(booking.start, booking.end)}
            </span>
          ) : status?.nextBooking ? (
            <span className="truncate">Free until {formatTime(status.nextBooking.start)}</span>
          ) : state === "free" ? (
            <span>Free all day</span>
          ) : null}
          {status ? (
            <NoiseBadge
              level={status.noiseLevel}
              db={status.noiseDb}
              sensorOnline={status.sensorOnline}
              className="text-[13px] text-ink-secondary [&_svg]:size-3.5"
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}
