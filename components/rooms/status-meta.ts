import type { NoiseLevel, RoomState } from "@/lib/reconciliation/engine";

// Each status has one colour, used for the dot, the soft pill and the card's top stripe.
// Static class strings so Tailwind can see them.
export const STATE_META: Record<RoomState, { label: string; short: string; dot: string; pill: string; stripe: string }> = {
  free: {
    label: "Free",
    short: "Free",
    dot: "bg-status-free",
    pill: "bg-success-soft text-success",
    stripe: "border-t-status-free",
  },
  ghost_booking: {
    label: "Ghost booking · booked but empty",
    short: "Ghost",
    dot: "bg-warning",
    pill: "bg-warning-soft text-warning",
    stripe: "border-t-status-ghost",
  },
  booked: {
    label: "Booked · holder not here yet",
    short: "Booked",
    dot: "bg-status-busy",
    pill: "bg-subtle text-ink-secondary",
    stripe: "border-t-status-busy",
  },
  booked_in_use: {
    label: "Booked · in use",
    short: "In use",
    dot: "bg-status-inuse",
    pill: "bg-accent-soft text-slate",
    stripe: "border-t-status-inuse",
  },
  occupied: {
    label: "Occupied · not booked",
    short: "Occupied",
    dot: "bg-status-occ",
    pill: "bg-accent-soft text-accent",
    stripe: "border-t-status-occ",
  },
};

export const NOISE_META: Record<NoiseLevel, { label: string }> = {
  quiet: { label: "Quiet" },
  moderate: { label: "Moderate" },
  loud: { label: "Loud" },
};