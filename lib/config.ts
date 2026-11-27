function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

const ghostAfterMinutes = readNumber(process.env.GHOST_AFTER_MINUTES, 2);

export const appConfig = {
  ghostAfterMinutes,
  ghostAfterCheckedInMinutes: readNumber(
    process.env.GHOST_AFTER_CHECKED_IN_MINUTES,
    ghostAfterMinutes * 2,
  ),
  quietBelowDb: readNumber(process.env.NOISE_QUIET_BELOW_DB, 45),
  loudFromDb: readNumber(process.env.NOISE_LOUD_FROM_DB, 65),
  /** A signal older than this counts as "no sensor data". */
  signalStaleAfterMs: readNumber(process.env.SIGNAL_STALE_AFTER_SECONDS, 60) * 1000,
  occupancySource: process.env.OCCUPANCY_SOURCE === "board" ? "board" : "sim",
  occupancyIngestKey: process.env.OCCUPANCY_INGEST_KEY || undefined,
  simTickMs: readNumber(process.env.SIM_TICK_SECONDS, 2.5) * 1000,
  openaiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
  pollIntervalMs: 2500,
} as const;
