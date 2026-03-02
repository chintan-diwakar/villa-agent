"use client";

import { useMemo, useState } from "react";

type Part =
  | { type: "text"; text: string }
  | { type: "structured"; payload: any };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Part[];
  ts: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function Home() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const conversationId = useMemo(() => {
    // Persist for this tab
    if (typeof window === "undefined") return "demo";
    const key = "villa_agent_conversation_id";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = `demo-${uid()}`;
    window.localStorage.setItem(key, id);
    return id;
  }, []);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      parts: [{ type: "text", text: trimmed }],
      ts: Date.now(),
    };

    setMessages((m) => [...m, userMsg]);
    setText("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "web",
          sessionId: "web-demo",
          userId: "web-user-1",
          conversationId,
          parts: [{ type: "text", text: trimmed }],
        }),
      });

      const data = await res.json();

      const assistantText =
        data?.response?.parts?.find((p: any) => p.type === "text")?.text ??
        (data?.ok ? `Run started: ${data.runId}` : JSON.stringify(data));

      const botMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        parts: [{ type: "text", text: assistantText }],
        ts: Date.now(),
      };

      setMessages((m) => [...m, botMsg]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          parts: [{ type: "text", text: `Error: ${String(e?.message ?? e)}` }],
          ts: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <header className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Villa Agent — Local Test UI</h1>
          <div className="text-xs text-zinc-400">conversationId: {conversationId}</div>
        </header>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          {messages.length === 0 ? (
            <div className="text-sm text-zinc-400">
              Send a message. This UI calls <code className="text-zinc-200">/api/chat</code>, which proxies to the agent server.
            </div>
          ) : null}

          {messages.map((m) => {
            const textPart = m.parts.find((p) => p.type === "text") as any;
            return (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-blue-600/20 border border-blue-600/30" : "bg-emerald-600/10 border border-emerald-600/20"
                }`}
              >
                <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-400">{m.role}</div>
                <div className="whitespace-pre-wrap leading-5">{textPart?.text}</div>
              </div>
            );
          })}
        </section>

        <section className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <button
            onClick={send}
            disabled={isSending}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </section>

        <footer className="text-xs text-zinc-500">
          Next steps: make the agent server return a final response synchronously (or poll run status).
        </footer>
      </div>
    </main>
  );
}
