"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { createCourseAction } from "@/lib/courses/actions";

const INPUT = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function NewCourseForm() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const today = new Date();
  const term = new Date(today.getTime() + 112 * 24 * 60 * 60 * 1000); // ~16 weeks

  function submit(formData: FormData) {
    const input = {
      code: String(formData.get("code") ?? ""),
      title: String(formData.get("title") ?? ""),
      termStart: String(formData.get("termStart") ?? ""),
      termEnd: String(formData.get("termEnd") ?? ""),
    };
    startTransition(async () => {
      const result = await createCourseAction(input);
      if (result.ok) {
        toast.success(result.message ?? "Course created.");
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
        + New course
      </button>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">New course</h2>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <input name="code" required maxLength={20} placeholder="MATH-201" className={INPUT} />
        <input name="title" required maxLength={120} placeholder="Course title" className={INPUT} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-muted">
          Term starts
          <input type="date" name="termStart" required defaultValue={iso(today)} className={INPUT} />
        </label>
        <label className="text-xs text-ink-muted">
          Term ends
          <input type="date" name="termEnd" required defaultValue={iso(term)} className={INPUT} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create course"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
