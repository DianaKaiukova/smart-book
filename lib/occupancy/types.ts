export type OccupancySourceKind = "board" | "sim";

/** The ONE thing an occupancy source produces. Sim now, PSOC Edge board later. */
export type OccupancyEvent = {
  roomId: string;
  occupied: boolean;
  peopleCount?: number;
  noiseDb?: number;
  confidence?: number;
  source: OccupancySourceKind;
  ts: string;
};

export interface OccupancySource {
  subscribe(onEvent: (event: OccupancyEvent) => void): void;
}

/** Latest known signal per room, kept in memory only. */
export type RoomSignal = {
  roomId: string;
  occupied: boolean;
  peopleCount?: number;
  noiseDb?: number;
  confidence?: number;
  source: OccupancySourceKind;
  ts: Date;
  /** When the room last flipped to empty; undefined while occupied. */
  emptySince?: Date;
  /** When the room last flipped to occupied; undefined while empty. */
  occupiedSince?: Date;
};

/** Door interaction (S5, board-only later) — applied by /api/room-action. */
export type RoomActionEvent = {
  roomId: string;
  action: "book_now" | "extend" | "checkin";
  via: "voice" | "gesture";
  ts: string;
};
