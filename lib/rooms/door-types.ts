import type { PublicRoomStatus } from "@/lib/reconciliation/room-status-types";

export type DoorState = {
  now: string;
  room: { id: string; name: string; floor: string; capacity: number; amenities: string[] };
  status: PublicRoomStatus;
  upcomingToday: { start: string; end: string; holderFirstName: string }[];
};
