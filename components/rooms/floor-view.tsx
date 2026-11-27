"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { usePublishLiveStatus } from "@/components/layout/live-status";
import { useToast } from "@/components/layout/toaster";
import { NoiseBadge } from "@/components/rooms/status-badge";
import { STATE_META } from "@/components/rooms/status-meta";
import { cn } from "@/lib/cn";
import { bookNowAction } from "@/lib/booking/actions";
import { BOOKING_RULES } from "@/lib/booking/rules";
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
  const { data, error, refresh } = usePolling<StateResponse>("/api/state", pollIntervalMs, initial);
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
                  "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  f === floor
                    ? "bg-surface text-ink shadow-(--shadow-sm)"
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {row.map((room, i) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  status={statusById.get(room.id)}
                  delayMs={(rowIndex * half + i) * STAGGER_MS}
                  onBooked={refresh}
                />
              ))}
            </div>
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-ink-secondary">No free rooms on this floor right now.</p>
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
      className="inline-flex items-center gap-2.5 text-[13px] font-medium text-ink-secondary hover:text-ink"
    >
      Free now only
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-ink" : "bg-line",
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
    <div className="relative my-8 flex items-center justify-center" role="separator">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
      <span className="relative bg-canvas px-3 text-[11px] font-medium tracking-[0.08em] text-ink-muted uppercase">
        Corridor
      </span>
    </div>
  );
}

function RoomCard({
  room,
  status,
  delayMs,
  onBooked,
}: {
  room: RoomView;
  status?: PublicRoomStatus;
  delayMs: number;
  onBooked: () => void;
}) {
  const state = status?.state ?? "free";
  const booking = status?.activeBooking;
  const dimmed = state === "booked_in_use";

  return (
    <article data-state={state} className="room-card" style={{ animationDelay: `${delayMs}ms` }}>
      <div className={cn("flex flex-col gap-1", dimmed && "opacity-70")}>
        <div className="flex items-baseline justify-between gap-2">
          {/* Stretched link: the whole card navigates, while the Grab button stays separately clickable. */}
          <Link
            href={`/rooms/${encodeURIComponent(room.id)}`}
            className="text-sm font-semibold tracking-[-0.01em] text-ink tabular-nums outline-none after:absolute after:inset-0 after:rounded-(--radius) focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {room.id}
          </Link>
          <span className="flex items-center gap-1 text-[11px] text-ink-muted tabular-nums" title="Capacity">
            <Users className="size-3" aria-hidden />
            <span className="sr-only">Capacity</span>
            {room.capacity}
          </span>
        </div>
        <span className="truncate text-[13px] text-ink-secondary">{room.name}</span>
      </div>

      <span
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 self-start rounded-full border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-ink",
          dimmed && "text-ink-secondary",
        )}
      >
        <span aria-hidden className={cn("size-2 rounded-full", STATE_META[state].dot)} />
        {STATE_META[state].short}
      </span>

      <div className="mt-auto pt-4">
        <div className="flex flex-col gap-1 border-t border-line pt-3 text-[11px] leading-4 text-ink-muted tabular-nums">
          {state === "ghost_booking" && !booking?.isMine ? (
            <GrabButton roomId={room.id} onBooked={onBooked} />
          ) : booking ? (
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
              className="text-[11px] text-ink-muted [&_svg]:size-3"
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function GrabButton({ roomId, onBooked }: { roomId: string; onBooked: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function grab() {
    startTransition(async () => {
      const result = await bookNowAction({ roomId, minutes: BOOKING_RULES.defaultNowMinutes });
      if (result.ok) {
        toast.success(`${roomId} is yours for the next ${BOOKING_RULES.defaultNowMinutes} minutes.`);
        onBooked();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={grab}
      disabled={pending}
      className="relative z-10 mb-1 self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
    >
      {pending ? "Booking…" : "Grab it now"}
    </button>
  );
}