# Villa Agent System (Effect + Redis Streams + Postgres)

Event-driven, multilateral workflow engine skeleton in TypeScript.

## What you get
- Express `POST /chat` to ingest messages (universal `parts[]`)
- Context bundle assembly (transcript + user_context + placeholders for listing policy)
- Workflow engine emits events to Redis Streams
- Worker consumes events and routes to agents via Agent Registry
- Agents can emit next events, patch workflow state, and produce final user parts

## Run (Dev sync mode)

This mode is easiest to test: it runs triage -> planner -> tools -> writer synchronously.

```bash
cd villa-agent-system
npm install
cp .env.example .env
# set OPENAI_API_KEY
npm run dev
```

## Run Postgres + Redis (Docker)

From repo root:

```bash
docker compose up -d
```

This initializes Postgres with `villa-agent-system/sql/schema.sql`.

## Tools

Tools are defined in `src/tools/registry.ts` and executed via `src/tools/executor.ts`.
This is the safe boundary: validate args, run tool, return structured result.

## Next steps
- Wire async mode: DEV_SYNC=0 (Redis Streams + worker + sender)
- Add more domain tools (availability, refunds, bookings)
- Add human approval queue + dashboard
- Add Sarvam STT worker (audio -> transcript part)
