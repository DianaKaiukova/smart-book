"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { DatePicker } from "@/components/ui/date-picker";
import { createMeetingAction } from "@/lib/courses/actions";

const INPUT = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

const WEEKDAYS = [
  { v: 1, l: "Monday" },
  { v: 2, l: "Tuesday" },
  { v: 3, l: "Wednesday" },
  { v: 4, l: "Thursday" },
  { v: 5, l: "Friday" },
  { v: 6, l: "Saturday" },
  { v: 0, l: "Sunday" },
];

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function NewMeetingForm({ rooms }: { rooms: { id: string; name: string }[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const today = iso(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(iso(new Date(Date.now() + 56 * 86400000))); // 8 weeks

  function submit(formData: FormData) {
    const input = {
      title: String(formData.get("title") ?? ""),
      roomId: String(formData.get("roomId") ?? ""),
      weekday: Number(formData.get("weekday")),
      startMin: toMinutes(String(formData.get("startTime") ?? "16:00")),
      endMin: toMinutes(String(formData.get("endTime") ?? "17:00")),
      frequency: String(formData.get("frequency") ?? "WEEKLY") as "WEEKLY" | "BIWEEKLY",
      startDate,
      endDate,
    };
    startTransition(async () => {
      const result = await createMeetingAction(input);
      if (result.ok) {
        toast.success(result.message ?? "Meeting scheduled.");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        + New recurring meeting
      </button>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">New recurring meeting</h2>
      <input name="title" maxLength={80} placeholder="Study group (optional title)" className={INPUT} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-muted">
          Day
          <select name="weekday" defaultValue={1} className={INPUT}>
            {WEEKDAYS.map((d) => (
              <option key={d.v} value={d.v}>
                {d.l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Frequency
          <select name="frequency" defaultValue="WEEKLY" className={INPUT}>
            <option value="WEEKLY">Every week</option>
            <option value="BIWEEKLY">Every 2 weeks</option>
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Start
          <input type="time" name="startTime" defaultValue="16:00" required className={INPUT} />
        </label>
        <label className="text-xs text-ink-muted">
          End
          <input type="time" name="endTime" defaultValue="17:00" required className={INPUT} />
        </label>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          From
          <DatePicker value={startDate} min={today} onChange={setStartDate} ariaLabel="From date" />
        </div>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          Until
          <DatePicker value={endDate} min={startDate} onChange={setEndDate} ariaLabel="Until date" />
        </div>
      </div>
      <label className="text-xs text-ink-muted">
        Room (study &amp; meeting rooms)
        <select name="roomId" required className={INPUT}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Scheduling…" : "Schedule meeting"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
