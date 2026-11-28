"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { scheduleClassAction } from "@/lib/courses/actions";

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

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function ScheduleClassForm({
  courseId,
  rooms,
}: {
  courseId: string;
  rooms: { id: string; name: string; category: string | null }[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const input = {
      courseId,
      roomId: String(formData.get("roomId") ?? ""),
      weekday: Number(formData.get("weekday")),
      startMin: toMinutes(String(formData.get("startTime") ?? "09:00")),
      endMin: toMinutes(String(formData.get("endTime") ?? "11:00")),
      frequency: String(formData.get("frequency") ?? "WEEKLY") as "WEEKLY" | "BIWEEKLY",
    };
    startTransition(async () => {
      const result = await scheduleClassAction(input);
      if (result.ok) toast.success(result.message ?? "Scheduled.");
      else toast.error(result.error);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">Add a weekly session</h2>
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
          <input type="time" name="startTime" defaultValue="09:00" required className={INPUT} />
        </label>
        <label className="text-xs text-ink-muted">
          End
          <input type="time" name="endTime" defaultValue="11:00" required className={INPUT} />
        </label>
      </div>
      <label className="text-xs text-ink-muted">
        Room
        <select name="roomId" required className={INPUT}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Scheduling…" : "Schedule for the semester"}
      </button>
    </form>
  );
}
