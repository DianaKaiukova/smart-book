"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/lib/auth/session";
import {
  bookNow,
  bookSlot,
  cancelBooking,
  checkIn,
  type CreatedBooking,
} from "@/lib/booking/booking-service";
import { BOOKING_RULES } from "@/lib/booking/rules";

// Server Actions are public endpoints: authenticate + validate inside each one.

const roomIdSchema = z.string().min(1).max(32);
const bookingIdSchema = z.string().min(1).max(64);

const bookNowSchema = z.object({
  roomId: roomIdSchema,
  minutes: z.number().int().min(BOOKING_RULES.minMinutes).max(BOOKING_RULES.maxNowMinutes),
});

const bookSlotSchema = z.object({
  roomId: roomIdSchema,
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
});

const NOT_SIGNED_IN = "Please sign in again.";

export async function bookNowAction(input: unknown): Promise<ActionResult<CreatedBooking>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = bookNowSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid booking request.");
  const result = await bookNow(user, parsed.data.roomId, parsed.data.minutes);
  if (result.ok) refresh();
  return result;
}

export async function bookSlotAction(input: unknown): Promise<ActionResult<CreatedBooking>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = bookSlotSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid booking request.");
  const result = await bookSlot(user, parsed.data.roomId, {
    start: new Date(parsed.data.start),
    end: new Date(parsed.data.end),
  });
  if (result.ok) refresh();
  return result;
}

export async function cancelBookingAction(bookingId: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = bookingIdSchema.safeParse(bookingId);
  if (!parsed.success) return fail("Invalid booking.");
  const result = await cancelBooking(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function checkInAction(bookingId: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const parsed = bookingIdSchema.safeParse(bookingId);
  if (!parsed.success) return fail("Invalid booking.");
  const result = await checkIn(user, parsed.data);
  if (result.ok) refresh();
  return result;
}
