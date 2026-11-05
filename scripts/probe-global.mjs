#!/usr/bin/env node
// Measure /v1/search from other countries using check-host.net's public probes.
// Each query runs twice per node: a first pass that reaches D1, then a second that should hit the edge cache.
// The times include DNS, TCP and TLS, so they overstate what a page with a warm connection would see.
// Usage: node scripts/probe-global.mjs <baseUrl> <out.json>
import { writeFileSync } from "node:fs";
const [base, outFile] = process.argv.slice(2);
const QUERIES = ["gracia", "kirche", "calvar", "kosciol", "methodis", "eglise"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function check(url) {
  const res = await fetch(`https://check-host.net/check-http?host=${encodeURIComponent(url)}&max_nodes=12`, { headers: { accept: "application/json" } });
  const { request_id, nodes } = await res.json();
  await wait(9000);
  const result = await (await fetch(`https://check-host.net/check-result/${request_id}`, { headers: { accept: "application/json" } })).json();
  return Object.entries(result).map(([node, r]) => ({ node, country: nodes[node]?.[0], city: nodes[node]?.[1], s: r?.[0]?.[1], code: r?.[0]?.[3] }));
}
const byNode = {};
for (const q of QUERIES) {
  const url = `${base}/v1/search?geo=off&limit=8&q=${q}`;
  for (const pass of ["first", "second"]) {
    for (const r of await check(url)) {
      if (r.code !== "200" || typeof r.s !== "number") continue;
      const k = `${r.country} ${r.city}`;
      ((byNode[k] ??= { first: [], second: [] })[pass]).push(Math.round(r.s * 1000));
    }
    await wait(2000);
  }
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const rows = Object.entries(byNode).map(([node, v]) => ({ node, firstMedianMs: median(v.first), secondMedianMs: median(v.second), n: v.first.length })).sort((a, b) => a.node < b.node ? -1 : 1);
console.table(rows);
writeFileSync(outFile, JSON.stringify(rows, null, 1) + "\n");
