"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { DatePicker } from "@/components/ui/date-picker";
import { addDeadlineAction } from "@/lib/planner/actions";

const INPUT = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AddDeadlineForm() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const today = localIso(new Date());
  const [dueDate, setDueDate] = useState(localIso(new Date(Date.now() + 14 * 86400000)));

  function submit(formData: FormData) {
    const input = {
      title: String(formData.get("title") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      dueDate,
      hours: Number(formData.get("hours")),
    };
    startTransition(async () => {
      const result = await addDeadlineAction(input);
      if (result.ok) {
        toast.success(result.message ?? "Added.");
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
        className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas"
      >
        + Add deadline
      </button>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">New deadline</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <input name="title" required maxLength={120} placeholder="e.g. Calculus II final" className={INPUT} />
        <input name="subject" maxLength={60} placeholder="Subject (optional)" className={INPUT} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          Due date
          <DatePicker value={dueDate} min={today} onChange={setDueDate} ariaLabel="Due date" />
        </div>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Study hours needed
          <input type="number" name="hours" required min={0.5} max={100} step={0.5} defaultValue={6} className={`${INPUT} h-9`} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add deadline"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
