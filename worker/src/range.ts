// Byte ranges for the homepage video (/video/*). Static assets answer a Range request with the whole
// file, so browsers can't seek and Safari may not play at all. The Worker asks ASSETS for the file
// and streams back only the bytes asked for, as a 206.

/** Parses a single "bytes=a-b" range against a size. Null for no range, "bad" for one that can't be met. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "bad" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "bad";
  let start: number, end: number;
  if (m[1] === "") {
    // "bytes=-n": the last n bytes.
    const n = Number(m[2]);
    if (n === 0) return "bad";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "bad";
  return { start, end };
}

/** Keeps bytes start..end (inclusive) of a stream and drops the rest. */
function slice(body: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  let pos = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      const from = Math.max(0, start - pos), to = Math.min(chunk.length, end + 1 - pos);
      if (to > from) ctl.enqueue(chunk.subarray(from, to));
      pos += chunk.length;
    },
  }));
}

export async function serveRange(request: Request, assets: Fetcher): Promise<Response> {
  // Ask for the whole file, without the client's Range or conditional headers.
  const res = await assets.fetch(new Request(request.url, { method: "GET" }));
  if (!res.ok || !res.body) return res;
  const headers = new Headers(res.headers);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=86400");
  let body: ReadableStream<Uint8Array> = res.body;
  let size = Number(res.headers.get("content-length"));
  if (!(size > 0)) {
    // The asset can stream without a length; read it once to know its size (the video is ~21 MB).
    const buf = new Uint8Array(await res.arrayBuffer());
    size = buf.byteLength;
    body = new Response(buf).body!;
    headers.set("content-length", String(size));
  }
  const r = parseRange(request.headers.get("range"), size);
  if (r === "bad") {
    body.cancel();
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}`, "accept-ranges": "bytes" } });
  }
  if (request.method === "HEAD") { body.cancel(); return new Response(null, { status: 200, headers }); }
  if (!r) return new Response(body, { status: 200, headers });
  headers.set("content-range", `bytes ${r.start}-${r.end}/${size}`);
  headers.set("content-length", String(r.end - r.start + 1));
  return new Response(slice(body, r.start, r.end), { status: 206, headers });
}
