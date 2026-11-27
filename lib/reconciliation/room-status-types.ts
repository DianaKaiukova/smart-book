import type { NoiseLevel, RoomState } from "@/lib/reconciliation/engine";

// Serializable shapes shared by the server, /api/state and client components.

export type LiveBooking = {
  id: string;
  userId: string;
  holderName: string;
  start: string;
  end: string;
  status: "RESERVED" | "CHECKED_IN";
  checkedInAt: string | null;
};

export type LiveRoomStatus = {
  roomId: string;
  state: RoomState;
  since: string;
  booked: boolean;
  occupied: boolean;
  /** False when there is no recent sensor data for the room. */
  sensorOnline: boolean;
  noiseDb?: number;
  noiseLevel?: NoiseLevel;
  peopleCount?: number;
  ghostAt?: string;
  activeBooking?: LiveBooking;
  nextBooking?: Omit<LiveBooking, "checkedInAt" | "status">;
};

/** What a non-admin viewer may see about a room's live state. */
export type PublicBooking = {
  id: string;
  holderFirstName: string;
  isMine: boolean;
  start: string;
  end: string;
  checkedIn: boolean;
};

export type PublicRoomStatus = Omit<LiveRoomStatus, "activeBooking" | "nextBooking"> & {
  activeBooking?: PublicBooking;
  nextBooking?: Omit<PublicBooking, "checkedIn">;
};

export type StateResponse = { now: string; rooms: PublicRoomStatus[] };
