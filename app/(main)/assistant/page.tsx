import type { Metadata } from "next";

import { ChatPanel } from "@/components/assistant/chat-panel";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Assistant</h1>
        <p className="text-sm text-neutral-500">
          Ask in plain language. It sees live occupancy and noise, and always asks before booking or cancelling.
        </p>
      </div>
      <ChatPanel className="flex-1" />
    </div>
  );
}
