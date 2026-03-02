# Tools

This project uses a Tool Registry + Safe Executor pattern.

- Define tools in `registry.ts` with:
  - `name`, `description`
  - Zod `input` schema
  - Zod `output` schema
  - `run()` implementation

- Execute tools via `executor.ts`:
  - validates args
  - runs the tool
  - returns `{ ok, output }` or `{ ok:false, error }`

Agents should NOT run arbitrary side effects directly.
They should request tools (structured), and only the executor runs them.
