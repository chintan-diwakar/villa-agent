import "dotenv/config";
import express from "express";
import { Effect, Layer } from "effect";

import { InboundMessageSchema } from "./domain/schemas.js";
import { PgLive, RedisLive } from "./effects/layers.js";
import { RedisStreamsBusLive } from "./bus/redisStreamsBus.js";
import { PgStoreLive } from "./store/pgStore.js";
import { WorkflowEngine } from "./workflow/workflowEngine.js";
import { Worker } from "./workflow/worker.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/chat", async (req, res) => {
  const parsed = InboundMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  // Dev-mode: run synchronously without Postgres/Redis.
  if ((process.env.DEV_SYNC ?? "1") === "1") {
    const { runSyncChat } = await import("./dev/syncChat.js");
    const result = await Effect.runPromise(runSyncChat(parsed.data));
    return res.json(result);
  }

  const program = WorkflowEngine.ingestInbound(parsed.data);
  const BaseLayer = Layer.mergeAll(PgLive, RedisLive);
  const AppLayer = BaseLayer.pipe(Layer.provideMerge(RedisStreamsBusLive), Layer.provideMerge(PgStoreLive));
  const runtime = program.pipe(Effect.provide(AppLayer));

  const result = await Effect.runPromise(runtime as any);
  res.json(result);
});

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);

  // Start worker only in async mode.
  if ((process.env.DEV_SYNC ?? "1") !== "1") {
    const BaseLayer = Layer.mergeAll(PgLive, RedisLive);
    const AppLayer = BaseLayer.pipe(Layer.provideMerge(RedisStreamsBusLive), Layer.provideMerge(PgStoreLive));
    const workerRuntime = Worker.runForever().pipe(Effect.provide(AppLayer));
    Effect.runFork(workerRuntime as any);
  }
});
