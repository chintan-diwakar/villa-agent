import { Effect } from "effect";
import type { WorkflowEvent } from "../domain/schemas.js";

export type AgentName =
  | "booking"
  | "complaint"
  | "payment"
  | "triage"
  | "formatter";

export type AgentRegistry = {
  resolve: (event: WorkflowEvent) => Effect.Effect<AgentName, Error>;
};

// Replace with real mapping logic (intent + state + event.type)
export const SimpleAgentRegistry: AgentRegistry = {
  resolve: (event) =>
    Effect.sync(() => {
      if (event.type === "SEND_MESSAGE") return "formatter";
      if (event.payload["intent"] === "BOOKING") return "booking";
      if (event.payload["intent"] === "PAYMENT") return "payment";
      if (event.payload["intent"] === "COMPLAINT") return "complaint";
      return "triage";
    })
};
