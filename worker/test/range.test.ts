import { describe, expect, it } from "vitest";
import { parseRange, serveRange } from "../src/range.ts";

describe("parseRange", () => {
  it("reads open, closed and suffix ranges", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });
  it("rejects ranges it can't meet", () => {
    expect(parseRange("bytes=100-", 100)).toBe("bad");
    expect(parseRange("bytes=20-10", 100)).toBe("bad");
    expect(parseRange("bytes=-", 100)).toBe("bad");
    expect(parseRange("items=0-1", 100)).toBe("bad");
  });
});

describe("serveRange", () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
  // A stand-in for ASSETS that serves the file in small chunks, as a stream would.
  const assets = {
    fetch: async () => new Response(new ReadableStream({
      start(c) { for (let i = 0; i < bytes.length; i += 64) c.enqueue(bytes.slice(i, i + 64)); c.close(); },
    }), { headers: { "content-length": String(bytes.length), "content-type": "video/mp4" } }),
  } as unknown as Fetcher;

  it("returns just the asked-for bytes as a 206", async () => {
    const res = await serveRange(new Request("https://x/video/a.mp4", { headers: { range: "bytes=100-299" } }), assets);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 100-299/1000");
    const got = new Uint8Array(await res.arrayBuffer());
    expect(got.length).toBe(200);
    expect(Array.from(got)).toEqual(Array.from(bytes.slice(100, 300)));
  });

  it("still ranges when the asset streams without a length", async () => {
    const noLength = { fetch: async () => new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice()); c.close(); } })) } as unknown as Fetcher;
    const res = await serveRange(new Request("https://x/video/a.mp4", { headers: { range: "bytes=-10" } }), noLength);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 990-999/1000");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(bytes.slice(990)));
  });

  it("serves the whole file without a range, and 416 for an impossible one", async () => {
    const full = await serveRange(new Request("https://x/video/a.mp4"), assets);
    expect(full.status).toBe(200);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect((await full.arrayBuffer()).byteLength).toBe(1000);
    const bad = await serveRange(new Request("https://x/video/a.mp4", { headers: { range: "bytes=5000-" } }), assets);
    expect(bad.status).toBe(416);
  });
});
