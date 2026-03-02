import { Effect } from "effect";
import crypto from "node:crypto";
import type { ContextBundle, InboundMessage } from "../domain/schemas.js";
import { StoreSvc } from "../store/store.js";

export type ContextAssembler = {
  assemble: (
    inbound: InboundMessage,
    runId: string
  ) => Effect.Effect<ContextBundle, Error, StoreSvc>;
};

// NOTE: Listing policy pack resolution is stubbed here.
export const LiveContextAssembler: ContextAssembler = {
  assemble: (inbound) =>
    Effect.gen(function* () {
      const store = yield* StoreSvc;

      const transcript = yield* store.getRecentTranscript(inbound.conversationId, 30);
      const userContext = yield* store.getUserContext(inbound.userId);

      const listingPolicyPack = undefined; // TODO: fetch listing API + overlay and merge.

      const bundle: ContextBundle = {
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        userId: inbound.userId,
        conversationId: inbound.conversationId,
        channel: inbound.channel,
        channelConstraints: (inbound.metadata as any)?.channelConstraints ?? {},
        userContext,
        listingPolicyPack,
        transcript
      };

      yield* store.putContextBundle(bundle);
      return bundle;
    })
};
