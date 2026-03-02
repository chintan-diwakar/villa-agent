import { Effect } from "effect";
import type { WorkflowEvent, WorkflowState, InteractionPart } from "../domain/schemas.js";

export type AgentResult = {
  statePatch?: Partial<WorkflowState>;
  emitEvents?: Array<{ type: WorkflowEvent["type"]; payload?: Record<string, unknown> }>;
  finalUserParts?: InteractionPart[]; // used by formatter/sender
};

export type Agent = {
  name: string;
  handle: (input: { event: WorkflowEvent; state: WorkflowState; context: any }) => Effect.Effect<AgentResult, Error>;
};

export const TriageAgent: Agent = {
  name: "triage",
  handle: ({ event, state, context }) =>
    Effect.sync(() => {
      // TODO: replace with LLM JSON-schema classification
      const text = context?.bundle?.transcript ?? "";
      const intent = (event.payload["intent"] as string | undefined) ?? "BOOKING";
      return {
        statePatch: { intent, lastAgent: "triage" },
        emitEvents: [{ type: "NEXT_EVENT", payload: { intent } }]
      };
    })
};

export const BookingAgent: Agent = {
  name: "booking",
  handle: ({ state }) =>
    Effect.sync(() => {
      // TODO: LLM + tools. For now, return a structured final result.
      return {
        statePatch: { lastAgent: "booking" },
        emitEvents: [
          {
            type: "FINAL_RESULT",
            payload: { status: "COMPLETED", messageToUser: "Your booking request is processed." }
          }
        ]
      };
    })
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
