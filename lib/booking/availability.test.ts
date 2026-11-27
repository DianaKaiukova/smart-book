import { describe, expect, it } from "vitest";

import {
  bookNowRange,
  canCheckIn,
  findActiveBooking,
  findConflicts,
  isFree,
  isPastEnd,
  overlaps,
  validateBookNow,
  validateSlot,
  type BookingLike,
} from "@/lib/booking/availability";

const at = (hhmm: string, day = "2026-03-02") => new Date(`${day}T${hhmm}:00.000Z`);

function booking(overrides: Partial<BookingLike> & Pick<BookingLike, "start" | "end">): BookingLike {
  return { id: "b1", status: "RESERVED", ...overrides };
}

describe("overlaps", () => {
  it("treats ranges as half-open so back-to-back bookings do not overlap", () => {
    expect(
      overlaps({ start: at("10:00"), end: at("11:00") }, { start: at("11:00"), end: at("12:00") }),
    ).toBe(false);
  });

  it("detects partial and containing overlaps", () => {
    const base = { start: at("10:00"), end: at("12:00") };
    expect(overlaps(base, { start: at("11:30"), end: at("12:30") })).toBe(true);
    expect(overlaps(base, { start: at("10:30"), end: at("11:00") })).toBe(true);
    expect(overlaps({ start: at("09:00"), end: at("13:00") }, base)).toBe(true);
  });
});

describe("findConflicts / isFree", () => {
  const existing = [
    booking({ id: "a", start: at("10:00"), end: at("11:00") }),
    booking({ id: "b", start: at("13:00"), end: at("14:00"), status: "CANCELLED" }),
    booking({ id: "c", start: at("15:00"), end: at("16:00"), status: "GHOST_RELEASED" }),
    booking({ id: "d", start: at("17:00"), end: at("18:00"), status: "CHECKED_IN" }),
  ];

  it("reports overlapping active bookings", () => {
    expect(findConflicts(existing, { start: at("10:30"), end: at("11:30") }).map((b) => b.id)).toEqual([
      "a",
    ]);
    expect(isFree(existing, { start: at("17:30"), end: at("17:45") })).toBe(false);
  });

  it("ignores cancelled and ghost-released bookings", () => {
    expect(isFree(existing, { start: at("13:00"), end: at("14:00") })).toBe(true);
    expect(isFree(existing, { start: at("15:00"), end: at("16:00") })).toBe(true);
  });
});

describe("findActiveBooking", () => {
  it("returns the reserved/checked-in booking covering now", () => {
    const list = [
      booking({ id: "past", start: at("08:00"), end: at("09:00") }),
      booking({ id: "now", start: at("10:00"), end: at("11:00"), status: "CHECKED_IN" }),
    ];
    expect(findActiveBooking(list, at("10:30"))?.id).toBe("now");
    expect(findActiveBooking(list, at("11:00"))).toBeUndefined();
  });

  it("skips cancelled bookings", () => {
    const list = [booking({ start: at("10:00"), end: at("11:00"), status: "CANCELLED" })];
    expect(findActiveBooking(list, at("10:30"))).toBeUndefined();
  });
});

describe("validateBookNow", () => {
  it("accepts durations within the book-now limit", () => {
    expect(validateBookNow(60)).toEqual({ ok: true });
    expect(validateBookNow(120)).toEqual({ ok: true });
  });

  it("rejects too short or over the 2h max", () => {
    expect(validateBookNow(5).ok).toBe(false);
    expect(validateBookNow(121).ok).toBe(false);
  });

  it("builds a range starting now", () => {
    const range = bookNowRange(at("10:00"), 90);
    expect(range.end).toEqual(at("11:30"));
  });
});

describe("validateSlot", () => {
  const now = at("09:00");

  it("accepts a future slot", () => {
    expect(validateSlot({ start: at("10:00"), end: at("11:00") }, now)).toEqual({ ok: true });
  });

  it("rejects end before start, past starts and too-long slots", () => {
    expect(validateSlot({ start: at("11:00"), end: at("10:00") }, now).ok).toBe(false);
    expect(validateSlot({ start: at("08:00"), end: at("08:30") }, now).ok).toBe(false);
    expect(validateSlot({ start: at("10:00"), end: at("15:00") }, now).ok).toBe(false);
  });

  it("rejects slots beyond 14 days ahead", () => {
    const far = { start: new Date("2026-03-20T10:00:00Z"), end: new Date("2026-03-20T11:00:00Z") };
    expect(validateSlot(far, now).ok).toBe(false);
  });
});

describe("canCheckIn", () => {
  const b = booking({ start: at("10:00"), end: at("11:00") });

  it("opens 15 minutes before start and closes 30 minutes after", () => {
    expect(canCheckIn(b, at("09:40")).ok).toBe(false);
    expect(canCheckIn(b, at("09:50")).ok).toBe(true);
    expect(canCheckIn(b, at("10:30")).ok).toBe(true);
    expect(canCheckIn(b, at("10:31")).ok).toBe(false);
  });

  it("only allows reserved bookings", () => {
    expect(canCheckIn({ ...b, status: "CHECKED_IN" }, at("10:00")).ok).toBe(false);
  });
});

describe("isPastEnd", () => {
  it("flags active bookings whose end has passed", () => {
    const b = booking({ start: at("10:00"), end: at("11:00") });
    expect(isPastEnd(b, at("11:00"))).toBe(true);
    expect(isPastEnd(b, at("10:59"))).toBe(false);
    expect(isPastEnd({ ...b, status: "CANCELLED" }, at("12:00"))).toBe(false);
  });
});
