# DB Notes

This code assumes additional tables beyond the earlier interactions schema:

- `workflow_state`:
  - run_id (pk)
  - version (int)
  - status (text)
  - state (jsonb)
  - updated_at (timestamptz)

- `context_bundles`:
  - id (pk)
  - ts (timestamptz or text iso)
  - user_id
  - conversation_id
  - channel
  - bundle (jsonb)

These are used to keep large shared context out of Redis events.

For production, run workers as a separate process and use Redis Streams consumer groups.
