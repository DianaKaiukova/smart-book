import type { RoomCategory } from "@/lib/auth/roles";

export type RoomView = {
  id: string;
  name: string;
  floor: string;
  capacity: number;
  amenities: string[];
  category: RoomCategory | null;
};
