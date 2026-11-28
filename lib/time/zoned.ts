// Campus-local time helpers for recurring schedules. Class/meeting series store a
// wall-clock weekday + minutes-from-midnight; these turn that into absolute UTC
// instants in the campus timezone, correctly across DST (no external deps).

export const CAMPUS_TZ = process.env.CAMPUS_TZ || "Europe/Vienna";

export type Ymd = { y: number; m: number; d: number };

/** Offset (local - UTC) in ms for a given instant in `tz`. */
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asIfUtc - instant.getTime();
}

/** Campus-local wall-clock (date + minutes from midnight) → UTC instant. */
export function wallToUtc(ymd: Ymd, minutes: number, tz = CAMPUS_TZ): Date {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const guess = Date.UTC(ymd.y, ymd.m - 1, ymd.d, hh, mm, 0);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let result = guess - off1;
  const off2 = tzOffsetMs(new Date(result), tz);
  if (off2 !== off1) result = guess - off2; // re-correct across a DST boundary
  return new Date(result);
}

/** Campus-local calendar date of an instant. */
export function localYmd(instant: Date, tz = CAMPUS_TZ): Ymd {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = dtf.format(instant).split("-").map(Number);
  return { y, m, d };
}

/** 0 = Sunday .. 6 = Saturday for a calendar date. */
export function ymdWeekday(ymd: Ymd): number {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

/** Add calendar days to a Y/M/D (anchored at noon to dodge DST edges). */
export function addDays(ymd: Ymd, days: number): Ymd {
  const anchor = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return { y: anchor.getUTCFullYear(), m: anchor.getUTCMonth() + 1, d: anchor.getUTCDate() };
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

/** Parse "HH:MM" → minutes from midnight, or null. */
export function parseTimeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Minutes from midnight → "HH:MM". */
export function minutesToLabel(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
