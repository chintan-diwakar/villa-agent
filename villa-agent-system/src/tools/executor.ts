import { Effect } from "effect";
import { z } from "zod";
import { ToolRegistry, type ToolName } from "./registry.js";

export const ToolRequestSchema = z.object({
  tool: z.enum(["get_time", "fetch_url"]),
  args: z.record(z.any()).default({})
});
export type ToolRequest = z.infer<typeof ToolRequestSchema>;

export type ToolResult = {
  tool: ToolName;
  ok: boolean;
  output?: unknown;
  error?: string;
};

export function executeTool(req: ToolRequest): Effect.Effect<ToolResult, never> {
  const tool = ToolRegistry[req.tool as ToolName];

  return Effect.matchEffect(
    Effect.try({
      try: () => tool.input.parse(req.args),
      catch: (e) => new Error(`Invalid tool args for ${req.tool}: ${String(e)}`)
    }).pipe(Effect.flatMap((args) => tool.run(args as any))),
    {
      onFailure: (e) => Effect.succeed({ tool: req.tool as ToolName, ok: false, error: String(e.message ?? e) }),
      onSuccess: (out) =>
        Effect.succeed({ tool: req.tool as ToolName, ok: true, output: tool.output.safeParse(out).success ? out : out })
    }
  );
}
