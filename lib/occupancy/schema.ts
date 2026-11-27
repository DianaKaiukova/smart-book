import { z } from "zod";

export const occupancyEventSchema = z.object({
  roomId: z.string().min(1).max(32),
  occupied: z.boolean(),
  peopleCount: z.number().int().min(0).max(500).optional(),
  noiseDb: z.number().min(0).max(140).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["board", "sim"]),
  ts: z.iso.datetime({ offset: true }),
});

export const occupancyPayloadSchema = z.union([
  occupancyEventSchema,
  z.array(occupancyEventSchema).min(1).max(200),
]);

export const roomActionEventSchema = z.object({
  roomId: z.string().min(1).max(32),
  action: z.enum(["book_now", "extend", "checkin"]),
  via: z.enum(["voice", "gesture"]),
  ts: z.iso.datetime({ offset: true }),
});
