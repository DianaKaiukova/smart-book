export const BOOKING_RULES = {
  defaultNowMinutes: 60,
  maxNowMinutes: 120,
  minMinutes: 15,
  maxSlotMinutes: 240,
  maxDaysAhead: 14,
  checkInEarlyMinutes: 15,
  checkInLateMinutes: 30,
  // Tolerates clock skew / form latency when a slot starts "now".
  pastStartGraceMinutes: 5,
} as const;

export const NOW_DURATION_OPTIONS = [30, 60, 90, 120] as const;
