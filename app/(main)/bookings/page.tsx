import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BookingActions } from "@/components/bookings/booking-actions";
import { requireUser } from "@/lib/auth/session";
import { listMyBookings, type BookingView } from "@/lib/booking/booking-service";
import { cn } from "@/lib/cn";
import { LocalDayRange } from "@/components/bookings/local-time";

export const metadata: Metadata = { title: "My bookings" };

export default function BookingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">My bookings</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-subtle" />}>
        <BookingLists />
      </Suspense>
    </div>
  );
}

async function BookingLists() {
  const user = await requireUser();
  const now = new Date();
  const { upcoming, history } = await listMyBookings(user.id, now);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            No upcoming bookings. <Link href="/" className="font-medium text-accent">Find a room</Link> or ask the
            assistant.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} now={now.getTime()} actions />
            ))}
          </ul>
        )}
      </section>
      {history.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Recent</h2>
          <ul className="flex flex-col gap-2">
            {history.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const STATUS_STYLE: Record<BookingView["status"], string> = {
  RESERVED: "bg-accent-soft text-accent-hover",
  CHECKED_IN: "bg-success-soft text-success",
  COMPLETED: "bg-subtle text-ink-secondary",
  CANCELLED: "bg-subtle text-ink-muted line-through",
  GHOST_RELEASED: "bg-accent-soft text-accent-hover",
};

const STATUS_LABEL: Record<BookingView["status"], string> = {
  RESERVED: "Reserved",
  CHECKED_IN: "Checked in",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  GHOST_RELEASED: "Released (no-show)",
};

function BookingRow({ booking, now, actions = false }: { booking: BookingView; now?: number; actions?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <Link href={`/rooms/${encodeURIComponent(booking.roomId)}`} className="font-medium text-ink hover:underline">
          <span className="font-mono">{booking.roomId}</span> · {booking.roomName}
        </Link>
        <p className="text-sm text-ink-secondary">
          <LocalDayRange start={booking.start} end={booking.end} />
        </p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[booking.status])}>
        {STATUS_LABEL[booking.status]}
      </span>
      {actions ? (
        <BookingActions bookingId={booking.id} start={booking.start} end={booking.end} checkedIn={booking.status === "CHECKED_IN"} now={now ?? 0} />
      ) : null}
    </li>
  );
}
