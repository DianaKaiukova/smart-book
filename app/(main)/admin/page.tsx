import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { LocalDayRange } from "@/components/bookings/local-time";
import { getAdminState } from "@/lib/admin/admin-state";
import { requireAdmin } from "@/lib/auth/session";
import { listAllBookings } from "@/lib/booking/booking-service";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Facilities dashboard</h1>
          <p className="text-sm text-ink-muted">Live occupancy vs bookings. Reclaim ghost bookings so rooms get used.</p>
        </div>
        <Link href="/admin/rooms" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">
          Manage rooms
        </Link>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-subtle" />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

async function AdminContent() {
  await requireAdmin();
  const [state, bookings] = await Promise.all([getAdminState(), listAllBookings()]);

  return (
    <>
      <AdminDashboard initial={state} pollIntervalMs={appConfig.pollIntervalMs} />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">All bookings (last 24h and upcoming)</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-canvas text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Holder</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono">{b.roomId}</td>
                  <td className="px-3 py-2">
                    <LocalDayRange start={b.start} end={b.end} />
                  </td>
                  <td className="px-3 py-2">
                    {b.holderName} <span className="text-xs text-ink-muted">{b.holderEmail}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{b.kind === "NOW" ? "Book now" : "Scheduled"}</td>
                  <td className="px-3 py-2 text-xs">{b.status.replace("_", " ").toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings.length === 0 ? <p className="p-6 text-center text-sm text-ink-muted">No bookings.</p> : null}
        </div>
      </section>
    </>
  );
}
