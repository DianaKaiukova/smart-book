"use client";

import {
  Bot,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { AppRole } from "@/lib/auth/roles";
import { isAdmin, isTeacher } from "@/lib/auth/roles";

type NavLink = { href: string; label: string; icon: LucideIcon };

const BASE: NavLink[] = [
  { href: "/", label: "Rooms", icon: LayoutGrid },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/planner", label: "Planner", icon: Sparkles },
  { href: "/bookings", label: "My bookings", icon: CalendarCheck },
  { href: "/assistant", label: "SmartBookBot", icon: Bot },
];

export function navLinksFor(role: AppRole): NavLink[] {
  const links = [...BASE];
  if (isTeacher(role) || isAdmin(role)) links.push({ href: "/teach", label: "Teach", icon: GraduationCap });
  if (isAdmin(role)) links.push({ href: "/admin", label: "Admin", icon: Shield });
  return links;
}

export function isActiveLink(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" || pathname.startsWith("/rooms") : pathname.startsWith(href);
}

/** Desktop top-bar navigation; mobile uses the sidebar in MobileNav. */
export function NavLinks({ role }: { role: AppRole }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center justify-center gap-1 md:flex">
      {navLinksFor(role).map((link) => {
        const active = isActiveLink(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
