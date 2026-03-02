import { Effect, Layer } from "effect";
import crypto from "node:crypto";
import { EventBus } from "../bus/eventBus.js";
import { RedisClient } from "../effects/layers.js";
import { StoreSvc } from "../store/store.js";
import { WorkflowEventSchema, type WorkflowEvent, type WorkflowState } from "../domain/schemas.js";
import { SimpleAgentRegistry } from "./agentRegistry.js";
import { TriageAgent, BookingAgent, ResponseFormatterAgent, type Agent } from "./agents.js";

const STREAM = process.env.EVENT_STREAM ?? "workflow-events";
const GROUP = process.env.EVENT_GROUP ?? "workers";
const CONSUMER = process.env.EVENT_CONSUMER ?? `c-${crypto.randomUUID().slice(0, 8)}`;

const agents: Record<string, Agent> = {
  triage: TriageAgent,
  booking: BookingAgent,
  formatter: ResponseFormatterAgent
};

export const Worker = {
  runForever: () =>
    Effect.gen(function* () {
      const { redis } = yield* RedisClient;
      const store = yield* StoreSvc;
      const bus = yield* EventBus;

      // Ensure consumer group exists
      yield* Effect.tryPromise({
        try: async () => {
          try {
            await redis.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
          } catch (e: any) {
            if (!String(e?.message ?? e).includes("BUSYGROUP")) throw e;
          }
        },
        catch: (e) => new Error(`xgroup create failed: ${String(e)}`)
      });

      while (true) {
        const resp = yield* Effect.tryPromise({
          try: async () => (redis as any).xreadgroup("GROUP", GROUP, CONSUMER, "BLOCK", 5000, "COUNT", 10, "STREAMS", STREAM, ">"),
          catch: (e) => new Error(`xreadgroup failed: ${String(e)}`)
        });

        if (!resp) continue;

        for (const [, entries] of resp as any) {
          for (const [msgId, kvs] of entries as any) {
            const eventJson = kvs[kvs.indexOf("event") + 1];
            const evt = WorkflowEventSchema.parse(JSON.parse(eventJson)) as WorkflowEvent;

            const state = (yield* store.getWorkflowState(evt.runId)) ?? ({
              runId: evt.runId,
              version: 0,
              status: "RUNNING"
            } as WorkflowState);

            const bundle = evt.contextRef ? yield* store.getContextBundle(evt.contextRef) : null;
            const agentName = yield* SimpleAgentRegistry.resolve(evt);
            const agent = agents[agentName];
            if (!agent) throw new Error(`No agent registered: ${agentName}`);

            const result = yield* agent.handle({ event: evt, state, context: { bundle } });

            // Apply state patch
            if (result.statePatch) {
              const next: WorkflowState = {
                ...state,
                ...result.statePatch,
                version: state.version + 1
              };
              yield* store.upsertWorkflowState(next);
            }

            // Emit events
            for (const e of result.emitEvents ?? []) {
              const nextEvt: WorkflowEvent = {
                id: crypto.randomUUID(),
                ts: new Date().toISOString(),
                type: e.type,
                runId: evt.runId,
                userId: evt.userId,
                conversationId: evt.conversationId,
                listingId: evt.listingId,
                contextRef: evt.contextRef,
                payload: e.payload ?? {},
                expectedStateVersion: (state.version + 1)
              };
              yield* bus.publish(STREAM, nextEvt);
            }

            // Formatter shortcut: if agent returned finalUserParts, persist outbound.
            if (result.finalUserParts) {
              yield* store.putInteraction({
                conversationId: evt.conversationId,
                userId: evt.userId,
                channel: "whatsapp",
                direction: "out",
                role: "assistant",
                agentName: agent.name,
                parts: result.finalUserParts
              });

              // In a real system you'd emit SEND_MESSAGE; sender worker delivers.
            }

            // Ack
            yield* Effect.tryPromise({
              try: async () => redis.xack(STREAM, GROUP, msgId),
              catch: (e) => new Error(`xack failed: ${String(e)}`)
            });
          }
        }
      }
    })
};

