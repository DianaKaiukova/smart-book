import { DoorOpen, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AssistantDock } from "@/components/assistant/assistant-dock";
import { LiveIndicator, LiveStatusProvider } from "@/components/layout/live-status";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { logoutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <LiveStatusProvider>
      <header className="sticky top-0 z-30 bg-accent text-white shadow-(--shadow-md)">
        {/* Mobile: menu button + logo | live + user (pages live in the sidebar). Desktop: logo | centred nav | live + user. */}
        <div className="flex h-14 w-full items-center gap-x-3 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-[-0.01em] md:justify-self-start">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-accent">
              <DoorOpen className="size-[18px]" aria-hidden />
            </span>
            SmartBook
          </Link>
          <Suspense fallback={null}>
            <SessionNav />
          </Suspense>
        </div>
      </header>
      <main className="w-full flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
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
      <div className="ml-auto md:col-start-3 md:justify-self-end">
        <Link href="/login" className="text-sm font-medium text-white">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <MobileNav isAdmin={user.role === "ADMIN"} userName={user.name} />
      <NavLinks isAdmin={user.role === "ADMIN"} />
      <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0 md:justify-self-end">
        <LiveIndicator />
        <span className="hidden text-sm text-white/85 lg:inline">
          {user.name}
          {user.role === "ADMIN" ? (
            <span className="ml-1.5 rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              admin
            </span>
          ) : null}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sign out"
            className="flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-[18px]" aria-hidden />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </>
  );
}