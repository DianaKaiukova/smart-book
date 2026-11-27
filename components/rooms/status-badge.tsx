import { Volume1, Volume2, VolumeX, WifiOff } from "lucide-react";

import { cn } from "@/lib/cn";
import type { NoiseLevel, RoomState } from "@/lib/reconciliation/engine";

import { NOISE_META, STATE_META } from "./status-meta";

export function StatusBadge({ state, long = false, className }: { state: RoomState; long?: boolean; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.badge,
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", meta.dot)} />
      {long ? meta.label : meta.short}
    </span>
  );
}

export function NoiseBadge({
  level,
  db,
  sensorOnline,
}: {
  level?: NoiseLevel;
  db?: number;
  sensorOnline: boolean;
}) {
  if (!sensorOnline) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-neutral-400" title="No recent sensor data">
        <WifiOff className="size-3.5" aria-hidden /> no sensor
      </span>
    );
  }
  if (!level) return null;
  const Icon = level === "quiet" ? VolumeX : level === "moderate" ? Volume1 : Volume2;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", NOISE_META[level].className)}>
      <Icon className="size-3.5" aria-hidden />
      {NOISE_META[level].label}
      {db !== undefined ? <span className="tabular-nums text-neutral-400">{Math.round(db)} dB</span> : null}
    </span>
  );
}
