# Workflow (MVP)

In DEV_SYNC=1 mode:

1) TriageAgent (OpenAI structured)
2) Planner (OpenAI structured) -> chooses `toolRequests[]`
3) Safe tool executor runs those tools
4) BookingAgent acts as Writer and produces final structured response
5) ResponseFormatterAgent converts it to universal `parts[]`

In DEV_SYNC=0 mode (future):
- Redis Streams event-driven workflow engine + workers
- Sender worker
- Human approval events
