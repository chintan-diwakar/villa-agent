# Villa Agent System (Effect + Redis Streams + Postgres)

Event-driven, multilateral workflow engine skeleton in TypeScript.

## What you get
- Express `POST /chat` to ingest messages (universal `parts[]`)
- Context bundle assembly (transcript + user_context + placeholders for listing policy)
- Workflow engine emits events to Redis Streams
- Worker consumes events and routes to agents via Agent Registry
- Agents can emit next events, patch workflow state, and produce final user parts

## Run

```bash
cd villa-agent-system
npm install
cp .env.example .env
npm run dev
```

## Next steps
- Replace stub agents with real LLM calls (JSON schema outputs)
- Add a Tool Registry + safe executor
- Add Human approval queue events + Next.js dashboard
- Implement WhatsApp Cloud API adapter (webhook + sender)
- Implement listing policy pack resolver (listing API facts + overrides)
- Add a dedicated sender worker that consumes `SEND_MESSAGE`
