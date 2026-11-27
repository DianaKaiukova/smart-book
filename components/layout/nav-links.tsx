"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Rooms" },
  { href: "/bookings", label: "My bookings" },
  { href: "/assistant", label: "SmartBookBot" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <nav className="order-last -mx-1 flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-none md:w-auto md:justify-center">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/rooms") : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/15 text-white"
                : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
