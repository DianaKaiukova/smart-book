import type { NoiseLevel, RoomState } from "@/lib/reconciliation/engine";

// Status is conveyed only by the dot colour + label; pills and cards stay neutral.
export const STATE_META: Record<RoomState, { label: string; short: string; dot: string }> = {
  free: { label: "Free", short: "Free", dot: "bg-(--status-free)" },
  ghost_booking: { label: "Ghost booking · booked but empty", short: "Ghost", dot: "bg-(--status-ghost)" },
  booked: { label: "Booked · holder not here yet", short: "Booked", dot: "bg-(--status-busy)" },
  booked_in_use: { label: "Booked · in use", short: "In use", dot: "bg-(--status-busy)" },
  occupied: { label: "Occupied · not booked", short: "Occupied", dot: "bg-(--status-occ)" },
};

export const NOISE_META: Record<NoiseLevel, { label: string }> = {
  quiet: { label: "Quiet" },
  moderate: { label: "Moderate" },
  loud: { label: "Loud" },
};