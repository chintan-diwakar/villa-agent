import { Effect, Layer } from "effect";
import { EventBus } from "./eventBus.js";
import { RedisClient } from "../effects/layers.js";
import type { WorkflowEvent } from "../domain/schemas.js";

// Minimal publisher; add consumer-group processing later.
export const RedisStreamsBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const { redis } = yield* RedisClient;

    const publish = (stream: string, event: WorkflowEvent) =>
      Effect.tryPromise({
        try: async () => {
          // Store event JSON as a single field.
          await redis.xadd(stream, "*", "event", JSON.stringify(event));
        },
        catch: (e) => new Error(`xadd failed: ${String(e)}`)
      });

    return { publish };
  })
);
