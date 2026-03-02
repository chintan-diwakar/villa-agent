import { z } from "zod";

export const ChannelSchema = z.enum(["whatsapp", "web", "app", "api"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const DirectionSchema = z.enum(["in", "out"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const InteractionPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1) }),
  z.object({ type: z.literal("image"), assetId: z.string().min(1), payload: z.record(z.any()).optional() }),
  z.object({ type: z.literal("audio"), assetId: z.string().min(1), payload: z.record(z.any()).optional() }),
  z.object({ type: z.literal("video"), assetId: z.string().min(1), payload: z.record(z.any()).optional() }),
  z.object({ type: z.literal("file"), assetId: z.string().min(1), payload: z.record(z.any()).optional() }),
  z.object({ type: z.literal("location"), payload: z.object({ lat: z.number(), lng: z.number() }).passthrough() }),
  z.object({ type: z.literal("transcript"), text: z.string().min(1), payload: z.record(z.any()).optional() }),
  z.object({ type: z.literal("structured"), payload: z.record(z.any()) })
]);
export type InteractionPart = z.infer<typeof InteractionPartSchema>;

export const InboundMessageSchema = z.object({
  channel: ChannelSchema,
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1),
  channelUserId: z.string().optional(),
  providerMsgId: z.string().optional(),
  parts: z.array(InteractionPartSchema).min(1),
  metadata: z.record(z.any()).optional()
});
export type InboundMessage = z.infer<typeof InboundMessageSchema>;

export const EventTypeSchema = z.enum([
  "INITIAL_EVENT",
  "NEXT_EVENT",
  "TOOL_RESULT",
  "APPROVAL_EVENT",
  "FINAL_RESULT",
  "SEND_MESSAGE"
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const WorkflowEventSchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  type: EventTypeSchema,
  runId: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1),
  listingId: z.string().optional(),
  payload: z.record(z.any()).default({}),
  contextRef: z.string().optional(),
  expectedStateVersion: z.number().int().nonnegative().optional()
});
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const WorkflowStatusSchema = z.enum(["RUNNING", "WAITING_FOR_USER", "COMPLETED", "FAILED"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const WorkflowStateSchema = z.object({
  runId: z.string().min(1),
  version: z.number().int().nonnegative(),
  status: WorkflowStatusSchema,
  intent: z.string().optional(),
  listingId: z.string().optional(),
  plan: z.record(z.any()).optional(),
  facts: z.record(z.any()).default({}),
  pendingApproval: z
    .object({
      required: z.boolean(),
      summary: z.string().optional(),
      proposedEdits: z.record(z.any()).optional()
    })
    .optional(),
  lastAgent: z.string().optional(),
  lastError: z.string().optional()
});
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const ContextBundleSchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1),
  channel: ChannelSchema,
  channelConstraints: z.record(z.any()).default({}),
  userContext: z.record(z.any()).default({}),
  listingPolicyPack: z.record(z.any()).optional(),
  transcript: z.string().default("")
});
export type ContextBundle = z.infer<typeof ContextBundleSchema>;
