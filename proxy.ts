import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

export const proxy = NextAuth(authConfig).auth;

export const config = {
  // API routes authenticate themselves (kiosk, sensor ingest and assistant have different rules).
  // All of /_next is excluded, including the dev HMR websocket, which would otherwise be redirected to /login.
  matcher: ["/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
