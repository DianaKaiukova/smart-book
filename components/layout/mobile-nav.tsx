"use client";

import { DoorOpen, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { isActiveLink, navLinksFor } from "@/components/layout/nav-links";
import type { AppRole } from "@/lib/auth/roles";
import { cn } from "@/lib/cn";

export function MobileNav({ role, userName }: { role: AppRole; userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Portalled to <body>: the sticky header's stacking context would otherwise keep the drawer under the assistant dock.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  const drawer = (
    <div className="md:hidden">
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-0 z-[60] bg-ink/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        id="mobile-sidebar"
        aria-label="Pages"
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-[70] flex w-72 max-w-[85vw] flex-col bg-accent text-white shadow-(--shadow-md) transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" onClick={close} className="flex items-center gap-2 text-base font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-accent">
              <DoorOpen className="size-[18px]" aria-hidden />
            </span>
            SmartBook
          </Link>
          <button
            type="button"
            onClick={close}
            className="flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" aria-hidden />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-2">
          {navLinksFor(role).map(({ href, label, icon: Icon }) => {
            const active = isActiveLink(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                  active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto border-t border-white/15 px-5 py-4 text-sm text-white/70">Signed in as {userName}</p>
      </aside>
    </div>
  );

  return (
    <div className="order-first md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-sidebar"
        className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-white hover:bg-white/10"
      >
        <Menu className="size-5" aria-hidden />
        <span className="sr-only">Open menu</span>
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </div>
  );
}

function noopSubscribe(): () => void {
  return () => {};
}
