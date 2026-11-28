import type { NextAuthConfig } from "next-auth";

import { isAppRole } from "@/lib/auth/roles";

// Edge-safe config shared by proxy.ts and auth.ts (no DB / bcrypt imports here).

const PUBLIC_PATHS = ["/login", "/signup", "/door"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const authConfig = {
  // Dev-only fallback so the app boots without AUTH_SECRET; production must set it.
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "smartbook-dev-only-insecure-secret"),
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "MEMBER";
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      session.user.role = isAppRole(token.role) ? token.role : "STUDENT";
      return session;
    },
    // Route guards (coarse). Pages, actions and API routes re-check on the server.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (isPublicPath(pathname)) return true;
      const user = auth?.user;
      if (!user) return false;
      if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      // Teacher area: teachers and admins only.
      if (pathname.startsWith("/teach") && user.role !== "TEACHER" && user.role !== "ADMIN") {
        return Response.redirect(new URL("/", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
