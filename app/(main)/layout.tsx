import { DoorOpen, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AssistantDock } from "@/components/assistant/assistant-dock";
import { NavLinks } from "@/components/layout/nav-links";
import { logoutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-neutral-900">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <DoorOpen className="size-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">SmartBook</span>
          </Link>
          <Suspense fallback={<div className="flex-1" />}>
            <SessionNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <Suspense fallback={null}>
        <AssistantDock />
      </Suspense>
    </>
  );
}

async function SessionNav(): Promise<ReactNode> {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-1 justify-end">
        <Link href="/login" className="text-sm font-medium text-indigo-600">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <NavLinks isAdmin={user.role === "ADMIN"} />
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-sm text-neutral-600 md:inline">
          {user.name}
          {user.role === "ADMIN" ? (
            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
              admin
            </span>
          ) : null}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sign out"
            className="flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </>
  );
}
