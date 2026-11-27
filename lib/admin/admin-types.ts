import type { SimSnapshot } from "@/lib/occupancy/sim-source";
import type { LiveRoomStatus } from "@/lib/reconciliation/room-status-types";

export type AdminRoomStatus = LiveRoomStatus & { name: string; floor: string; capacity: number };

export type AdminStats = {
  bookingsToday: number;
  bookedHoursToday: number;
  checkedInRate: number | null;
  ghostsReleasedToday: number;
  roomsInUseNow: number;
  roomCount: number;
};

export type AdminState = {
  now: string;
  occupancySource: "sim" | "board";
  ghostAfterMinutes: number;
  rooms: AdminRoomStatus[];
  sim: SimSnapshot | null;
  stats: AdminStats;
};
