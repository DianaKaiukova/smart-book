"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PasswordFieldInput } from "@/components/ui/password-field-input";
import { SpinLoader } from "@/components/ui/spin-loader";
import { TextFieldInput } from "@/components/ui/text-field-input";
import { loginAction, signupAction, type AuthFormState } from "@/lib/auth/actions";

const DEMO_ACCOUNTS = [
  { label: "Member", email: "member@smartbook.dev", password: "member1234" },
  { label: "Admin", email: "admin@smartbook.dev", password: "admin1234" },
];

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <TextFieldInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        containerClassName="max-w-none"
      />
      <PasswordFieldInput
        label="Password"
        name="password"
        hint=""
        required
        containerClassName="max-w-none"
      />
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton pending={pending} label="Sign in" />
      <p className="text-center text-sm text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
      <div className="rounded-lg bg-canvas p-3 text-xs text-ink-muted">
        <p className="mb-1 font-medium text-ink-secondary">Demo accounts</p>
        {DEMO_ACCOUNTS.map((a) => (
          <p key={a.email} className="font-mono">
            {a.label}: {a.email} / {a.password}
          </p>
        ))}
      </div>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signupAction, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextFieldInput
        label="Name"
        name="name"
        autoComplete="name"
        required
        error={Boolean(errors.name)}
        errorMessage={errors.name}
        containerClassName="max-w-none"
      />
      <TextFieldInput
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={Boolean(errors.email)}
        errorMessage={errors.email}
        containerClassName="max-w-none"
      />
      <PasswordFieldInput
        label="Password"
        name="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        error={Boolean(errors.password)}
        errorMessage={errors.password}
        containerClassName="max-w-none"
      />
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton pending={pending} label="Create account" />
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? <SpinLoader size="sm" iconClassName="text-white" label="" /> : null}
      {label}
    </button>
  );
}
