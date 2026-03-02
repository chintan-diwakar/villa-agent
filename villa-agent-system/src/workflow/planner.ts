import { Effect } from "effect";
import { z } from "zod";
import { runStructured } from "../llm/openai.js";
import { ToolRequestSchema, type ToolRequest } from "../tools/executor.js";

const PlannerOut = z.object({
  toolRequests: z.array(ToolRequestSchema).default([]),
  notes: z.string().optional()
});

export function runPlanner(input: {
  model: string;
  transcript: string;
  inboundParts: unknown;
}): Effect.Effect<{ toolRequests: ToolRequest[]; notes?: string }, Error> {
  return runStructured({
    model: input.model,
    schemaName: "PlannerOutput",
    schema: PlannerOut,
    system:
      "You are a planner. Decide which tools to call to help answer the user. " +
      "Only choose from the allowed tools. If no tool is needed, return empty toolRequests.",
    input: [
      input.transcript ? `recent:\n${input.transcript}` : "recent: (none)",
      "user_message_parts:",
      JSON.stringify(input.inboundParts ?? [], null, 2),
      "allowed_tools: get_time, fetch_url"
    ].join("\n")
  } as any);
}
