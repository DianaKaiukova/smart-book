"use client";

import { cn } from "@/lib/cn";
import { formatTime, fromLocalInputs } from "@/lib/format";

export type BusySlot = { id: string; start: string; end: string; isMine: boolean };

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const CELL_MINUTES = 30;

/** Day calendar: 30-minute cells, busy/mine/past states; tap a free cell to pick a start time. */
export function DayTimeline({
  day,
  now,
  busy,
  selected,
  onSelect,
}: {
  day: string;
  now: number;
  busy: BusySlot[];
  selected: { start: Date; end: Date } | null;
  onSelect: (time: string) => void;
}) {
  const cells = [];
  for (let minutes = DAY_START_HOUR * 60; minutes < DAY_END_HOUR * 60; minutes += CELL_MINUTES) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const start = fromLocalInputs(day, time);
    const end = new Date(start.getTime() + CELL_MINUTES * 60_000);
    const hit = busy.find((b) => new Date(b.start) < end && new Date(b.end) > start);
    const past = end.getTime() <= now;
    const isSelected = selected ? selected.start < end && selected.end > start : false;
    cells.push({ time, start, hit, past, isSelected });
  }

  return (
    <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-10">
      {cells.map((cell) => {
        const disabled = cell.past || Boolean(cell.hit);
        return (
          <button
            key={cell.time}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(cell.time)}
            title={cell.hit ? `${formatTime(cell.hit.start)}–${formatTime(cell.hit.end)}${cell.hit.isMine ? " (you)" : ""}` : undefined}
            className={cn(
              "rounded-md border px-1 py-1.5 text-center text-[11px] tabular-nums transition-colors",
              cell.isSelected && "border-accent bg-accent text-white",
              !cell.isSelected && cell.hit?.isMine && "border-accent-soft bg-accent-soft text-accent-hover",
              !cell.isSelected && cell.hit && !cell.hit.isMine && "border-line bg-line text-ink-muted line-through",
              !cell.isSelected && !cell.hit && cell.past && "border-transparent bg-canvas text-ink-muted",
              !cell.isSelected && !cell.hit && !cell.past && "border-success-soft bg-success-soft text-success hover:border-success",
            )}
          >
            {cell.time}
          </button>
        );
      })}
    </div>
  );
}
