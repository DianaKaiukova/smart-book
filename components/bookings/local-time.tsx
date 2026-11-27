"use client";

import { formatDayRange } from "@/lib/format";

/** Renders in the browser's timezone (server output may differ, so hydration warnings are suppressed). */
export function LocalDayRange({ start, end }: { start: string; end: string }) {
  return <span suppressHydrationWarning>{formatDayRange(start, end)}</span>;
}
