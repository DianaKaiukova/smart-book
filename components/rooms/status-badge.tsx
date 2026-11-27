import { Volume1, Volume2, VolumeX, WifiOff } from "lucide-react";

import { cn } from "@/lib/cn";
import type { NoiseLevel, RoomState } from "@/lib/reconciliation/engine";

import { NOISE_META, STATE_META } from "./status-meta";

export function StatusBadge({ state, long = false, className }: { state: RoomState; long?: boolean; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-ink",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
      {long ? meta.label : meta.short}
    </span>
  );
}

export function NoiseBadge({
  level,
  db,
  sensorOnline,
  className,
}: {
  level?: NoiseLevel;
  db?: number;
  sensorOnline: boolean;
  className?: string;
}) {
  if (!sensorOnline) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-ink-muted", className)} title="No recent sensor data">
        <WifiOff className="size-3.5" aria-hidden /> No sensor
      </span>
    );
  }
  if (!level) return null;
  const Icon = level === "quiet" ? VolumeX : level === "moderate" ? Volume1 : Volume2;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-ink-secondary tabular-nums", className)}>
      <Icon className="size-3.5" aria-hidden />
      {NOISE_META[level].label}
      {db !== undefined ? <span>{Math.round(db)} dB</span> : null}
    </span>
  );
}