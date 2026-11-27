"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Rooms" },
  { href: "/bookings", label: "My bookings" },
  { href: "/assistant", label: "Assistant" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/rooms") : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-(--segment-bg) text-(--text-primary)"
                : "text-(--text-secondary) hover:bg-(--surface-alt) hover:text-(--text-primary)",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
