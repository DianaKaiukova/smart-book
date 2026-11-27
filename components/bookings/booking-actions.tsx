"use client";

import { useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { cancelBookingAction, checkInAction } from "@/lib/booking/actions";
import { BOOKING_RULES } from "@/lib/booking/rules";

export function BookingActions({
  bookingId,
  start,
  end,
  checkedIn,
  now,
}: {
  bookingId: string;
  start: string;
  end: string;
  checkedIn: boolean;
  /** Server render time (ms); avoids impure Date.now() during render. */
  now: number;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const startMs = new Date(start).getTime();
  const checkInOpen =
    !checkedIn &&
    now >= startMs - BOOKING_RULES.checkInEarlyMinutes * 60_000 &&
    now < new Date(end).getTime();

  function run(action: () => ReturnType<typeof checkInAction>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message ?? "Done.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex gap-2">
      {checkInOpen ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => checkInAction(bookingId))}
          className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          Check in
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => cancelBookingAction(bookingId))}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  );
}
