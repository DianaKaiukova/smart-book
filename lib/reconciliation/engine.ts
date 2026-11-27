import type { BookingStatusValue } from "@/lib/booking/availability";

// Pure reconciliation rules (§6). Given the active booking, the latest occupancy
// signal and the clock, derive the room's state. No DB, no I/O.

export type RoomState =
  | "free" // no booking, nobody there
  | "occupied" // nobody booked it but someone is there (squatter, S2)
  | "booked" // booked, holder not there yet (still inside ghost grace period)
  | "booked_in_use" // booked and occupied (auto check-in, S1)
  | "ghost_booking"; // booked but empty for >= threshold (hero)

export type NoiseLevel = "quiet" | "moderate" | "loud";

export type ReconcileConfig = {
  /** Empty this long after start (never checked in) → ghost. */
  ghostAfterMs: number;
  /** Empty this long after the holder checked in and left → ghost. */
  ghostAfterCheckedInMs: number;
  quietBelowDb: number;
  loudFromDb: number;
};

export type ReconcileBooking = {
  id: string;
  start: Date;
  end: Date;
  status: BookingStatusValue;
  checkedInAt: Date | null;
};

export type ReconcileSignal = {
  occupied: boolean;
  noiseDb?: number;
  emptySince?: Date;
};

export type PreviousState = { state: RoomState; since: Date };

export type ReconcileInput = {
  now: Date;
  booking?: ReconcileBooking;
  /** Fresh sensor signal; undefined = no (recent) data, so never flag a ghost. */
  signal?: ReconcileSignal;
  previous?: PreviousState;
  config: ReconcileConfig;
};

export type ReconcileResult = {
  state: RoomState;
  since: Date;
  booked: boolean;
  occupied: boolean;
  noiseLevel?: NoiseLevel;
  /** When the room will become (or became) a ghost booking if it stays empty. */
  ghostAt?: Date;
  /** Booking that should be auto checked-in (S1). */
  autoCheckInBookingId?: string;
};

export function noiseLevel(
  noiseDb: number | undefined,
  config: Pick<ReconcileConfig, "quietBelowDb" | "loudFromDb">,
): NoiseLevel | undefined {
  if (noiseDb === undefined || Number.isNaN(noiseDb)) return undefined;
  if (noiseDb < config.quietBelowDb) return "quiet";
  if (noiseDb < config.loudFromDb) return "moderate";
  return "loud";
}

function latest(...dates: Array<Date | null | undefined>): Date {
  const times = dates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return new Date(Math.max(...times));
}

/** Ghost deadline for a booked-but-empty room. */
export function ghostDeadline(
  booking: ReconcileBooking,
  signal: ReconcileSignal | undefined,
  config: ReconcileConfig,
): Date {
  // Empty since the latest of: booking start, last check-in, last time the room emptied.
  const emptyFrom = latest(booking.start, booking.checkedInAt, signal?.emptySince);
  const threshold = booking.checkedInAt ? config.ghostAfterCheckedInMs : config.ghostAfterMs;
  return new Date(emptyFrom.getTime() + threshold);
}

export function reconcileRoom(input: ReconcileInput): ReconcileResult {
  const { now, booking, signal, previous, config } = input;
  const occupied = signal?.occupied ?? false;
  const level = noiseLevel(signal?.noiseDb, config);

  let state: RoomState;
  let ghostAt: Date | undefined;
  let autoCheckInBookingId: string | undefined;

  if (!booking) {
    state = occupied ? "occupied" : "free";
  } else if (occupied) {
    state = "booked_in_use";
    if (booking.status === "RESERVED") autoCheckInBookingId = booking.id;
  } else if (!signal) {
    state = "booked";
  } else {
    ghostAt = ghostDeadline(booking, signal, config);
    state = now >= ghostAt ? "ghost_booking" : "booked";
  }

  let since: Date;
  if (previous && previous.state === state) {
    since = previous.since;
  } else if (state === "ghost_booking" && ghostAt) {
    since = ghostAt;
  } else {
    since = now;
  }

  return {
    state,
    since,
    booked: Boolean(booking),
    occupied,
    noiseLevel: level,
    ghostAt,
    autoCheckInBookingId,
  };
}

/** Rooms a member could take right now: genuinely free, or a ghost booking (with caveat). */
export function isGrabbable(state: RoomState): boolean {
  return state === "free" || state === "ghost_booking";
}
