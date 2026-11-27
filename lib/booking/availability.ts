import { BOOKING_RULES } from "@/lib/booking/rules";

// Pure availability logic — no DB, no clock. Callers pass `now` explicitly.

export type BookingStatusValue =
  | "RESERVED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "GHOST_RELEASED";

export type TimeRange = { start: Date; end: Date };

export type BookingLike = TimeRange & {
  id: string;
  status: BookingStatusValue;
};

export type RuleResult = { ok: true } | { ok: false; error: string };

const MINUTE_MS = 60_000;

const NON_BLOCKING_STATUSES: ReadonlySet<BookingStatusValue> = new Set([
  "CANCELLED",
  "GHOST_RELEASED",
]);

const ACTIVE_STATUSES: ReadonlySet<BookingStatusValue> = new Set([
  "RESERVED",
  "CHECKED_IN",
]);

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function blocksAvailability(status: BookingStatusValue): boolean {
  return !NON_BLOCKING_STATUSES.has(status);
}

export function findConflicts<T extends BookingLike>(
  bookings: readonly T[],
  range: TimeRange,
): T[] {
  return bookings.filter(
    (booking) => blocksAvailability(booking.status) && overlaps(booking, range),
  );
}

export function isFree(bookings: readonly BookingLike[], range: TimeRange): boolean {
  return findConflicts(bookings, range).length === 0;
}

/** The RESERVED/CHECKED_IN booking whose window contains `now`, if any. */
export function findActiveBooking<T extends BookingLike>(
  bookings: readonly T[],
  now: Date,
): T | undefined {
  return bookings.find(
    (booking) =>
      ACTIVE_STATUSES.has(booking.status) && booking.start <= now && now < booking.end,
  );
}

export function durationMinutes(range: TimeRange): number {
  return (range.end.getTime() - range.start.getTime()) / MINUTE_MS;
}

export function bookNowRange(now: Date, minutes: number): TimeRange {
  return { start: now, end: new Date(now.getTime() + minutes * MINUTE_MS) };
}

export function validateBookNow(minutes: number): RuleResult {
  if (!Number.isFinite(minutes) || minutes < BOOKING_RULES.minMinutes) {
    return { ok: false, error: `Bookings must be at least ${BOOKING_RULES.minMinutes} minutes.` };
  }
  if (minutes > BOOKING_RULES.maxNowMinutes) {
    return {
      ok: false,
      error: `"Book now" is limited to ${BOOKING_RULES.maxNowMinutes / 60} hours.`,
    };
  }
  return { ok: true };
}

export function validateSlot(range: TimeRange, now: Date): RuleResult {
  if (Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime())) {
    return { ok: false, error: "Invalid start or end time." };
  }
  if (range.end <= range.start) {
    return { ok: false, error: "End time must be after start time." };
  }
  const minutes = durationMinutes(range);
  if (minutes < BOOKING_RULES.minMinutes) {
    return { ok: false, error: `Bookings must be at least ${BOOKING_RULES.minMinutes} minutes.` };
  }
  if (minutes > BOOKING_RULES.maxSlotMinutes) {
    return {
      ok: false,
      error: `Bookings can be at most ${BOOKING_RULES.maxSlotMinutes / 60} hours.`,
    };
  }
  const earliest = now.getTime() - BOOKING_RULES.pastStartGraceMinutes * MINUTE_MS;
  if (range.start.getTime() < earliest) {
    return { ok: false, error: "That time is in the past." };
  }
  return { ok: true };
}

export function canCheckIn(
  booking: Pick<BookingLike, "start" | "end" | "status">,
  now: Date,
): RuleResult {
  if (booking.status !== "RESERVED") {
    return { ok: false, error: "Only reserved bookings can be checked in." };
  }
  const opensAt = booking.start.getTime() - BOOKING_RULES.checkInEarlyMinutes * MINUTE_MS;
  const closesAt = Math.min(
    booking.start.getTime() + BOOKING_RULES.checkInLateMinutes * MINUTE_MS,
    booking.end.getTime(),
  );
  if (now.getTime() < opensAt) {
    return {
      ok: false,
      error: `Check-in opens ${BOOKING_RULES.checkInEarlyMinutes} minutes before the start.`,
    };
  }
  if (now.getTime() > closesAt) {
    return { ok: false, error: "The check-in window has closed." };
  }
  return { ok: true };
}

export function isPastEnd(booking: Pick<BookingLike, "end" | "status">, now: Date): boolean {
  return ACTIVE_STATUSES.has(booking.status) && booking.end <= now;
}
