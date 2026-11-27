import { globalSingleton } from "@/lib/global-singleton";
import type { OccupancyEvent, RoomSignal } from "@/lib/occupancy/types";

// Latest occupancy per room. Deliberately in memory only (not persisted).
const signals = globalSingleton("__smartbook_signals", () => new Map<string, RoomSignal>());

export type RecordResult = { signal: RoomSignal; occupancyChanged: boolean };

export function recordOccupancy(event: OccupancyEvent): RecordResult {
  const ts = new Date(event.ts);
  const previous = signals.get(event.roomId);

  // Ignore out-of-order events.
  if (previous && ts < previous.ts) {
    return { signal: previous, occupancyChanged: false };
  }

  const occupancyChanged = !previous || previous.occupied !== event.occupied;

  const signal: RoomSignal = {
    roomId: event.roomId,
    occupied: event.occupied,
    peopleCount: event.peopleCount,
    noiseDb: event.noiseDb,
    confidence: event.confidence,
    source: event.source,
    ts,
    emptySince: event.occupied ? undefined : occupancyChanged ? ts : previous?.emptySince,
    occupiedSince: event.occupied ? (occupancyChanged ? ts : previous?.occupiedSince) : undefined,
  };

  signals.set(event.roomId, signal);
  return { signal, occupancyChanged };
}

export function getSignal(roomId: string): RoomSignal | undefined {
  return signals.get(roomId);
}

export function clearSignals(): void {
  signals.clear();
}
