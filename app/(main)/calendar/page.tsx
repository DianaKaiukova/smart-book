import type { Metadata } from "next";
import { Suspense } from "react";

import { CalendarView } from "@/components/calendar/calendar-view";
import { NewMeetingForm } from "@/components/calendar/new-meeting-form";
import { requireUser } from "@/lib/auth/session";
import { listCalendarEvents } from "@/lib/courses/courses-service";
import { listRooms } from "@/lib/rooms/rooms";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My calendar</h1>
        <p className="text-sm text-ink-muted">Your classes, meetings and bookings — rooms are held for each session.</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-subtle" />}>
        <CalendarContent />
      </Suspense>
    </div>
  );
}

async function CalendarContent() {
  const user = await requireUser();
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 86400000);
  const to = new Date(now.getTime() + 70 * 86400000);
  const [events, rooms] = await Promise.all([listCalendarEvents(user, from, to), listRooms()]);
  const meetingRooms = rooms
    .filter((r) => r.category === "STUDY" || r.category === "MEETING")
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="flex flex-col gap-5">
      <NewMeetingForm rooms={meetingRooms} />
      <CalendarView events={events} />
    </div>
  );
}
