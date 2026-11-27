"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type SelectOption<T extends string | number> = { value: T; label: string; disabled?: boolean };

/** Styled replacement for native <select>/<input type="time">, whose popups can't be themed. */
export function SelectMenu<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = "Select",
  icon: Icon = ChevronDown,
  ariaLabel,
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  icon?: LucideIcon;
  ariaLabel?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openMenu() {
    const current = options.findIndex((o) => o.value === value);
    setActiveIndex(current >= 0 ? current : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function move(step: 1 | -1) {
    for (let i = activeIndex + step; i >= 0 && i < options.length; i += step) {
      if (!options[i].disabled) {
        setActiveIndex(i);
        return;
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-sm tabular-nums transition-colors",
          open ? "border-accent ring-2 ring-accent/15" : "border-line hover:border-ink-muted",
          selected ? "text-ink" : "text-ink-muted",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <Icon className={cn("size-4 shrink-0 text-ink-muted transition-transform", open && Icon === ChevronDown && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-(--shadow-md)"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={String(option.value)}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onPointerEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm tabular-nums",
                  option.disabled && "cursor-not-allowed text-ink-muted/60 line-through",
                  !option.disabled && (isSelected ? "bg-accent font-medium text-white" : "text-ink"),
                  !option.disabled && !isSelected && index === activeIndex && "bg-subtle",
                )}
              >
                {option.label}
                {isSelected ? <Check className="size-3.5" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
