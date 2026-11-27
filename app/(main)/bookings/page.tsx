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
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">My bookings</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-neutral-100" />}>
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            No upcoming bookings. <Link href="/" className="font-medium text-indigo-600">Find a room</Link> or ask the
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Recent</h2>
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
  RESERVED: "bg-sky-50 text-sky-800",
  CHECKED_IN: "bg-emerald-50 text-emerald-800",
  COMPLETED: "bg-neutral-100 text-neutral-600",
  CANCELLED: "bg-neutral-100 text-neutral-500 line-through",
  GHOST_RELEASED: "bg-fuchsia-50 text-fuchsia-800",
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
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <Link href={`/rooms/${encodeURIComponent(booking.roomId)}`} className="font-medium text-neutral-900 hover:underline">
          <span className="font-mono">{booking.roomId}</span> · {booking.roomName}
        </Link>
        <p className="text-sm text-neutral-600">
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
