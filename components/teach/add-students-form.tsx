"use client";

import { useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { addStudentsAction } from "@/lib/courses/actions";

export function AddStudentsForm({ courseId }: { courseId: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const emails = String(formData.get("emails") ?? "");
    startTransition(async () => {
      const result = await addStudentsAction({ courseId, emails });
      if (result.ok) toast.success(result.message ?? "Added.");
      else toast.error(result.error);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">Add students</h2>
      <p className="text-xs text-ink-muted">
        Paste student emails (commas, spaces or new lines). Unregistered emails are held until they sign up.
      </p>
      <textarea
        name="emails"
        required
        rows={3}
        placeholder="alex@uni.edu, sam@uni.edu"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to roster"}
      </button>
    </form>
  );
}
