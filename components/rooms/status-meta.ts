import type { NoiseLevel, RoomState } from "@/lib/reconciliation/engine";

export const STATE_META: Record<
  RoomState,
  { label: string; short: string; dot: string; badge: string; tile: string }
> = {
  free: {
    label: "Free",
    short: "Free",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    tile: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100",
  },
  booked: {
    label: "Booked · holder not here yet",
    short: "Booked",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    tile: "border-sky-300 bg-sky-50 hover:bg-sky-100",
  },
  booked_in_use: {
    label: "Booked · in use",
    short: "In use",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    tile: "border-indigo-300 bg-indigo-50 hover:bg-indigo-100",
  },
  occupied: {
    label: "Occupied · not booked",
    short: "Occupied",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-800 ring-orange-200",
    tile: "border-orange-300 bg-orange-50 hover:bg-orange-100",
  },
  ghost_booking: {
    label: "Ghost booking · booked but empty",
    short: "Ghost",
    dot: "bg-fuchsia-500 animate-pulse",
    badge: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-300",
    tile: "border-fuchsia-400 bg-fuchsia-50 hover:bg-fuchsia-100 ring-2 ring-fuchsia-300",
  },
};

export const NOISE_META: Record<NoiseLevel, { label: string; className: string }> = {
  quiet: { label: "Quiet", className: "text-emerald-700" },
  moderate: { label: "Moderate", className: "text-amber-700" },
  loud: { label: "Loud", className: "text-rose-700" },
};
