#!/usr/bin/env node
// Rewrite the search index through the Worker's admin route, by rowid range, with a checkpoint file so
// an interrupted run resumes where it stopped. Writes share D1 with live searches: run it off-peak and
// keep concurrency low. Re-run at the end to pick up rows sync appended meanwhile.
// The admin key is read from a file and never logged.
// Usage: node scripts/reindex-fts.mjs <checkpointFile> [concurrency]
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [checkpoint, concArg = "2"] = process.argv.slice(2);
if (!checkpoint) { console.error("usage: node scripts/reindex-fts.mjs <checkpointFile> [concurrency]"); process.exit(1); }
const BASE = process.env.LOOKUP_URL ?? "https://lookup.heresmychurch.com";
const key = process.env.LOOKUP_ADMIN_KEY ?? readFileSync(`${process.env.HOME}/.config/heresmychurch/lookup-admin-key`, "utf8").trim();
const STEP = 500;

async function call(from) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/internal/reindex`, { method: "POST", headers: { "x-admin-key": key, "content-type": "application/json" }, body: JSON.stringify({ from, to: from + STEP }) });
      const body = await res.json();
      if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 200)}`);
      return body;
    } catch (e) {
      console.error("retry", from, attempt, String(e).slice(0, 160));
      if (attempt >= 6) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

// The first range tells us how far the table goes.
const done = new Set(existsSync(checkpoint) ? readFileSync(checkpoint, "utf8").split("\n").filter(Boolean).map(Number) : []);
const first = await call(1);
appendFileSync(checkpoint, "1\n");
done.add(1);
const max = first.maxRowid ?? 0;
const todo = [];
for (let from = 1; from <= max; from += STEP) if (!done.has(from)) todo.push(from);
console.log(`max rowid ${max}: ${done.size} ranges done, ${todo.length} to go`);
let next = 0, rows = first.rows, finished = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: Number(concArg) }, async () => {
  while (next < todo.length) {
    const from = todo[next++];
    // Await first: `rows += await …` reads rows before the wait and loses the other worker's updates.
    const body = await call(from);
    rows += body.rows;
    appendFileSync(checkpoint, `${from}\n`);
    if (++finished % 50 === 0) console.log(`${finished}/${todo.length} ranges, ${rows} rows, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}));
console.log(`done: ${rows} rows rewritten in ${((Date.now() - t0) / 1000).toFixed(0)}s. Check: SELECT (SELECT count(*) FROM church), (SELECT count(*) FROM church_fts)`);
