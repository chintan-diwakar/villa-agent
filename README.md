# villa-agent

Monorepo (MVP) containing:

- `villa-agent-system/` — Effect + Redis Streams + Postgres event-driven agent backend
- `villa-agent-ui/` — Next.js test UI that proxies to the backend

## Quick start

### 1) Backend

```bash
cd villa-agent-system
cp .env.example .env
npm install
npm run dev
```

### 2) UI

```bash
cd ../villa-agent-ui
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000
