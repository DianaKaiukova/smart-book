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
      <span className="flex shrink-0 items-center gap-2 text-xs text-(--text-secondary)">
        <span aria-hidden className="size-2 rounded-full bg-(--status-occ)" />
        Reconnecting…
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs text-(--text-secondary) tabular-nums" aria-live="off">
      <span aria-hidden className="live-dot" />
      Live · {formatTime(status.now)}
    </span>
  );
}
