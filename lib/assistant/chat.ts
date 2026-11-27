import "server-only";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { localLabel, isoWithOffset, runTool, toolDefinitions, type ToolContext } from "@/lib/assistant/tools";
import type { ChatMessage, PendingAction } from "@/lib/assistant/types";
import { BOOKING_RULES } from "@/lib/booking/rules";
import { appConfig } from "@/lib/config";

const MAX_TOOL_ROUNDS = 6;

let client: OpenAI | undefined;
function getClient(): OpenAI | undefined {
  if (!process.env.OPENAI_API_KEY) return undefined;
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export class AssistantUnavailableError extends Error {}

function systemPrompt(ctx: ToolContext): string {
  return [
    `You are SmartBookBot, the SmartBook assistant for study rooms in Building Z (rooms are named like Z.1.09 = building Z, floor 1, room 09).`,
    `The user is ${ctx.user.name} (${ctx.user.role === "ADMIN" ? "facilities admin" : "student member"}).`,
    `Current time: ${localLabel(ctx.now, ctx.timeZone)} (${isoWithOffset(ctx.now, ctx.timeZone)}, timezone ${ctx.timeZone}).`,
    `Rules: book-now up to ${BOOKING_RULES.maxNowMinutes} min, future slots ${BOOKING_RULES.minMinutes}–${BOOKING_RULES.maxSlotMinutes} min, at most ${BOOKING_RULES.maxDaysAhead} days ahead.`,
    `Room states: free; booked (holder not arrived yet); booked_in_use; occupied (people inside without a booking); ghost_booking (booked but sensors show it empty — anyone may book it now, which releases the no-show booking).`,
    `Always use tools for facts about rooms and bookings; never invent availability.`,
    `book_room and cancel_booking only PROPOSE an action. The app shows a Confirm button; never say something is booked or cancelled until the user confirmed.`,
    `Pass times as ISO 8601 with the user's UTC offset. Omit start to book "now".`,
    `Keep replies short and friendly, use local times like 14:30, and mention noise level when the user cares about quiet.`,
  ].join("\n");
}

export async function runAssistant(
  history: ChatMessage[],
  ctx: ToolContext,
): Promise<{ reply: string; pendingAction?: PendingAction }> {
  const openai = getClient();
  if (!openai) throw new AssistantUnavailableError("SmartBookBot is not configured: add OPENAI_API_KEY to .env and restart.");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(ctx) },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ];
  const tools = toolDefinitions(ctx.user.role);
  let pendingAction: PendingAction | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model: appConfig.openaiModel,
      messages,
      tools,
      // Final round: force a text answer.
      tool_choice: round === MAX_TOOL_ROUNDS - 1 ? "none" : "auto",
    });
    const message = completion.choices[0]?.message;
    if (!message) break;

    const toolCalls = (message.tool_calls ?? []).filter((c) => c.type === "function");
    if (toolCalls.length === 0) {
      return { reply: message.content?.trim() || "Sorry, I have no answer to that.", pendingAction };
    }

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const isWrite = call.function.name === "book_room" || call.function.name === "cancel_booking";
      const outcome =
        isWrite && pendingAction
          ? { result: { error: "Only one action can be confirmed at a time. Ask the user to confirm the first one." } }
          : await runTool(call.function.name, call.function.arguments, ctx);
      if (outcome.pendingAction) pendingAction = outcome.pendingAction;
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.result) });
    }
  }

  return { reply: pendingAction ? pendingAction.summary : "Sorry, that took too many steps. Could you rephrase?", pendingAction };
}
