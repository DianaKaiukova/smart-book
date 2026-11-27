import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { DoorKiosk } from "@/components/door/door-kiosk";
import { appConfig } from "@/lib/config";
import { getDoorState } from "@/lib/rooms/door-state";

export const metadata: Metadata = { title: "Door display" };

/** Public kiosk shown on the tablet/board next to the room door. */
export default function DoorPage({ params }: PageProps<"/door/[id]">) {
  return (
    <main className="flex min-h-dvh flex-1 bg-ink text-white">
      <Suspense fallback={<div className="flex-1" />}>
        <DoorContent params={params} />
      </Suspense>
    </main>
  );
}

async function DoorContent({ params }: { params: Promise<{ id: string }> }) {
  // Live state depends on the current time; render per request.
  await connection();
  const roomId = decodeURIComponent((await params).id);
  const state = await getDoorState(roomId);
  if (!state) notFound();
  return <DoorKiosk initial={state} pollIntervalMs={appConfig.pollIntervalMs} />;
}
