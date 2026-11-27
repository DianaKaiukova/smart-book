import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/layout/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

async function LoginFormWithRedirect({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === "string" ? toRelative(callbackUrl) : "/";
  return <LoginForm redirectTo={target} />;
}

/** Auth.js passes an absolute callbackUrl; keep only the same-origin path. */
function toRelative(url: string): string {
  try {
    const parsed = new URL(url, "http://local");
    const path = `${parsed.pathname}${parsed.search}`;
    return path.startsWith("/") && !path.startsWith("//") ? path : "/";
  } catch {
    return "/";
  }
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginForm redirectTo="/" />}>
      <LoginFormWithRedirect searchParams={searchParams} />
    </Suspense>
  );
}
