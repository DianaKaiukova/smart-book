"use client";

import { CalendarPlus, Ghost, LogIn, Users, X, Zap } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { DayTimeline, type BusySlot } from "@/components/rooms/day-timeline";
import { NoiseBadge, StatusBadge } from "@/components/rooms/status-badge";
import { SegmentedToggleButton } from "@/components/ui/segmented-toggle-button";
import { bookNowAction, bookSlotAction, cancelBookingAction, checkInAction } from "@/lib/booking/actions";
import { BOOKING_RULES, NOW_DURATION_OPTIONS } from "@/lib/booking/rules";
import { formatDayRange, formatRange, formatTime, fromLocalInputs, toDateInputValue } from "@/lib/format";
import type { StateResponse } from "@/lib/reconciliation/room-status-types";
import type { RoomView } from "@/lib/rooms/rooms-types";
import { usePolling } from "@/lib/use-polling";

const DURATION_LABELS = NOW_DURATION_OPTIONS.map((m) => (m < 60 ? `${m}m` : `${m / 60}h`.replace(".5h", "h30")));
const SLOT_DURATIONS = [30, 60, 90, 120, 180, 240].filter((m) => m <= BOOKING_RULES.maxSlotMinutes);

export function RoomDetail({
  room,
  initial,
  busy,
  pollIntervalMs,
}: {
  room: RoomView;
  initial: StateResponse;
  busy: BusySlot[];
  pollIntervalMs: number;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const { data, refresh } = usePolling<StateResponse>("/api/state", pollIntervalMs, initial);
  const status = data.rooms.find((s) => s.roomId === room.id) ?? initial.rooms[0];
  const state = status?.state ?? "free";
  const active = status?.activeBooking;

  const [nowMinutes, setNowMinutes] = useState<number>(BOOKING_RULES.defaultNowMinutes);
  const [day, setDay] = useState(() => toDateInputValue(new Date(initial.now)));
  const [startTime, setStartTime] = useState<string | null>(null);
  const [slotMinutes, setSlotMinutes] = useState(60);

  const canBookNow = (state === "free" || state === "ghost_booking") && !active?.isMine;
  const nextStart = status?.nextBooking ? new Date(status.nextBooking.start) : null;
  const nowMs = new Date(data.now).getTime();
  const maxNowFits = nextStart ? Math.floor((nextStart.getTime() - nowMs) / 60_000) : Infinity;

  const minDay = toDateInputValue(new Date(nowMs));
  const maxDay = toDateInputValue(new Date(nowMs + BOOKING_RULES.maxDaysAhead * 24 * 60 * 60 * 1000));

  function run<T>(action: () => Promise<{ ok: true; data: T; message?: string } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? success);
        void refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const slotRange = useMemo(() => {
    if (!startTime) return null;
    const start = fromLocalInputs(day, startTime);
    return { start, end: new Date(start.getTime() + slotMinutes * 60_000) };
  }, [day, startTime, slotMinutes]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-neutral-500">{room.id} · Floor {room.floor}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{room.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden /> {room.capacity} people
              </span>
              {room.amenities.map((a) => (
                <span key={a} className="rounded-full bg-neutral-100 px-2 py-0.5">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge state={state} long />
            {status ? <NoiseBadge level={status.noiseLevel} db={status.noiseDb} sensorOnline={status.sensorOnline} /> : null}
          </div>
        </div>

        {state === "ghost_booking" ? (
          <div className="flex gap-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3 text-sm text-fuchsia-900">
            <Ghost className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              Booked by {active?.holderFirstName ?? "someone"}, but sensors show nobody has been here
              {status?.ghostAt ? ` since ${formatTime(status.ghostAt)}` : ""}. Book it now and the ghost booking is released.
            </p>
          </div>
        ) : null}

        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
            <span>
              <span className="font-medium">{active.isMine ? "Your booking" : `Booked by ${active.holderFirstName}`}</span>{" "}
              · {formatRange(active.start, active.end)}
              {active.checkedIn ? <span className="ml-2 text-emerald-700">checked in</span> : null}
            </span>
            {active.isMine ? (
              <div className="flex gap-2">
                {!active.checkedIn ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => checkInAction(active.id), "Checked in.")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <LogIn className="size-3.5" aria-hidden /> Check in
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => cancelBookingAction(active.id), "Booking cancelled.")}
                  className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-white disabled:opacity-60"
                >
                  <X className="size-3.5" aria-hidden /> Cancel
                </button>
              </div>
            ) : null}
          </div>
        ) : status?.nextBooking ? (
          <p className="text-sm text-neutral-600">
            Next booking: {status.nextBooking.isMine ? "you" : status.nextBooking.holderFirstName} at{" "}
            {formatTime(status.nextBooking.start)}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Schedule</h2>
            <input
              type="date"
              value={day}
              min={minDay}
              max={maxDay}
              onChange={(e) => {
                setDay(e.target.value || minDay);
                setStartTime(null);
              }}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <DayTimeline day={day} now={nowMs} busy={busy} selected={slotRange} onSelect={setStartTime} />
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
            <Zap className="size-4 text-amber-500" aria-hidden /> Book now
          </h2>
          {canBookNow ? (
            <>
              <SegmentedToggleButton
                options={DURATION_LABELS}
                defaultIndex={NOW_DURATION_OPTIONS.indexOf(BOOKING_RULES.defaultNowMinutes as 60)}
                onChange={(index) => setNowMinutes(NOW_DURATION_OPTIONS[index])}
              />
              {nowMinutes > maxNowFits ? (
                <p className="text-xs text-amber-700">
                  Someone has it from {formatTime(nextStart!)} — pick {maxNowFits} min or less.
                </p>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => bookNowAction({ roomId: room.id, minutes: nowMinutes }), `${room.id} is yours.`)
                }
                className="h-10 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {state === "ghost_booking" ? "Grab this room" : "Book now"} · {nowMinutes} min
              </button>
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              {active?.isMine ? "You already have this room." : "This room is in use right now."}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
            <CalendarPlus className="size-4 text-indigo-500" aria-hidden /> Book a slot
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">Start</span>
              <input
                type="time"
                step={900}
                value={startTime ?? ""}
                onChange={(e) => setStartTime(e.target.value || null)}
                className="rounded-lg border border-neutral-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">Duration</span>
              <select
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
                className="rounded-lg border border-neutral-300 px-2 py-1.5"
              >
                {SLOT_DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-neutral-500">
            {slotRange ? formatDayRange(slotRange.start.toISOString(), slotRange.end.toISOString()) : "Pick a start time or tap a free cell in the schedule."}
          </p>
          <button
            type="button"
            disabled={pending || !slotRange}
            onClick={() =>
              slotRange &&
              run(
                () =>
                  bookSlotAction({
                    roomId: room.id,
                    start: slotRange.start.toISOString(),
                    end: slotRange.end.toISOString(),
                  }),
                "Booked.",
              )
            }
            className="h-10 rounded-lg border border-indigo-600 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Book slot
          </button>
        </section>
      </aside>
    </div>
  );
}
