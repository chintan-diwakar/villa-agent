import OpenAI from "openai";
import { Effect } from "effect";
import { z } from "zod";

export function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

/**
 * Runs a structured output call and validates with Zod.
 * Uses Responses API with `json_schema` response format.
 */
export function runStructured<T extends z.ZodTypeAny>(args: {
  model: string;
  system: string;
  input: string;
  schemaName: string;
  schema: T;
}): Effect.Effect<z.infer<T>, Error> {
  return Effect.tryPromise({
    try: async () => {
      const client = openaiClient();
      const jsonSchema = zodToJsonSchema(args.schema);

      const resp = await client.responses.create({
        model: args.model,
        input: [
          { role: "system", content: [{ type: "input_text", text: args.system }] },
          { role: "user", content: [{ type: "input_text", text: args.input }] }
        ],
        text: {
          format: {
            type: "json_schema",
            name: args.schemaName,
            schema: jsonSchema,
            strict: true
          }
        }
      });

      const out = resp.output_text;
      const parsed = JSON.parse(out);
      return args.schema.parse(parsed);
    },
    catch: (e) => new Error(`OpenAI structured call failed: ${String(e)}`)
  });
}

// Minimal zod->jsonschema helper good enough for our constrained schemas.
// For complex schemas, swap this with a proper converter library.
function zodToJsonSchema(schema: z.ZodTypeAny): any {
  // We keep schemas simple (objects, strings, numbers, booleans, enums, arrays).
  // zod doesn't natively export JSON Schema, so this is a pragmatic MVP.
  if (schema instanceof z.ZodObject) {
    const shape: any = schema.shape;
    const properties: any = {};
    const required: string[] = [];
    for (const key of Object.keys(shape)) {
      properties[key] = zodToJsonSchema(shape[key]);
      if (!(shape[key] instanceof z.ZodOptional) && !(shape[key] instanceof z.ZodDefault)) required.push(key);
    }
    return { type: "object", additionalProperties: false, properties, required };
  }
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodNativeEnum) return { type: "string", enum: Object.values(schema.enum) };
  if (schema instanceof z.ZodArray) return { type: "array", items: zodToJsonSchema(schema.element) };
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema._def.innerType);
  if (schema instanceof z.ZodLiteral) return { const: schema.value };
  if (schema instanceof z.ZodUnion) return { anyOf: schema._def.options.map((s: any) => zodToJsonSchema(s)) };

  // fallback
  return {};
}
