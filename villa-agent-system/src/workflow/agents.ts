import { Effect } from "effect";
import { z } from "zod";
import type { WorkflowEvent, WorkflowState, InteractionPart } from "../domain/schemas.js";
import { runStructured } from "../llm/openai.js";

export type AgentResult = {
  statePatch?: Partial<WorkflowState>;
  emitEvents?: Array<{ type: WorkflowEvent["type"]; payload?: Record<string, unknown> }>;
  finalUserParts?: InteractionPart[]; // used by formatter/sender
};

export type Agent = {
  name: string;
  handle: (input: { event: WorkflowEvent; state: WorkflowState; context: any }) => Effect.Effect<AgentResult, Error>;
};

const TriageOut = z.object({
  intent: z.enum(["BOOKING", "COMPLAINT", "PAYMENT", "GENERAL"]),
  requiresHuman: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.7),
  nextEvent: z.enum(["NEXT_EVENT", "APPROVAL_EVENT"]).default("NEXT_EVENT"),
  notes: z.string().optional()
});

export const TriageAgent: Agent = {
  name: "triage",
  handle: ({ event, context }) =>
    Effect.catchAll(
      runStructured({
        model: process.env.MODEL_TRIAGE ?? "gpt-4.1-mini",
        schemaName: "TriageOutput",
        schema: TriageOut,
        system:
          "You are a triage agent for a villa concierge system. Classify the user request intent. " +
          "Be conservative: if money/refunds or policy exceptions are involved, set requiresHuman=true.",
        input: [
          `channel: ${String(event.payload["channel"] ?? "unknown")}`,
          context?.bundle?.transcript ? `recent:\n${context.bundle.transcript}` : "recent: (none)",
          "user_message_parts:",
          JSON.stringify(event.payload["inboundParts"] ?? [], null, 2),
          "tool_results:",
          JSON.stringify(event.payload["toolResults"] ?? [], null, 2)
        ].join("\n")
      }),
      () =>
        // fallback if OPENAI key missing etc.
        Effect.succeed({ intent: "GENERAL", requiresHuman: false, confidence: 0.3, nextEvent: "NEXT_EVENT" } as any)
    ).pipe(
      Effect.map((out) => ({
        statePatch: { intent: out.intent, lastAgent: "triage" },
        emitEvents: [
          {
            type: out.nextEvent,
            payload: {
              intent: out.intent,
              requiresHuman: out.requiresHuman,
              confidence: out.confidence,
              notes: out.notes
            }
          }
        ]
      }))
    )
};

const BookingOut = z.object({
  status: z.enum(["COMPLETED", "NEEDS_USER_INPUT", "FAILED"]),
  messageToUser: z.string().min(1),
  requiresHuman: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.7)
});

export const BookingAgent: Agent = {
  name: "booking",
  handle: ({ event, context }) =>
    Effect.catchAll(
      runStructured({
        model: process.env.MODEL_BOOKING ?? "gpt-4.1-mini",
        schemaName: "BookingResult",
        schema: BookingOut,
        system:
          "You are the Booking Agent. Respond as a villa concierge. " +
          "If information is missing, ask a short clarifying question. " +
          "If any refund/payment is requested, set requiresHuman=true.",
        input: [
          context?.bundle?.transcript ? `recent:\n${context.bundle.transcript}` : "recent: (none)",
          context?.bundle?.userContext ? `user_context:\n${JSON.stringify(context.bundle.userContext)}` : "user_context: {}",
          context?.bundle?.listingPolicyPack
            ? `listing_policy_pack:\n${JSON.stringify(context.bundle.listingPolicyPack)}`
            : "listing_policy_pack: (not provided)",
          "user_message_parts:",
          JSON.stringify(event.payload["inboundParts"] ?? [], null, 2)
        ].join("\n")
      }),
      () =>
        Effect.succeed({
          status: "COMPLETED",
          messageToUser: "Got it. (LLM not configured yet) Tell me your check-in date and number of guests.",
          requiresHuman: false,
          confidence: 0.2
        } as any)
    ).pipe(
      Effect.map((out) => ({
        statePatch: { lastAgent: "booking" },
        emitEvents: [
          {
            type: "FINAL_RESULT",
            payload: {
              status: out.status,
              messageToUser: out.messageToUser,
              requiresHuman: out.requiresHuman,
              confidence: out.confidence
            }
          }
        ]
      }))
    )
};

export const ResponseFormatterAgent: Agent = {
  name: "formatter",
  handle: ({ event }) =>
    Effect.sync(() => {
      const msg = (event.payload["messageToUser"] as string | undefined) ?? "Done.";
      return {
        finalUserParts: [{ type: "text", text: msg }]
      };
    })
};
