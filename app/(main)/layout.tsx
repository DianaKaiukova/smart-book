import { DoorOpen, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AssistantDock } from "@/components/assistant/assistant-dock";
import { LiveIndicator, LiveStatusProvider } from "@/components/layout/live-status";
import { NavLinks } from "@/components/layout/nav-links";
import { logoutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <LiveStatusProvider>
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-white">
              <DoorOpen className="size-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">SmartBook</span>
          </Link>
          <Suspense fallback={<div className="flex-1" />}>
            <SessionNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Suspense fallback={null}>
        <AssistantDock />
      </Suspense>
    </LiveStatusProvider>
  );
}

async function SessionNav(): Promise<ReactNode> {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-1 justify-end">
        <Link href="/login" className="text-sm font-medium text-accent">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <NavLinks isAdmin={user.role === "ADMIN"} />
      <LiveIndicator />
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-[13px] text-ink-secondary md:inline">
          {user.name}
          {user.role === "ADMIN" ? (
            <span className="ml-1.5 rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary uppercase">
              admin
            </span>
          ) : null}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sign out"
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </>
  );
}
