#!/usr/bin/env node
// Snapshot production Here's My Church search responses so Lookup can be compared
// against the behavior that existed before any Lookup-related change was deployed.
// Usage: node scripts/snapshot-baseline.mjs [outDir]
import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.heresmychurch.com/churches/search";
const OUT = process.argv[2] ?? "eval/results/baseline-2026-11-05";

const QUERIES = [
  "grace", "grac", "gracee", "grace comm", "first bapt", "church in dallas",
  "first baptist", "first baptist dallas", "st mary", "saint mary",
  "st marys", "community church", "calvary", "calvary chapel", "dreifaltigkeit",
  "evangelische kirche", "parafia", "parafia swietego", "lakewood", "baptist",
];
const STATES = [null, "TX", "DEBY", "PLWP"];

await mkdir(OUT, { recursive: true });
const summary = [];
for (const q of QUERIES) {
  for (const state of STATES) {
    const url = new URL(API);
    url.searchParams.set("q", q);
    if (state) url.searchParams.set("state", state);
    const started = performance.now();
    const res = await fetch(url);
    const text = await res.text();
    const ms = Math.round(performance.now() - started);
    let body;
    try { body = JSON.parse(text); } catch { body = { unparsed: text.slice(0, 500) }; }
    const results = Array.isArray(body.results) ? body.results : [];
    const row = { q, state, status: res.status, ms, count: results.length };
    summary.push(row);
    const file = `${q.replace(/[^a-z0-9]+/gi, "-")}__${state ?? "all"}.json`;
    await writeFile(`${OUT}/${file}`, JSON.stringify({ url: url.href, capturedAt: new Date().toISOString(), ...row, body }, null, 1) + "\n");
    console.log(JSON.stringify(row));
    await new Promise((r) => setTimeout(r, 250));
  }
}
await writeFile(`${OUT}/summary.json`, JSON.stringify(summary, null, 1) + "\n");
