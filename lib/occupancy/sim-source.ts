import type { OccupancyEvent, OccupancySource } from "@/lib/occupancy/types";

// Demo/dev occupancy driver. Emits OccupancyEvents exactly like the board will.
// Nothing outside lib/occupancy knows these events are simulated.

type ScriptedPresence = (secondsSinceStart: number) => boolean;

/** The scripted demo scenario (§10). Rooms not listed stay empty unless toggled. */
export const DEMO_SCRIPT: Record<string, { presence: ScriptedPresence; note: string }> = {
  "N.0.27": { presence: () => true, note: "Booked and in use" },
  "N.0.15": { presence: () => false, note: "Booked, holder never shows → ghost booking" },
  "N.0.18": { presence: (t) => t >= 25, note: "Booked, holder walks in at +25s → auto check-in" },
  "N.0.44": { presence: (t) => t >= 10, note: "Unbooked, someone walks in at +10s → squatter" },
};

const NOISE_BASELINE_DB: Record<string, number> = {
  "N.0.07": 48,
  "N.0.14a": 38,
  "N.0.42": 55,
  "N.0.43": 66,
  "N.0.45": 58,
  "N.0.54": 33,
  "N.0.56": 40,
  "N.1.04": 52,
  "N.1.12": 45,
  "N.1.43": 62,
  "N.1.45": 31,
  "N.1.71": 47,
  "N.2.08": 36,
  "N.2.35": 60,
  "N.2.38": 39,
};
const DEFAULT_BASELINE_DB = 42;
const OCCUPIED_NOISE_BOOST_DB = 9;

export type ManualOverride = { occupied: boolean; noiseDb?: number };

export type SimRoomSnapshot = {
  roomId: string;
  occupied: boolean;
  noiseDb: number;
  peopleCount: number;
  mode: "script" | "manual" | "idle";
  note?: string;
};

export type SimSnapshot = {
  running: boolean;
  scenarioStartedAt: string;
  secondsSinceStart: number;
  rooms: SimRoomSnapshot[];
};

type RoomIdLoader = () => Promise<string[]>;

export class SimOccupancySource implements OccupancySource {
  private listeners = new Set<(event: OccupancyEvent) => void>();
  private manual = new Map<string, ManualOverride>();
  private noise = new Map<string, number>();
  private lastSnapshot = new Map<string, SimRoomSnapshot>();
  private roomIds: string[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private tickCount = 0;
  private scenarioStartedAt = Date.now();

  constructor(
    private readonly loadRoomIds: RoomIdLoader,
    private readonly tickMs: number,
  ) {}

  subscribe(onEvent: (event: OccupancyEvent) => void): void {
    this.listeners.add(onEvent);
    this.start();
  }

  start(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  get running(): boolean {
    return Boolean(this.timer);
  }

  restartScenario(): void {
    this.scenarioStartedAt = Date.now();
    this.manual.clear();
    void this.tick();
  }

  setManual(roomId: string, override: ManualOverride): void {
    this.manual.set(roomId, override);
    void this.tick();
  }

  clearManual(roomId: string): void {
    this.manual.delete(roomId);
    void this.tick();
  }

  snapshot(): SimSnapshot {
    return {
      running: this.running,
      scenarioStartedAt: new Date(this.scenarioStartedAt).toISOString(),
      secondsSinceStart: Math.floor((Date.now() - this.scenarioStartedAt) / 1000),
      rooms: this.roomIds.map(
        (roomId) =>
          this.lastSnapshot.get(roomId) ?? {
            roomId,
            occupied: false,
            noiseDb: DEFAULT_BASELINE_DB,
            peopleCount: 0,
            mode: "idle",
          },
      ),
    };
  }

  private async refreshRooms(): Promise<void> {
    if (this.roomIds.length === 0 || this.tickCount % 20 === 0) {
      this.roomIds = await this.loadRoomIds();
    }
  }

  private nextNoise(roomId: string, occupied: boolean): number {
    const baseline = (NOISE_BASELINE_DB[roomId] ?? DEFAULT_BASELINE_DB) + (occupied ? OCCUPIED_NOISE_BOOST_DB : 0);
    const current = this.noise.get(roomId) ?? baseline;
    // Random walk pulled back toward the baseline.
    const next = current + (baseline - current) * 0.3 + (Math.random() - 0.5) * 4;
    const rounded = Math.round(Math.min(Math.max(next, 25), 95) * 10) / 10;
    this.noise.set(roomId, rounded);
    return rounded;
  }

  private async tick(): Promise<void> {
    try {
      await this.refreshRooms();
    } catch (error) {
      console.error("[sim] failed to load rooms", error);
      return;
    }
    this.tickCount += 1;
    const t = (Date.now() - this.scenarioStartedAt) / 1000;
    const ts = new Date().toISOString();

    for (const roomId of this.roomIds) {
      const override = this.manual.get(roomId);
      const scripted = DEMO_SCRIPT[roomId];
      const occupied = override ? override.occupied : scripted ? scripted.presence(t) : false;
      const noiseDb = override?.noiseDb ?? this.nextNoise(roomId, occupied);
      if (override?.noiseDb !== undefined) this.noise.set(roomId, override.noiseDb);
      const peopleCount = occupied ? 1 + (roomId.charCodeAt(roomId.length - 1) % 3) : 0;

      this.lastSnapshot.set(roomId, {
        roomId,
        occupied,
        noiseDb,
        peopleCount,
        mode: override ? "manual" : scripted ? "script" : "idle",
        note: scripted?.note,
      });

      const event: OccupancyEvent = {
        roomId,
        occupied,
        peopleCount,
        noiseDb,
        confidence: 0.95,
        source: "sim",
        ts,
      };
      for (const listener of this.listeners) listener(event);
    }
  }
}
