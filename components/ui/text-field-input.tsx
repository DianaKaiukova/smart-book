"use client";

// Source: opensourceui (MIT) https://github.com/bidyut10/opensourceui/blob/main/components/inputs/text-field-input.tsx

import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

export type TextFieldInputProps = Readonly<
  {
    label?: string;
    hint?: string;
    error?: boolean;
    errorMessage?: string;
    containerClassName?: string;
  } & Omit<ComponentPropsWithoutRef<"input">, "size">
>;

export const TextFieldInput = forwardRef<HTMLInputElement, TextFieldInputProps>(
  function TextFieldInput(
    {
      className,
      containerClassName,
      id,
      label = "Label",
      hint,
      error = false,
      errorMessage = "This field is required.",
      disabled,
      required,
      type = "text",
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;

    return (
      <div
        data-slot="text-field-input"
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

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-white px-3.5 font-sans text-sm text-ink ring-0 transition-[border-color,background-color] duration-200 outline-none placeholder:text-ink-muted focus:ring-0 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted",
            error
              ? "border-danger focus:border-danger"
              : "border-line focus:border-ink",
            className,
          )}
          {...props}
        />

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
  },
);

TextFieldInput.displayName = "TextFieldInput";
