import "server-only";

import { appConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { globalSingleton } from "@/lib/global-singleton";
import { ensureDemoBookings } from "@/lib/occupancy/sim-scenario";
import { SimOccupancySource } from "@/lib/occupancy/sim-source";

// The ONE seam for occupancy. OCCUPANCY_SOURCE=sim (default) runs the in-process
// simulator; OCCUPANCY_SOURCE=board starts nothing here — the board bridge POSTs
// OccupancyEvents to /api/occupancy, which feeds the same ingest.

type SourceState = { started: boolean; sim?: SimOccupancySource };

const state = globalSingleton<SourceState>("__smartbook_occupancy_source", () => ({
  started: false,
}));

export function ensureOccupancySource(): void {
  if (state.started) return;
  state.started = true;
  if (appConfig.occupancySource !== "sim") return;

  const sim = new SimOccupancySource(
    async () => (await db.room.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map((r) => r.id),
    appConfig.simTickMs,
  );
  state.sim = sim;

  void ensureDemoBookings().catch((error) => console.error("[sim] demo bookings failed", error));

  // Dynamic import keeps ingest → room-status → source free of a static cycle.
  sim.subscribe((event) => {
    void import("@/lib/occupancy/ingest")
      .then(({ ingestOccupancyEvent }) => ingestOccupancyEvent(event))
      .catch((error) => console.error("[sim] ingest failed", error));
  });
}

/** Simulator handle for the admin control panel; undefined when running on the board. */
export function getSimulator(): SimOccupancySource | undefined {
  ensureOccupancySource();
  return state.sim;
}
