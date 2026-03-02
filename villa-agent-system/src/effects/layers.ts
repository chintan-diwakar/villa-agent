import { Context, Effect, Layer } from "effect";
import Redis from "ioredis";
import { Pool } from "pg";

export class Pg extends Context.Tag("Pg")<Pg, { pool: Pool }>() {}
export class RedisClient extends Context.Tag("RedisClient")<RedisClient, { redis: Redis }>() {}

export const PgLive = Layer.effect(
  Pg,
  Effect.sync(() => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return { pool };
  })
);

export const RedisLive = Layer.effect(
  RedisClient,
  Effect.sync(() => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    return { redis };
  })
);
