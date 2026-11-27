"use client";

import { Bot, Check, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SpinLoader } from "@/components/ui/spin-loader";
import type { AssistantResponse, ChatMessage, PendingAction } from "@/lib/assistant/types";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "smartbook.assistant.history";
const SUGGESTIONS = [
  "Find me a quiet room for 2 people now",
  "Is there anything free near Z.1.09?",
  "Why is Z.1.09 marked as ghost?",
  "What are my bookings?",
];

type Entry = ChatMessage & { pending?: PendingAction; error?: boolean };

function loadHistory(): Entry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

async function callAssistant(body: object): Promise<AssistantResponse> {
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    return (await response.json()) as AssistantResponse;
  } catch {
    return { ok: false, error: "Network error — try again." };
  }
}

export function ChatPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from sessionStorage once on mount
    setEntries(loadHistory());
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-40)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const history = (list: Entry[]): ChatMessage[] =>
    list.filter((e) => !e.error).map(({ role, content }) => ({ role, content }));

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...entries.map((e) => ({ ...e, pending: undefined })), { role: "user" as const, content }];
    setEntries(next);
    setInput("");
    setBusy(true);
    const result = await callAssistant({ messages: history(next) });
    setBusy(false);
    setEntries((all) => [
      ...all,
      result.ok
        ? { role: "assistant", content: result.reply, pending: result.pendingAction }
        : { role: "assistant", content: result.error, error: true },
    ]);
  }

  async function resolve(index: number, action: PendingAction, confirmed: boolean) {
    setEntries((all) => all.map((e, i) => (i === index ? { ...e, pending: undefined } : e)));
    if (!confirmed) {
      setEntries((all) => [...all, { role: "assistant", content: "Okay, I didn't do it." }]);
      return;
    }
    setBusy(true);
    const result = await callAssistant({ confirm: action });
    setBusy(false);
    setEntries((all) => [
      ...all,
      result.ok ? { role: "assistant", content: result.reply } : { role: "assistant", content: result.error, error: true },
    ]);
    if (result.ok && result.changed) router.refresh();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white", className)}>
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Bot className="size-4" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-900">SmartBook assistant</p>
          <p className="text-[11px] text-neutral-500">Asks before it books or cancels anything</p>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            title="Clear conversation"
            onClick={() => setEntries([])}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
        {onClose ? (
          <button type="button" title="Close" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-500">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 hover:border-indigo-300 hover:bg-indigo-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {entries.map((entry, index) => (
          <div key={index} className={cn("flex flex-col gap-2", entry.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                entry.role === "user" && "bg-indigo-600 text-white",
                entry.role === "assistant" && !entry.error && "bg-neutral-100 text-neutral-900",
                entry.error && "border border-rose-200 bg-rose-50 text-rose-800",
              )}
            >
              {entry.content}
            </div>
            {entry.pending ? (
              <div className="flex max-w-[85%] flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">{entry.pending.summary}?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolve(index, entry.pending!, true)}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <Check className="size-3.5" aria-hidden /> Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolve(index, entry.pending!, false)}
                    className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-white disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {busy ? <SpinLoader size="sm" label="Thinking…" className="self-start text-neutral-400" /> : null}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-neutral-100 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a room…"
          maxLength={1000}
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Send</span>
        </button>
      </form>
    </div>
  );
}
