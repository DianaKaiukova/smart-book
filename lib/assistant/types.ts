import { z } from "zod";

// Client-safe assistant contracts.

export const pendingActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("book_room"),
    args: z.object({
      roomId: z.string().min(1).max(32),
      /** Omitted = book now. */
      start: z.iso.datetime({ offset: true }).optional(),
      durationMinutes: z.number().int().min(15).max(240),
    }),
    summary: z.string().max(300),
  }),
  z.object({
    type: z.literal("cancel_booking"),
    args: z.object({ bookingId: z.string().min(1).max(64) }),
    summary: z.string().max(300),
  }),
]);

export type PendingAction = z.infer<typeof pendingActionSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const assistantRequestSchema = z.object({
  messages: z.array(chatMessageSchema).max(40).default([]),
  timeZone: z.string().max(64).optional(),
  confirm: pendingActionSchema.optional(),
});

export type AssistantResponse =
  | { ok: true; reply: string; pendingAction?: PendingAction; changed?: boolean }
  | { ok: false; error: string };
