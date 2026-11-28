"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";

export type CalendarEvent = {
  id: string;
  title: string;
  roomId: string;
  roomName: string;
  start: string;
  end: string;
  source: "class" | "meeting" | "booking" | "study";
  mine: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const SOURCE_STYLE: Record<CalendarEvent["source"], string> = {
  class: "border-accent/40 bg-accent/10 text-ink",
  meeting: "border-success/40 bg-success-soft text-ink",
  study: "border-amber-400/50 bg-amber-100/70 text-ink",
  booking: "border-line bg-canvas text-ink",
};

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [offset, setOffset] = useState(0);

  const weekStart = useMemo(() => {
    const s = startOfWeek(new Date());
    s.setDate(s.getDate() + offset * 7);
    return s;
  }, [offset]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)),
    [weekStart],
  );

  const byDay = useMemo(
    () =>
      days.map((d) =>
        events
          .filter((e) => sameDay(new Date(e.start), d))
          .sort((a, b) => a.start.localeCompare(b.start)),
      ),
    [days, events],
  );

  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(weekStart);
  const today = new Date();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="flex size-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className="flex size-8 items-center justify-center rounded-lg border border-line hover:bg-canvas"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className="flex min-h-40 flex-col gap-1.5 rounded-xl border border-line bg-white p-2">
              <div className={cn("flex items-baseline gap-1.5 px-1", isToday && "text-accent")}>
                <span className="text-xs font-semibold uppercase">{WEEKDAYS[i]}</span>
                <span className={cn("text-sm font-semibold", isToday ? "text-accent" : "text-ink")}>
                  {d.getDate()}
                </span>
              </div>
              {byDay[i].length === 0 ? (
                <span className="px-1 pt-1 text-xs text-ink-muted">—</span>
              ) : (
                byDay[i].map((e) => (
                  <div
                    key={e.id}
                    className={cn("rounded-lg border px-2 py-1.5 text-xs leading-tight", SOURCE_STYLE[e.source])}
                    title={`${e.title} · ${e.roomId}`}
                  >
                    <div className="font-medium tabular-nums">
                      {formatTime(e.start)}–{formatTime(e.end)}
                    </div>
                    <div className="truncate font-semibold">{e.title}</div>
                    <div className="truncate text-ink-muted">{e.roomId}</div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-accent/40 bg-accent/10" /> Class
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-success/40 bg-success-soft" /> Meeting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-amber-400/50 bg-amber-100/70" /> Study
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-line bg-canvas" /> Booking
        </span>
      </div>
    </div>
  );
}
