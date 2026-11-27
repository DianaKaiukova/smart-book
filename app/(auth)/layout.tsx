import { DoorOpen } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <DoorOpen className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">SmartBook</h1>
          <p className="text-sm text-neutral-500">Study rooms in Building Z — booked rooms that sit empty get freed up.</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
