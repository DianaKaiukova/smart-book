"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { formatTime } from "@/lib/format";

// Lets a page with live data (the floor view) drive the "Live · HH:MM" indicator in the header.

type LiveStatus = { now: string; error: boolean };
type LiveStatusContextValue = { status: LiveStatus | null; setStatus: (status: LiveStatus | null) => void };

const LiveStatusContext = createContext<LiveStatusContextValue | null>(null);

export function LiveStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  return <LiveStatusContext value={{ status, setStatus }}>{children}</LiveStatusContext>;
}

/** Publishes live status to the header while the calling component is mounted. */
export function usePublishLiveStatus(now: string, error: boolean) {
  const setStatus = useContext(LiveStatusContext)?.setStatus;
  useEffect(() => {
    setStatus?.({ now, error });
  }, [setStatus, now, error]);
  useEffect(() => () => setStatus?.(null), [setStatus]);
}

export function LiveIndicator() {
  const status = useContext(LiveStatusContext)?.status;
  if (!status) return null;

  if (status.error) {
    return (
      <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[13px] text-white/90">
        <span aria-hidden className="size-2 rounded-full bg-warning" />
        Reconnecting…
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-medium text-white/90 tabular-nums" aria-live="off">
      <span aria-hidden className="live-dot bg-success-soft" />
      Live · {formatTime(status.now)}
    </span>
  );
}
