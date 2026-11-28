"use client";

import { Sparkles } from "lucide-react";
import { useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { clearPlanAction, deleteDeadlineAction, generatePlanAction } from "@/lib/planner/actions";

export function GeneratePlanButton({ disabled }: { disabled: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await generatePlanAction();
          if (result.ok) toast.success(result.message ?? "Planned.");
          else toast.error(result.error);
        })
      }
      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
    >
      <Sparkles className="size-4" aria-hidden />
      {pending ? "Planning…" : "Generate study plan"}
    </button>
  );
}

export function ClearPlanButton() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await clearPlanAction();
          if (result.ok) toast.success(result.message ?? "Cleared.");
          else toast.error(result.error);
        })
      }
      className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-60"
    >
      Clear plan
    </button>
  );
}

export function DeleteDeadlineButton({ id }: { id: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteDeadlineAction(id);
          if (result.ok) toast.success(result.message ?? "Removed.");
          else toast.error(result.error);
        })
      }
      className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:border-danger hover:text-danger disabled:opacity-60"
    >
      Remove
    </button>
  );
}
