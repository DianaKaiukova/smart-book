import "server-only";

import { cache } from "react";
import { z } from "zod";

import { db } from "@/lib/db";
import type { RoomView } from "@/lib/rooms/rooms-types";

export type { RoomView };

const amenitiesSchema = z.array(z.string());

export function parseAmenities(raw: string): string[] {
  try {
    const parsed = amenitiesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

type RoomRow = { id: string; name: string; floor: string; capacity: number; amenities: string };

function toRoomView(row: RoomRow): RoomView {
  return { ...row, amenities: parseAmenities(row.amenities) };
}

export const listRooms = cache(async (): Promise<RoomView[]> => {
  const rows = await db.room.findMany({ orderBy: [{ floor: "asc" }, { id: "asc" }] });
  return rows.map(toRoomView);
});

export const getRoom = cache(async (roomId: string): Promise<RoomView | null> => {
  const row = await db.room.findUnique({ where: { id: roomId } });
  return row ? toRoomView(row) : null;
});

/** "N.1.42" (or "N.0.14a") → { floor: 1, number: 42 } for proximity ranking. */
export function roomPosition(roomId: string): { building: string; floor: number; number: number } | null {
  const match = /^([A-Za-z]+)\.(\d+)\.(\d+)[a-z]?$/.exec(roomId);
  if (!match) return null;
  return { building: match[1], floor: Number(match[2]), number: Number(match[3]) };
}

/** Rough walking distance between two rooms (same floor ≪ other floor). */
export function roomDistance(a: string, b: string): number {
  const pa = roomPosition(a);
  const pb = roomPosition(b);
  if (!pa || !pb) return 1000;
  if (pa.building !== pb.building) return 500;
  return Math.abs(pa.floor - pb.floor) * 20 + Math.abs(pa.number - pb.number);
}
