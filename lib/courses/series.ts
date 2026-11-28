import { addDays, compareYmd, localYmd, wallToUtc, ymdWeekday, type Ymd } from "@/lib/time/zoned";

// Pure expansion of a recurring rule into concrete session windows. No DB, no clock.

export type SeriesRule = {
  weekday: number; // 0 = Sun .. 6 = Sat
  startMin: number; // minutes from local midnight
  endMin: number;
  frequency: "WEEKLY" | "BIWEEKLY";
  startDate: Date; // first eligible date
  endDate: Date; // last eligible date (inclusive)
};

export type Occurrence = { start: Date; end: Date };

const MAX_OCCURRENCES = 60;

/** Every session of the rule, as absolute UTC windows, in chronological order. */
export function seriesOccurrences(rule: SeriesRule): Occurrence[] {
  if (rule.endMin <= rule.startMin) return [];
  const step = rule.frequency === "BIWEEKLY" ? 14 : 7;
  const endYmd = localYmd(rule.endDate);

  // Advance to the first date on/after startDate that matches the weekday.
  let cur: Ymd = localYmd(rule.startDate);
  for (let i = 0; i < 7 && ymdWeekday(cur) !== rule.weekday; i++) {
    cur = addDays(cur, 1);
  }

  const out: Occurrence[] = [];
  while (compareYmd(cur, endYmd) <= 0 && out.length < MAX_OCCURRENCES) {
    out.push({
      start: wallToUtc(cur, rule.startMin),
      end: wallToUtc(cur, rule.endMin),
    });
    cur = addDays(cur, step);
  }
  return out;
}
