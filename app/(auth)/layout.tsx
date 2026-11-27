import { DoorOpen } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-accent-soft via-white to-accent-soft px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent-soft">
            <DoorOpen className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">SmartBook</h1>
          <p className="text-sm text-ink-muted">Study rooms in Building Z — booked rooms that sit empty get freed up.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
