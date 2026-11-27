"use client";

import { Ghost, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { NoiseBadge, StatusBadge } from "@/components/rooms/status-badge";
import { reclaimGhostAction, restartDemoAction, setSimOccupancyAction } from "@/lib/admin/actions";
import type { AdminRoomStatus, AdminState } from "@/lib/admin/admin-types";
import { cn } from "@/lib/cn";
import { formatRange, formatRelative, formatTime } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

export function AdminDashboard({ initial, pollIntervalMs }: { initial: AdminState; pollIntervalMs: number }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const { data, refresh } = usePolling<AdminState>("/api/admin/state", pollIntervalMs, initial);
  const ghosts = data.rooms.filter((r) => r.state === "ghost_booking");
  const simById = new Map((data.sim?.rooms ?? []).map((r) => [r.roomId, r]));
  const now = new Date(data.now).getTime();

  function reclaim(roomId: string) {
    startTransition(async () => {
      const result = await reclaimGhostAction(roomId);
      if (result.ok) toast.success(result.message ?? "Released.");
      else toast.error(result.error);
      void refresh();
    });
  }

  function override(roomId: string, occupied: boolean | null) {
    startTransition(async () => {
      const result = await setSimOccupancyAction({ roomId, occupied });
      if (!result.ok) toast.error(result.error);
      setTimeout(() => void refresh(), 300);
    });
  }

  function restart() {
    startTransition(async () => {
      const result = await restartDemoAction();
      if (result.ok) toast.success(result.message ?? "Restarted.");
      else toast.error(result.error);
      void refresh();
    });
  }

  const s = data.stats;
  const cards = [
    { label: "Rooms in use now", value: `${s.roomsInUseNow}/${s.roomCount}` },
    { label: "Bookings today", value: String(s.bookingsToday) },
    { label: "Booked hours today", value: String(s.bookedHoursToday) },
    { label: "Show-up rate", value: s.checkedInRate === null ? "–" : `${Math.round(s.checkedInRate * 100)}%` },
    { label: "Ghosts reclaimed today", value: String(s.ghostsReleasedToday) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-accent-soft bg-accent-soft/50 p-4">
        <h2 className="flex items-center gap-2 font-semibold text-accent-hover">
          <Ghost className="size-5" aria-hidden /> Ghost bookings ({ghosts.length})
        </h2>
        {ghosts.length === 0 ? (
          <p className="text-sm text-accent-hover/70">
            None right now. A booking becomes a ghost when its room stays empty {data.ghostAfterMinutes} min after the start.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ghosts.map((room) => (
              <li key={room.roomId} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm">
                <span className="font-mono font-semibold">{room.roomId}</span>
                <span className="flex-1">
                  {room.activeBooking?.holderName} · {room.activeBooking ? formatRange(room.activeBooking.start, room.activeBooking.end) : null}
                  {room.ghostAt ? <span className="text-ink-muted"> · empty, ghost since {formatTime(room.ghostAt)}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => reclaim(room.roomId)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
                >
                  Reclaim room
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Live occupancy · source: {data.occupancySource === "sim" ? "simulator" : "PSOC Edge board"}
          </h2>
          {data.sim ? (
            <button
              type="button"
              disabled={pending}
              onClick={restart}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Restart demo ({data.sim.secondsSinceStart}s)
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-canvas text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Sensor</th>
                <th className="px-3 py-2">Booking</th>
                {data.sim ? <th className="px-3 py-2">Simulate</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rooms.map((room) => (
                <AdminRow
                  key={room.roomId}
                  room={room}
                  now={now}
                  sim={simById.get(room.roomId)}
                  showSim={Boolean(data.sim)}
                  pending={pending}
                  onOverride={override}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminRow({
  room,
  now,
  sim,
  showSim,
  pending,
  onOverride,
}: {
  room: AdminRoomStatus;
  now: number;
  sim?: { mode: "script" | "manual" | "idle"; note?: string; occupied: boolean };
  showSim: boolean;
  pending: boolean;
  onOverride: (roomId: string, occupied: boolean | null) => void;
}) {
  const b = room.activeBooking;
  return (
    <tr className={cn(room.state === "ghost_booking" && "bg-accent-soft/60")}>
      <td className="px-3 py-2">
        <Link href={`/rooms/${encodeURIComponent(room.roomId)}`} className="font-mono font-medium hover:underline">
          {room.roomId}
        </Link>
        <p className="text-xs text-ink-muted">{room.name}</p>
      </td>
      <td className="px-3 py-2">
        <StatusBadge state={room.state} />
        {room.state === "booked" && room.ghostAt ? (
          <p className="mt-1 text-[11px] text-ink-muted">ghost {formatRelative(room.ghostAt, now)}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs">
        {room.sensorOnline ? (
          <span className={room.occupied ? "font-medium text-accent-hover" : "text-ink-muted"}>
            {room.occupied ? `occupied${room.peopleCount ? ` · ${room.peopleCount} ppl` : ""}` : "empty"}
          </span>
        ) : null}
        <div>
          <NoiseBadge level={room.noiseLevel} db={room.noiseDb} sensorOnline={room.sensorOnline} />
        </div>
      </td>
      <td className="px-3 py-2 text-xs">
        {b ? (
          <>
            {b.holderName} · {formatRange(b.start, b.end)}
            <span className={cn("ml-1", b.status === "CHECKED_IN" ? "text-success" : "text-ink-muted")}>
              {b.status === "CHECKED_IN" ? "checked in" : "not checked in"}
            </span>
          </>
        ) : room.nextBooking ? (
          <span className="text-ink-muted">next {formatTime(room.nextBooking.start)}</span>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
      {showSim ? (
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            {(
              [
                ["In", true],
                ["Out", false],
                ["Auto", null],
              ] as const
            ).map(([label, value]) => {
              const active = value === null ? sim?.mode !== "manual" : sim?.mode === "manual" && sim.occupied === value;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={pending}
                  onClick={() => onOverride(room.roomId, value)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    active ? "bg-ink text-white" : "bg-subtle text-ink-secondary hover:bg-line",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {sim?.note && sim.mode === "script" ? <p className="mt-1 text-[10px] text-ink-muted">{sim.note}</p> : null}
        </td>
      ) : null}
    </tr>
  );
}
