#!/usr/bin/env node
// Compare stored runs on the same queries. Usage: node eval/compare.mjs
import { readFileSync } from "node:fs";
const golden = readFileSync("eval/golden.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const load = (s) => new Map(readFileSync(`eval/results/runs/${s}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => { const o = JSON.parse(l); return [o.id, o]; }));
const runs = { today: load("today"), "today-state": load("today-state"), lookup: load("lookup"), "lookup-hybrid": load("lookup-hybrid") };
const pct = (a, p) => { if (!a.length) return "-"; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const sum = (run, qs) => {
  const r = qs.map((g) => run.get(g.id)).filter(Boolean);
  if (!r.length) return { n: 0 };
  const f = (x) => +(x / r.length).toFixed(3);
  const m = r.filter((x) => x.cache !== "hit" && x.status === 200).map((x) => x.ms);
  return { n: r.length, top1: f(r.filter((x) => x.firstRelevant === 1).length), top5: f(r.filter((x) => x.firstRelevant && x.firstRelevant <= 5).length), mrr: f(r.reduce((s, x) => s + (x.firstRelevant ? 1 / x.firstRelevant : 0), 0)), zero: f(r.filter((x) => x.count === 0).length), err: r.filter((x) => x.status !== 200).length, p50: pct(m, 0.5), p95: pct(m, 0.95) };
};
const groups = { "test (held out)": golden.filter((g) => g.split === "test"), "dev (tuned on)": golden.filter((g) => g.split === "dev"), gate: golden.filter((g) => g.split === "gate") };
for (const c of [...new Set(golden.map((g) => g.class))]) groups[`test+dev: ${c}`] = golden.filter((g) => g.class === c);
groups["test: location given"] = golden.filter((g) => g.split === "test" && g.loc);
groups["test: common name, no location"] = golden.filter((g) => g.split === "test" && g.nameCommonness === "common" && !g.loc && g.class !== "name-and-place");
groups["test: only queries with a known state, where today-state can run"] = golden.filter((g) => g.split === "test" && runs["today-state"].has(g.id));
for (const [name, qs] of Object.entries(groups)) {
  console.log(`\n${name}`);
  for (const [s, run] of Object.entries(runs)) console.log(" ", s.padEnd(12), JSON.stringify(sum(run, qs)));
}
