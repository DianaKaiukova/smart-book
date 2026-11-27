"use client";

import { Ghost, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { NoiseBadge } from "@/components/rooms/status-badge";
import { SlideToConfirmButton } from "@/components/ui/slide-to-confirm-button";
import { cn } from "@/lib/cn";
import { formatRange, formatTime } from "@/lib/format";
import type { RoomState } from "@/lib/reconciliation/engine";
import type { DoorState } from "@/lib/rooms/door-types";
import { usePolling } from "@/lib/use-polling";

const SCREEN: Record<RoomState, { title: string; bg: string }> = {
  free: { title: "Available", bg: "from-success to-success" },
  booked: { title: "Booked", bg: "from-accent to-accent-hover" },
  booked_in_use: { title: "In use", bg: "from-ink-secondary to-ink" },
  occupied: { title: "In use · not booked", bg: "from-warning to-warning" },
  ghost_booking: { title: "Booked, but empty", bg: "from-accent to-accent-hover" },
};

export function DoorKiosk({ initial, pollIntervalMs }: { initial: DoorState; pollIntervalMs: number }) {
  const router = useRouter();
  const url = `/api/rooms/${encodeURIComponent(initial.room.id)}/status`;
  const { data, error } = usePolling<DoorState>(url, pollIntervalMs, initial);
  const { room, status, upcomingToday } = data;
  const screen = SCREEN[status.state];
  const booking = status.activeBooking;
  const grabbable = status.state === "free" || status.state === "ghost_booking";

  return (
    <div className={cn("flex flex-1 flex-col bg-gradient-to-br p-6 transition-colors duration-700 sm:p-10", screen.bg)}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-lg text-white/70">{room.id}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{room.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-white/70">
            <Users className="size-4" aria-hidden /> {room.capacity} people
            {room.amenities.length ? ` · ${room.amenities.join(", ")}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-light tabular-nums sm:text-4xl" suppressHydrationWarning>
            {formatTime(data.now)}
          </p>
          {error ? <p className="text-xs text-white/60">offline — retrying</p> : null}
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-4 py-10">
        <p className="flex items-center gap-3 text-5xl font-bold tracking-tight sm:text-7xl">
          {status.state === "ghost_booking" ? <Ghost className="size-12 sm:size-16" aria-hidden /> : null}
          {screen.title}
        </p>
        <p className="text-lg text-white/85 sm:text-2xl" suppressHydrationWarning>
          {status.state === "free" &&
            (status.nextBooking ? `Free until ${formatTime(status.nextBooking.start)}` : "Free for the rest of the day")}
          {status.state === "booked" && booking && `${booking.holderFirstName} · ${formatRange(booking.start, booking.end)} — waiting for check-in`}
          {status.state === "booked_in_use" && booking && `${booking.holderFirstName} · until ${formatTime(booking.end)}`}
          {status.state === "ghost_booking" &&
            booking &&
            `${booking.holderFirstName} booked until ${formatTime(booking.end)} but nobody is here. Grab it!`}
          {status.state === "occupied" && "Someone is using this room without a booking. Please book it in SmartBook."}
        </p>
        <div className="text-white">
          <NoiseBadge level={status.noiseLevel} db={status.noiseDb} sensorOnline={status.sensorOnline} />
        </div>

        {grabbable ? (
          <div className="mt-4 max-w-md">
            <SlideToConfirmButton
              label={status.state === "ghost_booking" ? "Slide to grab this room" : "Slide to book now"}
              confirmedLabel="Opening SmartBook…"
              onConfirm={() => router.push(`/rooms/${encodeURIComponent(room.id)}`)}
            />
          </div>
        ) : null}
      </section>

      <footer className="border-t border-white/20 pt-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-white/60">Later today</p>
        {upcomingToday.length === 0 ? (
          <p className="text-sm text-white/70">No more bookings today.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm" suppressHydrationWarning>
            {upcomingToday.map((b) => (
              <li key={b.start}>
                <span className="tabular-nums">{formatRange(b.start, b.end)}</span>{" "}
                <span className="text-white/70">{b.holderFirstName}</span>
              </li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}
