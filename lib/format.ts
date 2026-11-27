// Client-safe date helpers. Dates travel as ISO strings and render in the browser's timezone.

// Pin the locale so the server (Node) and the browser format identically —
// `undefined` resolves to 24h on the server but 12h (AM/PM) in the browser,
// which causes a hydration mismatch. "en-GB" (24h) matches the rest of the app.
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function formatTime(iso: string | Date): string {
  return timeFmt.format(new Date(iso));
}

export function formatDay(iso: string | Date): string {
  return dayFmt.format(new Date(iso));
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function formatDayRange(start: string, end: string): string {
  return `${formatDay(start)}, ${formatRange(start, end)}`;
}

/** "in 5 min", "3 min ago", "now" */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffMin = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (diffMin === 0) return "now";
  if (diffMin > 0) return diffMin >= 60 ? `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `in ${diffMin} min`;
  const ago = -diffMin;
  return ago >= 60 ? `${Math.floor(ago / 60)}h ${ago % 60}m ago` : `${ago} min ago`;
}

/** yyyy-mm-dd in local time (for <input type="date">). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local "yyyy-mm-dd" + "hh:mm" → Date. */
export function fromLocalInputs(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
