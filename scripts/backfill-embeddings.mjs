#!/usr/bin/env node
// Embed the whole corpus through the Worker's admin route, by rowid range, with a checkpoint file
// so an interrupted run resumes where it stopped. The admin key is read from a file and never logged.
// Usage: node scripts/backfill-embeddings.mjs <checkpointFile> [maxRowid] [concurrency]
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [checkpoint, maxArg = "587842", concArg = "16"] = process.argv.slice(2);
const BASE = process.env.LOOKUP_URL ?? "https://lookup.heresmychurch.com";
const key = process.env.LOOKUP_ADMIN_KEY ?? readFileSync(`${process.env.HOME}/.config/heresmychurch/lookup-admin-key`, "utf8").trim();
const STEP = 500;
const max = Number(maxArg);
const done = new Set(existsSync(checkpoint) ? readFileSync(checkpoint, "utf8").split("\n").filter(Boolean).map(Number) : []);
const todo = [];
for (let from = 1; from <= max; from += STEP) if (!done.has(from)) todo.push(from);
console.log(`${done.size} ranges done, ${todo.length} to go`);
let next = 0, embedded = 0, finished = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: Number(concArg) }, async () => {
  while (next < todo.length) {
    const from = todo[next++];
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${BASE}/internal/embed`, { method: "POST", headers: { "x-admin-key": key, "content-type": "application/json" }, body: JSON.stringify({ from, to: Math.min(from + STEP, max + 1) }) });
        const body = await res.json();
        if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 200)}`);
        embedded += body.embedded;
        appendFileSync(checkpoint, `${from}\n`);
        break;
      } catch (e) {
        console.error("retry", from, attempt, String(e).slice(0, 160));
        if (attempt >= 5) { console.error("giving up on", from); break; }
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      }
    }
    if (++finished % 50 === 0) console.log(`${finished}/${todo.length} ranges, ${embedded} vectors, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
}));
console.log(`done: ${embedded} vectors in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
