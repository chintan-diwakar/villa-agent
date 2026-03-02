import { Effect } from "effect";
import crypto from "node:crypto";
import type { InboundMessage, WorkflowEvent, WorkflowState } from "../domain/schemas.js";
import { StoreSvc } from "../store/store.js";
import { EventBus } from "../bus/eventBus.js";
import { LiveContextAssembler } from "./contextAssembler.js";

const STREAM = process.env.EVENT_STREAM ?? "workflow-events";

export const WorkflowEngine = {
  // entrypoint used by API gateway
  ingestInbound: (inbound: InboundMessage) =>
    Effect.gen(function* () {
      const store = yield* StoreSvc;
      const bus = yield* EventBus;

      const runId = crypto.randomUUID();

      // 1) persist inbound interaction
      yield* store.putInteraction({
        conversationId: inbound.conversationId,
        userId: inbound.userId,
        channel: inbound.channel,
        channelUserId: inbound.channelUserId,
        providerMsgId: inbound.providerMsgId,
        direction: "in",
        role: "user",
        agentName: `User:${inbound.channel}`,
        parts: inbound.parts,
        metadata: inbound.metadata
      });

      // 2) assemble context bundle + persist
      const bundle = yield* LiveContextAssembler.assemble(inbound, runId);

      // 3) init workflow state
      const state: WorkflowState = {
        runId,
        version: 0,
        status: "RUNNING",
        facts: {},
        listingId: inbound.metadata?.listingId as any
      };
      yield* store.upsertWorkflowState(state);

      // 4) emit INITIAL_EVENT
      const evt: WorkflowEvent = {
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        type: "INITIAL_EVENT",
        runId,
        userId: inbound.userId,
        conversationId: inbound.conversationId,
        listingId: state.listingId,
        contextRef: bundle.id,
        payload: {
          inboundParts: inbound.parts,
          channel: inbound.channel
        },
        expectedStateVersion: state.version
      };

      yield* bus.publish(STREAM, evt);

      return { ok: true as const, runId };
    })
};
