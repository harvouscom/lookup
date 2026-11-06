// Ask AI for the docs: POST /v1/ask answers a question from the docs, streamed as server-sent events.
// The whole docs (llms-full.txt, about 6k tokens) go in the prompt, so there's no retrieval step.
// Questions are never stored or logged.

export const ASK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const MAX_QUESTION = 500;

export interface AskEnv {
  AI?: Ai;
  ASSETS?: Fetcher;
  RL_ASK?: RateLimit;
  /** Kill switch. Anything but "true" turns Ask AI off. */
  ASK_ENABLED?: string;
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" };
const reply = (status: number, error: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...headers } });

// Docs change only on deploy, so one copy per isolate is enough.
let docs: Promise<string | null> | null = null;
export function resetDocsCache() { docs = null; }
function loadDocs(env: AskEnv, origin: string): Promise<string | null> {
  docs ??= (async () => {
    if (!env.ASSETS) return null;
    const res = await env.ASSETS.fetch(new Request(`${origin}/llms-full.txt`));
    return res.ok ? await res.text() : null;
  })().catch(() => null);
  return docs.then((d) => { if (!d) docs = null; return d; });
}

export function systemPrompt(text: string): string {
  return `You answer developer questions about Lookup, a church search box and autofill SDK by Here's My Church.
Answer only from the documentation below. If the docs don't cover it, say you don't know and point to the closest page.
- Be brief: a short answer first, then a minimal code example only if it helps.
- Use only attributes, events, fields and endpoints that appear in the docs. Never invent options.
- Cite the pages you used as paths like /docs/widget or /docs/widget#events (the docs list each page's Source URL).
- Format with plain Markdown: short paragraphs, lists, \`code\` and fenced code blocks.

<docs>
${text}
</docs>`;
}

export async function ask(request: Request, env: AskEnv): Promise<Response> {
  if (env.ASK_ENABLED !== "true" || !env.AI) return reply(503, "Ask AI is off right now. Search the docs instead.");
  if (env.RL_ASK) {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.RL_ASK.limit({ key: ip });
    if (!success) return reply(429, "That’s a lot of questions. Try again in a minute.", { "retry-after": "60" });
  }
  let input: unknown;
  try { input = await request.json(); } catch { return reply(400, "Send JSON like { \"question\": \"…\" }."); }
  const { question, page } = (input ?? {}) as { question?: unknown; page?: unknown };
  if (typeof question !== "string" || !question.trim()) return reply(400, "Ask a question.");
  if (question.length > MAX_QUESTION) return reply(400, `Keep questions under ${MAX_QUESTION} characters.`);
  const text = await loadDocs(env, new URL(request.url).origin);
  if (!text) return reply(503, "The docs couldn’t be loaded. Try again shortly.");
  const where = typeof page === "string" && /^[a-z-]{1,40}$/.test(page) ? `\n\n(I'm reading ${page === "index" ? "/docs" : `/docs/${page}`}.)` : "";
  try {
    const stream = await env.AI.run(ASK_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        { role: "system", content: systemPrompt(text) },
        { role: "user", content: question.trim() + where },
      ],
      stream: true,
      max_tokens: 700,
      temperature: 0.2,
    } as never) as unknown as ReadableStream;
    return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", ...CORS } });
  } catch {
    return reply(503, "Ask AI is busy right now. Try again shortly.", { "retry-after": "5" });
  }
}
