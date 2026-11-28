"use client";

import { Bot } from "lucide-react";
import { useState } from "react";

import { ChatPanel } from "@/components/assistant/chat-panel";

/** Floating assistant available on every app page. */
export function AssistantDock() {
  const [open, setOpen] = useState(false);

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
          aria-label="Ask SmartBookBot"
          title="Ask SmartBookBot"
          className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-(--shadow-md) hover:bg-accent-hover"
        >
          <Bot className="size-6" aria-hidden />
        </button>
      )}
    </>
  );
}
