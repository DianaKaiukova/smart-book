"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { ToastNotificationBanner } from "@/components/ui/toast-notification-banner";

type Toast = { id: number; message: string; tone: "success" | "error" };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);
const AUTO_DISMISS_MS = 4000;

let nextId = 1;

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((message: string, tone: Toast["tone"]) => {
    const id = nextId++;
    setToasts((all) => [...all.slice(-2), { id, message, tone }]);
  }, []);

  const [api] = useState<ToastApi>(() => ({
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
  }));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDone]);

  if (toast.tone === "error") {
    return (
      <div
        role="alert"
        className="pointer-events-auto max-w-80 rounded-xl border border-danger-soft bg-danger-soft px-3 py-2.5 text-[13px] text-danger shadow-lg"
      >
        {toast.message}
      </div>
    );
  }
  return (
    <ToastNotificationBanner
      className="pointer-events-auto"
      message={toast.message}
      actionLabel=""
      onDismiss={() => setTimeout(() => onDone(toast.id), 300)}
    />
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <Toaster>");
  return api;
}
