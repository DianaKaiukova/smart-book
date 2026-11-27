"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Styled replacement for <input type="date">. Values are local "YYYY-MM-DD" strings. */
export function DatePicker({
  value,
  min,
  max,
  onChange,
  ariaLabel = "Date",
}: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(value));

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const today = min;
  const canPrev = month > monthOf(min);
  const canNext = month < monthOf(max);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open) setMonth(monthOf(value));
          setOpen(!open);
        }}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm text-ink tabular-nums transition-colors",
          open ? "border-accent ring-2 ring-accent/15" : "border-line hover:border-ink-muted",
        )}
      >
        {formatLabel(value)}
        <CalendarDays className="size-4 text-ink-muted" aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-line bg-surface p-3 shadow-(--shadow-md)"
        >
          <div className="mb-2 flex items-center justify-between">
            <MonthButton label="Previous month" disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft className="size-4" aria-hidden />
            </MonthButton>
            <span className="text-sm font-semibold text-ink">{monthTitle(month)}</span>
            <MonthButton label="Next month" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight className="size-4" aria-hidden />
            </MonthButton>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-xs font-medium text-ink-muted">
                {d}
              </span>
            ))}
            {daysGrid(month).map((day, i) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  disabled={day < min || day > max}
                  aria-pressed={day === value}
                  aria-label={formatLabel(day)}
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    "disabled:cursor-not-allowed disabled:text-ink-muted/40",
                    day === value
                      ? "bg-accent font-semibold text-white"
                      : "text-ink enabled:hover:bg-subtle",
                    day === today && day !== value && "font-semibold text-accent ring-1 ring-line ring-inset",
                  )}
                >
                  {Number(day.slice(8))}
                </button>
              ) : (
                <span key={`blank-${i}`} />
              ),
            )}
          </div>

          <div className="mt-2 flex justify-end border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-subtle"
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg text-ink-secondary hover:bg-subtle disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** "YYYY-MM" of a "YYYY-MM-DD" string; compares correctly as a string. */
function monthOf(day: string): string {
  return day.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Monday-first grid of "YYYY-MM-DD" strings, with nulls for leading blanks. */
function daysGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const days: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= count; d++) days.push(`${month}-${String(d).padStart(2, "0")}`);
  return days;
}

function formatLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
