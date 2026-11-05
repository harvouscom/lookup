#!/usr/bin/env node
// Merge generated and hand-written queries into eval/golden.jsonl and assign the 60/40 split.
import { readFileSync, writeFileSync } from "node:fs";
const lines = (f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0) % 100; };
const all = [...lines("eval/golden-generated.jsonl"), ...lines("eval/golden-hand.jsonl")]
  // Must-work queries are checked as a release gate, so they sit outside the split.
  .map((o) => ({ ...o, split: o.class === "must-work" ? "gate" : hash(o.id) < 60 ? "dev" : "test" }));
const ids = new Set();
for (const o of all) { if (ids.has(o.id)) throw new Error(`duplicate ${o.id}`); ids.add(o.id); }
writeFileSync("eval/golden.jsonl", all.map((o) => JSON.stringify(o)).join("\n") + "\n");
const count = (k) => all.reduce((a, o) => ({ ...a, [o[k]]: (a[o[k]] ?? 0) + 1 }), {});
console.log(all.length, count("split"), count("class"));
