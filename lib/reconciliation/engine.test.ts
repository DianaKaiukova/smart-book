import { describe, expect, it } from "vitest";

import {
  noiseLevel,
  reconcileRoom,
  type ReconcileBooking,
  type ReconcileConfig,
} from "@/lib/reconciliation/engine";

const MIN = 60_000;
const config: ReconcileConfig = {
  ghostAfterMs: 3 * MIN,
  ghostAfterCheckedInMs: 6 * MIN,
  quietBelowDb: 45,
  loudFromDb: 65,
};

const t0 = new Date("2026-03-02T10:00:00.000Z");
const plus = (minutes: number) => new Date(t0.getTime() + minutes * MIN);

const reserved: ReconcileBooking = {
  id: "b1",
  start: t0,
  end: plus(60),
  status: "RESERVED",
  checkedInAt: null,
};

describe("reconcileRoom state rules", () => {
  it("no booking + empty → free", () => {
    const r = reconcileRoom({ now: plus(1), signal: { occupied: false }, config });
    expect(r.state).toBe("free");
    expect(r.booked).toBe(false);
  });

  it("no booking + occupied → occupied (squatter, S2)", () => {
    const r = reconcileRoom({ now: plus(1), signal: { occupied: true }, config });
    expect(r.state).toBe("occupied");
    expect(r.autoCheckInBookingId).toBeUndefined();
  });

  it("no signal: unbooked room is free, booked room is never flagged as ghost", () => {
    expect(reconcileRoom({ now: plus(1), config }).state).toBe("free");
    const r = reconcileRoom({ now: plus(30), booking: reserved, config });
    expect(r.state).toBe("booked");
    expect(r.ghostAt).toBeUndefined();
  });

  it("booked + occupied → booked_in_use and auto check-in (S1)", () => {
    const r = reconcileRoom({ now: plus(1), booking: reserved, signal: { occupied: true }, config });
    expect(r.state).toBe("booked_in_use");
    expect(r.autoCheckInBookingId).toBe("b1");
  });

  it("does not re-check-in an already checked-in booking", () => {
    const r = reconcileRoom({
      now: plus(1),
      booking: { ...reserved, status: "CHECKED_IN", checkedInAt: plus(0) },
      signal: { occupied: true },
      config,
    });
    expect(r.state).toBe("booked_in_use");
    expect(r.autoCheckInBookingId).toBeUndefined();
  });
});

describe("ghost hysteresis", () => {
  it("stays 'booked' while empty for less than N minutes", () => {
    const r = reconcileRoom({ now: plus(2), booking: reserved, signal: { occupied: false }, config });
    expect(r.state).toBe("booked");
    expect(r.ghostAt).toEqual(plus(3));
  });

  it("flips to ghost_booking once empty for N minutes after start", () => {
    const r = reconcileRoom({ now: plus(3), booking: reserved, signal: { occupied: false }, config });
    expect(r.state).toBe("ghost_booking");
    expect(r.since).toEqual(plus(3));
  });

  it("measures emptiness from when the room emptied, not just the booking start", () => {
    const signal = { occupied: false, emptySince: plus(10) };
    expect(reconcileRoom({ now: plus(12), booking: reserved, signal, config }).state).toBe("booked");
    expect(reconcileRoom({ now: plus(13), booking: reserved, signal, config }).state).toBe(
      "ghost_booking",
    );
  });

  it("gives a checked-in holder who stepped out a longer grace period", () => {
    const checkedIn = { ...reserved, status: "CHECKED_IN" as const, checkedInAt: plus(1) };
    const signal = { occupied: false, emptySince: plus(5) };
    expect(reconcileRoom({ now: plus(10), booking: checkedIn, signal, config }).state).toBe("booked");
    expect(reconcileRoom({ now: plus(11), booking: checkedIn, signal, config }).state).toBe(
      "ghost_booking",
    );
  });

  it("returns to booked_in_use when someone comes back", () => {
    const r = reconcileRoom({
      now: plus(20),
      booking: reserved,
      signal: { occupied: true },
      previous: { state: "ghost_booking", since: plus(3) },
      config,
    });
    expect(r.state).toBe("booked_in_use");
    expect(r.since).toEqual(plus(20));
  });
});

describe("since tracking", () => {
  it("keeps the previous 'since' while the state is unchanged", () => {
    const r = reconcileRoom({
      now: plus(5),
      signal: { occupied: false },
      previous: { state: "free", since: plus(-30) },
      config,
    });
    expect(r.since).toEqual(plus(-30));
  });
});

describe("noiseLevel", () => {
  it("maps dB to quiet / moderate / loud", () => {
    expect(noiseLevel(30, config)).toBe("quiet");
    expect(noiseLevel(45, config)).toBe("moderate");
    expect(noiseLevel(64.9, config)).toBe("moderate");
    expect(noiseLevel(65, config)).toBe("loud");
    expect(noiseLevel(undefined, config)).toBeUndefined();
  });
});
