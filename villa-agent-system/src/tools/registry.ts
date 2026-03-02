import { z } from "zod";
import { Effect } from "effect";

export type ToolDef<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = {
  name: string;
  description: string;
  input: I;
  output: O;
  run: (input: z.infer<I>) => Effect.Effect<z.infer<O>, Error>;
};

export const GetTimeTool: ToolDef<z.ZodObject<any>, z.ZodObject<any>> = {
  name: "get_time",
  description: "Get current server time in ISO format",
  input: z.object({}),
  output: z.object({ now: z.string() }),
  run: () => Effect.sync(() => ({ now: new Date().toISOString() }))
};

const FetchUrlInput = z.object({
  url: z.string().url()
});

const FetchUrlOutput = z.object({
  url: z.string().url(),
  status: z.number(),
  text: z.string()
});

export const FetchUrlTool: ToolDef<typeof FetchUrlInput, typeof FetchUrlOutput> = {
  name: "fetch_url",
  description: "Fetch a URL and return text (MVP: first 20k chars).",
  input: FetchUrlInput,
  output: FetchUrlOutput,
  run: ({ url }) =>
    Effect.tryPromise({
      try: async () => {
        // Basic safety: allow only http(s)
        if (!url.startsWith("http://") && !url.startsWith("https://")) throw new Error("Only http/https allowed");
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 10_000);
        try {
          const r = await fetch(url, { signal: controller.signal });
          const text = (await r.text()).slice(0, 20_000);
          return { url, status: r.status, text };
        } finally {
          clearTimeout(t);
        }
      },
      catch: (e) => new Error(`fetch_url failed: ${String(e)}`)
    })
};

export const ToolRegistry = {
  get_time: GetTimeTool,
  fetch_url: FetchUrlTool
};

export type ToolName = keyof typeof ToolRegistry;
