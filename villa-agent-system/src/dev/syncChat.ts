import { Effect } from "effect";
import type { InboundMessage, InteractionPart } from "../domain/schemas.js";
import { TriageAgent, BookingAgent, ResponseFormatterAgent } from "../workflow/agents.js";

export type SyncChatResponse = {
  ok: true;
  response: { parts: InteractionPart[] };
};

/**
 * Synchronous dev-only runner.
 *
 * Flow: triage -> planner -> (tool executor) -> booking(writer) -> formatter
 */
export function runSyncChat(inbound: InboundMessage): Effect.Effect<SyncChatResponse, Error> {
  return Effect.gen(function* () {
    const baseEvent = {
      id: "dev",
      ts: new Date().toISOString(),
      type: "INITIAL_EVENT" as const,
      runId: "dev-run",
      userId: inbound.userId,
      conversationId: inbound.conversationId,
      listingId: (inbound.metadata as any)?.listingId,
      payload: { inboundParts: inbound.parts, channel: inbound.channel }
    };

    const baseState = {
      runId: "dev-run",
      version: 0,
      status: "RUNNING" as const,
      facts: {}
    };

    // Triage
    const triage = yield* TriageAgent.handle({ event: baseEvent as any, state: baseState as any, context: { bundle: { transcript: "" } } });
    const intent = (triage.statePatch as any)?.intent ?? "GENERAL";

    // Planner (tool selection)
    const { runPlanner } = yield* Effect.promise(() => import("../workflow/planner.js"));
    const plan = yield* runPlanner({
      model: process.env.MODEL_PLANNER ?? process.env.MODEL_TRIAGE ?? "gpt-4.1-mini",
      transcript: "",
      inboundParts: inbound.parts
    });

    // Execute tools safely
    const { executeTool } = yield* Effect.promise(() => import("../tools/executor.js"));
    const toolResults = [] as any[];
    for (const tr of plan.toolRequests) {
      toolResults.push(yield* executeTool(tr));
    }

    // Booking/Writer: pass tool results via event payload
    const bookingEvent = {
      ...baseEvent,
      type: "NEXT_EVENT" as const,
      payload: { intent, inboundParts: inbound.parts, toolResults }
    };

    const booking = yield* BookingAgent.handle({
      event: bookingEvent as any,
      state: { ...baseState, ...(triage.statePatch ?? {}) } as any,
      context: { bundle: { transcript: "", userContext: {} } }
    });

    const finalPayload = booking.emitEvents?.find((e) => e.type === "FINAL_RESULT")?.payload ?? {
      status: "COMPLETED",
      messageToUser: "Done."
    };

    const fmtEvent = {
      ...baseEvent,
      type: "SEND_MESSAGE" as const,
      payload: finalPayload
    };

    const formatted = yield* ResponseFormatterAgent.handle({ event: fmtEvent as any, state: baseState as any, context: { bundle: null } });

    return {
      ok: true as const,
      response: { parts: formatted.finalUserParts ?? [{ type: "text", text: String(finalPayload.messageToUser ?? "Done.") }] }
    };
  });
}
