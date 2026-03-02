import { Effect, Context } from "effect";
import { WorkflowEvent } from "../domain/schemas.js";

export type Bus = {
  publish: (stream: string, event: WorkflowEvent) => Effect.Effect<void, Error>;
  // consumer groups etc. are implementation-specific
};

export class EventBus extends Context.Tag("EventBus")<EventBus, Bus>() {}
