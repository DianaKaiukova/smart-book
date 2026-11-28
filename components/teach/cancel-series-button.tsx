"use client";

import { useTransition } from "react";

import { useToast } from "@/components/layout/toaster";
import { cancelSeriesAction } from "@/lib/courses/actions";

export function CancelSeriesButton({ seriesId }: { seriesId: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelSeriesAction(seriesId);
          if (result.ok) toast.success(result.message ?? "Cancelled.");
          else toast.error(result.error);
        })
      }
      className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-muted hover:border-danger hover:text-danger disabled:opacity-60"
    >
      Cancel
    </button>
  );
}
