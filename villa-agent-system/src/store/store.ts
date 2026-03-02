import { Context, Effect } from "effect";
import type { ContextBundle, InteractionPart, WorkflowState } from "../domain/schemas.js";

export interface Store {
  putInteraction: (args: {
    conversationId: string;
    userId: string;
    channel: string;
    channelUserId?: string;
    providerMsgId?: string;
    direction: "in" | "out";
    role?: string;
    agentName?: string;
    parts: InteractionPart[];
    metadata?: Record<string, unknown>;
  }) => Effect.Effect<{ interactionId: string }, Error>;

  getRecentTranscript: (conversationId: string, limit: number) => Effect.Effect<string, Error>;

  getWorkflowState: (runId: string) => Effect.Effect<WorkflowState | null, Error>;
  upsertWorkflowState: (state: WorkflowState) => Effect.Effect<void, Error>;

  putContextBundle: (bundle: ContextBundle) => Effect.Effect<void, Error>;
  getContextBundle: (bundleId: string) => Effect.Effect<ContextBundle | null, Error>;

  getUserContext: (userId: string) => Effect.Effect<Record<string, unknown>, Error>;
  patchUserContext: (userId: string, patch: Record<string, unknown>) => Effect.Effect<void, Error>;
}

export class StoreSvc extends Context.Tag("Store")<StoreSvc, Store>() {}

export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  run: (input: I) => Effect.Effect<O, Error>;
}
