import { NextResponse } from "next/server";
import OpenAI from "openai";

import { AssistantUnavailableError, runAssistant } from "@/lib/assistant/chat";
import { executeConfirmedAction } from "@/lib/assistant/tools";
import { assistantRequestSchema, type AssistantResponse } from "@/lib/assistant/types";
import { getSessionUser } from "@/lib/auth/session";

function validTimeZone(tz: string | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function json(body: AssistantResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ ok: false, error: "Please sign in again." }, 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "Body must be JSON." }, 400);
  }
  const parsed = assistantRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "Invalid request." }, 400);

  const timeZone = validTimeZone(parsed.data.timeZone);

  // Confirm path: the user pressed Confirm on a proposed action. Executed with their own rights.
  if (parsed.data.confirm) {
    const result = await executeConfirmedAction(parsed.data.confirm, user, timeZone);
    if (!result.ok) return json({ ok: true, reply: `Couldn't do that: ${result.error}` });
    return json({ ok: true, reply: `✅ ${result.message ?? "Done."}`, changed: true });
  }

  if (parsed.data.messages.length === 0 || parsed.data.messages.at(-1)?.role !== "user") {
    return json({ ok: false, error: "Send a message first." }, 400);
  }

  try {
    const { reply, pendingAction } = await runAssistant(parsed.data.messages, { user, now: new Date(), timeZone });
    return json({ ok: true, reply, pendingAction });
  } catch (error) {
    if (error instanceof AssistantUnavailableError) return json({ ok: false, error: error.message }, 503);
    if (error instanceof OpenAI.APIError) {
      console.error("[assistant] OpenAI error", error.status, error.message);
      const hint =
        error.status === 401
          ? "The OpenAI API key was rejected. Check OPENAI_API_KEY in .env."
          : error.status === 404
            ? "The configured OpenAI model is not available. Set OPENAI_MODEL in .env (e.g. gpt-4o-mini)."
            : error.status === 429
              ? "OpenAI rate limit or quota reached. Try again shortly."
              : "The assistant had a problem talking to OpenAI.";
      return json({ ok: false, error: hint }, 502);
    }
    console.error("[assistant] failed", error);
    return json({ ok: false, error: "The assistant hit an unexpected error." }, 500);
  }
}
