import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export const proxy = NextAuth(authConfig).auth;

export const config = {
  // API routes authenticate themselves (kiosk, sensor ingest and assistant have different rules).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
