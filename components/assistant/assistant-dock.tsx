"use client";

import { Bot } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ChatPanel } from "@/components/assistant/chat-panel";

/** Floating assistant available on every app page (hidden on the full-page assistant). */
export function AssistantDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/assistant")) return null;

  return (
    <>
      {open ? (
        <div className="fixed inset-x-2 bottom-2 z-40 flex h-[min(600px,80vh)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
          <ChatPanel className="flex-1 shadow-2xl" onClose={() => setOpen(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-(--accent) px-4 py-3 text-sm font-medium text-white shadow-(--shadow-md) hover:bg-(--accent-hover)"
        >
          <Bot className="size-5" aria-hidden />
          <span className="hidden sm:inline">Ask SmartBook</span>
        </button>
      )}
    </>
  );
}
