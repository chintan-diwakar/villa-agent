import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const agentBase = process.env.AGENT_BASE_URL ?? "http://localhost:3001";
  const r = await fetch(`${agentBase}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
