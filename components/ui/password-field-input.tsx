"use client";

// Source: opensourceui (MIT) https://github.com/bidyut10/opensourceui/blob/main/components/inputs/password-field-input.tsx

import {
  forwardRef,
  useCallback,
  useId,
  useState,
  type ComponentPropsWithoutRef,
} from "react";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/cn";

export type PasswordFieldInputProps = Readonly<
  {
    label?: string;
    hint?: string;
    error?: boolean;
    errorMessage?: string;
    showLabel?: string;
    hideLabel?: string;
    containerClassName?: string;
  } & Omit<ComponentPropsWithoutRef<"input">, "size" | "type">
>;

export const PasswordFieldInput = forwardRef<
  HTMLInputElement,
  PasswordFieldInputProps
>(function PasswordFieldInput(
  {
    className,
    containerClassName,
    id,
    label = "Password",
    hint = "Use at least 8 characters with a number and symbol.",
    error = false,
    errorMessage = "Password does not meet requirements.",
    showLabel = "Show password",
    hideLabel = "Hide password",
    disabled,
    required,
    autoComplete = "current-password",
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    setVisible((prev) => !prev);
  }, []);

  return (
    <div
      data-slot="password-field-input"
      data-error={error || undefined}
      className={cn("w-full max-w-sm font-sans", containerClassName)}
    >
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={error || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-white py-2 pr-10 pl-3.5 font-sans text-sm text-ink ring-0 transition-[border-color,background-color] duration-200 outline-none placeholder:text-ink-muted focus:ring-0 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted",
            error
              ? "border-danger focus:border-danger"
              : "border-line focus:border-ink",
            className,
          )}
          {...props}
        />

        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={toggleVisibility}
          className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-subtle hover:text-ink-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? (
            <EyeOff size={16} strokeWidth={2} aria-hidden />
          ) : (
            <Eye size={16} strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

PasswordFieldInput.displayName = "PasswordFieldInput";
