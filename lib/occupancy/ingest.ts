import "server-only";

import { recordOccupancy } from "@/lib/occupancy/store";
import type { OccupancyEvent, RoomSignal } from "@/lib/occupancy/types";
import { computeRoomStatuses } from "@/lib/reconciliation/room-status";

/**
 * Single entry point for every OccupancyEvent (sim now, board later).
 * Recomputes the room's status when presence flips so auto check-in happens immediately.
 */
export async function ingestOccupancyEvent(event: OccupancyEvent): Promise<RoomSignal> {
  const { signal, occupancyChanged } = recordOccupancy(event);
  if (occupancyChanged) {
    await computeRoomStatuses({ roomIds: [event.roomId] });
  }
  return signal;
}
