import { beforeEach, describe, expect, it } from "vitest";
import { ask, ASK_MODEL, MAX_QUESTION, resetDocsCache, type AskEnv } from "../src/ask.ts";

const DOCS = "# Lookup docs\n\n# The widget\nSource: https://lookup.heresmychurch.com/docs/widget\n\nUse `name` to submit the church ID.";

function stubs({ docs = DOCS, limited = false, aiThrows = false } = {}) {
  const calls: { model: string; input: any }[] = [];
  let assetFetches = 0;
  const env: AskEnv = {
    ASK_ENABLED: "true",
    AI: {
      run: async (model: string, input: unknown) => {
        if (aiThrows) throw new Error("capacity");
        calls.push({ model, input });
        return new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('data: {"response":"Use `name`. See /docs/widget"}\n\n'));
            c.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            c.close();
          },
        });
      },
    } as unknown as Ai,
    ASSETS: { fetch: async () => { assetFetches++; return docs ? new Response(docs) : new Response("nope", { status: 404 }); } } as unknown as Fetcher,
    RL_ASK: { limit: async () => ({ success: !limited }) } as unknown as RateLimit,
  };
  return { env, calls, fetches: () => assetFetches };
}
const post = (body: unknown) => new Request("https://lookup.heresmychurch.com/v1/ask", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" }, body: typeof body === "string" ? body : JSON.stringify(body) });

beforeEach(() => resetDocsCache());

describe("ask", () => {
  it("is off without the kill switch", async () => {
    const { env } = stubs();
    const res = await ask(post({ question: "hi" }), { ...env, ASK_ENABLED: undefined });
    expect(res.status).toBe(503);
  });
  it("rate limits per visitor", async () => {
    const { env, calls } = stubs({ limited: true });
    const res = await ask(post({ question: "How do I theme it?" }), env);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(calls).toHaveLength(0);
  });
  it("validates the question", async () => {
    const { env } = stubs();
    expect((await ask(post("not json"), env)).status).toBe(400);
    expect((await ask(post({ question: "   " }), env)).status).toBe(400);
    expect((await ask(post({ question: "x".repeat(MAX_QUESTION + 1) }), env)).status).toBe(400);
  });
  it("sends the docs as context and streams the answer", async () => {
    const { env, calls } = stubs();
    const res = await ask(post({ question: "How do I save the church ID?", page: "widget" }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.text()).toContain("/docs/widget");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe(ASK_MODEL);
    const [system, user] = calls[0]!.input.messages;
    expect(system.role).toBe("system");
    expect(system.content).toContain("Use `name` to submit the church ID.");
    expect(system.content).toMatch(/Never invent/);
    expect(user.content).toContain("How do I save the church ID?");
    expect(user.content).toContain("/docs/widget");
    expect(calls[0]!.input.stream).toBe(true);
  });
  it("ignores a page that isn't a docs slug", async () => {
    const { env, calls } = stubs();
    await ask(post({ question: "Hi", page: "../../etc" }), env);
    expect(calls[0]!.input.messages[1].content).toBe("Hi");
  });
  it("loads the docs once per isolate", async () => {
    const s = stubs();
    await ask(post({ question: "a" }), s.env);
    await ask(post({ question: "b" }), s.env);
    expect(s.fetches()).toBe(1);
  });
  it("says so when the docs or the model aren't available", async () => {
    expect((await ask(post({ question: "a" }), stubs({ docs: "" }).env)).status).toBe(503);
    resetDocsCache();
    expect((await ask(post({ question: "a" }), stubs({ aiThrows: true }).env)).status).toBe(503);
  });
  it("is routed at POST /v1/ask only", async () => {
    const { SELF } = await import("cloudflare:test");
    expect((await SELF.fetch("https://lookup.heresmychurch.com/v1/ask")).status).toBe(405);
    // No ASK_ENABLED or AI in the test Worker, so a POST says it's off rather than failing.
    expect((await SELF.fetch(post({ question: "hi" }))).status).toBe(503);
  });
});
