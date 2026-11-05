// Concurrency test from one isolate. Pauses between steps so the overload window clears.
import { threeRungs } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const { SPIKE_URL, SPIKE_KEY } = process.env;
const post = async (p, b) => (await fetch(SPIKE_URL + p, { method: "POST", headers: { "x-spike-key": SPIKE_KEY }, body: JSON.stringify(b) })).json();
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const dallas = { lat: 32.7767, lng: -96.797, cc: "us" };
const out = [];
for (const q of ["grace", "grace c"]) for (const c of [1, 10, 25, 50, 75, 100, 150]) {
  const r = await post("/burst", { stmts: threeRungs(q, dallas, process.env.SPIKE_TABLE ? { table: process.env.SPIKE_TABLE, fold: true } : {}), concurrency: c, rounds: 3 });
  if (r.error) { console.log(q, c, "ERROR", r.error); out.push({ q, c, error: r.error }); await new Promise((x) => setTimeout(x, 30000)); break; }
  const wall = r.out.flatMap((o) => o.wall), total = r.out.map((o) => o.totalMs);
  const row = { q, c, batchesPerSec: Math.round(c / (pct(total, 0.5) / 1000)), p50: pct(wall, 0.5), p95: pct(wall, 0.95), max: Math.max(...wall) };
  out.push(row); console.log(JSON.stringify(row));
  await new Promise((x) => setTimeout(x, 15000));
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + "\n");
