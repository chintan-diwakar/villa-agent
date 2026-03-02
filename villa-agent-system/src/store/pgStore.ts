import { Effect, Layer } from "effect";
import { Pg } from "../effects/layers.js";
import { StoreSvc, type Store } from "./store.js";
import { WorkflowStateSchema, ContextBundleSchema } from "../domain/schemas.js";

export const PgStoreLive = Layer.effect(
  StoreSvc,
  Effect.gen(function* () {
    const { pool } = yield* Pg;

    const putInteraction: Store["putInteraction"] = (args) =>
      Effect.tryPromise({
        try: async () => {
          // NOTE: assumes your DB has tables conversations/interactions/interaction_parts.
          // For MVP: conversationId is externally provided; enforce FK in your app.
          const client = await pool.connect();
          try {
            await client.query("BEGIN");

            const interactionId = (await client.query<{ id: string }>(
              `INSERT INTO interactions (
                 ts, conversation_id, user_id, direction, channel, channel_user_id, provider_msg_id,
                 role, agent_name, metadata
               ) VALUES (now(), $1, $2, $3::interaction_direction, $4, $5, $6, $7, $8, $9::jsonb)
               RETURNING id`,
              [
                args.conversationId,
                args.userId,
                args.direction,
                args.channel,
                args.channelUserId ?? null,
                args.providerMsgId ?? null,
                args.role ?? null,
                args.agentName ?? null,
                JSON.stringify(args.metadata ?? {})
              ]
            )).rows[0]!.id;

            for (let i = 0; i < args.parts.length; i++) {
              const p = args.parts[i]!;
              const assetId = (p as any).assetId ?? null;
              const text = (p as any).text ?? null;
              const payload = (p as any).payload ?? (p.type === "structured" ? (p as any).payload : {});

              await client.query(
                `INSERT INTO interaction_parts (interaction_id, idx, type, text, asset_id, payload)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
                [interactionId, i, p.type, text, assetId, JSON.stringify(payload ?? {})]
              );
            }

            await client.query("COMMIT");
            return { interactionId };
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        },
        catch: (e) => new Error(`putInteraction failed: ${String(e)}`)
      });

    const getRecentTranscript: Store["getRecentTranscript"] = (conversationId, limit) =>
      Effect.tryPromise({
        try: async () => {
          const { rows } = await pool.query<{
            ts: string;
            agent_name: string | null;
            role: string | null;
            direction: string;
            parts: any[];
          }>(
            `SELECT i.ts, i.agent_name, i.role, i.direction,
                    json_agg(json_build_object('idx', p.idx, 'type', p.type, 'text', p.text, 'payload', p.payload) ORDER BY p.idx) AS parts
             FROM interactions i
             JOIN interaction_parts p ON p.interaction_id = i.id
             WHERE i.conversation_id = $1
             GROUP BY i.id
             ORDER BY i.ts DESC
             LIMIT $2`,
            [conversationId, limit]
          );

          const ordered = rows.slice().reverse();
          return ordered
            .map((r) => {
              const speaker = r.agent_name ?? r.role ?? "unknown";
              const textBits = (r.parts ?? [])
                .filter((pp: any) => pp.type === "text" || pp.type === "transcript")
                .map((pp: any) => pp.text)
                .filter(Boolean);
              const joined = textBits.join("\n");
              return `${r.ts} [${speaker}] (${r.direction}): ${joined}`;
            })
            .join("\n");
        },
        catch: (e) => new Error(`getRecentTranscript failed: ${String(e)}`)
      });

    const getWorkflowState: Store["getWorkflowState"] = (runId) =>
      Effect.tryPromise({
        try: async () => {
          const { rows } = await pool.query<{ state: any }>(
            `SELECT state FROM workflow_state WHERE run_id = $1`,
            [runId]
          );
          if (!rows[0]) return null;
          return WorkflowStateSchema.parse(rows[0].state);
        },
        catch: (e) => new Error(`getWorkflowState failed: ${String(e)}`)
      });

    const upsertWorkflowState: Store["upsertWorkflowState"] = (state) =>
      Effect.tryPromise({
        try: async () => {
          await pool.query(
            `INSERT INTO workflow_state (run_id, version, status, state, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, now())
             ON CONFLICT (run_id)
             DO UPDATE SET version = EXCLUDED.version, status = EXCLUDED.status, state = EXCLUDED.state, updated_at = now()`,
            [state.runId, state.version, state.status, JSON.stringify(state)]
          );
        },
        catch: (e) => new Error(`upsertWorkflowState failed: ${String(e)}`)
      });

    const putContextBundle: Store["putContextBundle"] = (bundle) =>
      Effect.tryPromise({
        try: async () => {
          await pool.query(
            `INSERT INTO context_bundles (id, ts, user_id, conversation_id, channel, bundle)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)
             ON CONFLICT (id) DO UPDATE SET bundle = EXCLUDED.bundle`,
            [bundle.id, bundle.ts, bundle.userId, bundle.conversationId, bundle.channel, JSON.stringify(bundle)]
          );
        },
        catch: (e) => new Error(`putContextBundle failed: ${String(e)}`)
      });

    const getContextBundle: Store["getContextBundle"] = (bundleId) =>
      Effect.tryPromise({
        try: async () => {
          const { rows } = await pool.query<{ bundle: any }>(
            `SELECT bundle FROM context_bundles WHERE id = $1`,
            [bundleId]
          );
          if (!rows[0]) return null;
          return ContextBundleSchema.parse(rows[0].bundle);
        },
        catch: (e) => new Error(`getContextBundle failed: ${String(e)}`)
      });

    const getUserContext: Store["getUserContext"] = (userId) =>
      Effect.tryPromise({
        try: async () => {
          const { rows } = await pool.query<{ user_context: any; preferences: any; facts: any; persona_summary: string | null }>(
            `SELECT persona_summary, preferences, facts FROM user_context WHERE user_id = $1`,
            [userId]
          );
          if (!rows[0]) return {};
          return {
            persona_summary: rows[0].persona_summary,
            preferences: rows[0].preferences ?? {},
            facts: rows[0].facts ?? {}
          };
        },
        catch: (e) => new Error(`getUserContext failed: ${String(e)}`)
      });

    const patchUserContext: Store["patchUserContext"] = (userId, patch) =>
      Effect.tryPromise({
        try: async () => {
          // simplistic merge; customize as needed.
          await pool.query(
            `INSERT INTO user_context (user_id, persona_summary, preferences, facts, updated_at)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
             ON CONFLICT (user_id)
             DO UPDATE SET
               persona_summary = COALESCE(EXCLUDED.persona_summary, user_context.persona_summary),
               preferences = user_context.preferences || EXCLUDED.preferences,
               facts = user_context.facts || EXCLUDED.facts,
               updated_at = now()`,
            [
              userId,
              (patch as any).persona_summary ?? null,
              JSON.stringify((patch as any).preferences ?? {}),
              JSON.stringify((patch as any).facts ?? {})
            ]
          );
        },
        catch: (e) => new Error(`patchUserContext failed: ${String(e)}`)
      });

    return {
      putInteraction,
      getRecentTranscript,
      getWorkflowState,
      upsertWorkflowState,
      putContextBundle,
      getContextBundle,
      getUserContext,
      patchUserContext
    };
  })
);
