#!/usr/bin/env node
// Generate eval/golden.jsonl: seeded queries from the moderated export, plus eval/golden-hand.jsonl.
// The split is by hash of the query id, so adding queries doesn't move existing ones.
// Usage: node scripts/generate-golden.mjs <exportDir>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const exportDir = process.argv[2];
const SEED = 20261105;
let state = SEED;
const rand = () => { state |= 0; state = (state + 0x6d2b79f5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];

const fold = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/ß/g, "ss");
const km = (a, b) => { const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180), y = b.lat - a.lat; return Math.sqrt(x * x + y * y) * 111.32; };
const score = (c) => (c.address ? 20 : 0) + (c.city ? 10 : 0) + (c.website ? 15 : 0) + (c.phone ? 15 : 0) + (c.serviceTimes ? 25 : 0) + (c.denomination && c.denomination !== "Unknown" ? 5 : 0);

const rows = [];
for (const f of readdirSync(exportDir).filter((n) => n.includes("__")).sort()) {
  const [cc, region] = f.replace(".json", "").split("__");
  for (const c of JSON.parse(readFileSync(`${exportDir}/${f}`, "utf8")).churches) {
    if (!c.name?.trim() || /^(unnamed|unknown)\b/i.test(c.name.trim())) continue;
    rows.push({ id: c.id, name: c.name.trim(), city: c.city, lat: c.lat, lng: c.lng, cc, region, score: score(c) });
  }
}
rows.sort((a, b) => (a.id < b.id ? -1 : 1));
const nameCount = new Map();
const byName = new Map();
for (const r of rows) { const k = fold(r.name); nameCount.set(k, (nameCount.get(k) ?? 0) + 1); (byName.get(k) ?? byName.set(k, []).get(k)).push(r); }

// Stratify by country, completeness and name commonness.
const COUNTRIES = [...new Set(rows.map((r) => r.cc))].sort();
const strata = new Map();
for (const r of rows) {
  const comp = r.score >= 50 ? "high" : r.score >= 15 ? "mid" : "low";
  const common = nameCount.get(fold(r.name)) >= 5 ? "common" : "rare";
  const key = `${r.cc}|${comp}|${common}`;
  (strata.get(key) ?? strata.set(key, []).get(key)).push(r);
}
function sample(n) {
  const out = [], seen = new Set();
  while (out.length < n) {
    const cc = pick(COUNTRIES), comp = pick(["high", "mid", "low"]), common = pick(["common", "rare"]);
    const list = strata.get(`${cc}|${comp}|${common}`);
    if (!list) continue;
    const r = pick(list);
    if (seen.has(r.id) || r.name.length < 6) continue;
    seen.add(r.id); out.push({ ...r, comp, common });
  }
  return out;
}

function typo(name) {
  const words = name.split(" ");
  const idx = words.map((w, i) => [w.length, i]).sort((a, b) => b[0] - a[0])[0][1];
  const w = words[idx];
  if (w.length < 5) return null;
  const at = 1 + Math.floor(rand() * (w.length - 2));
  const kind = pick(["delete", "swap", "double", "sub"]);
  const mut = kind === "delete" ? w.slice(0, at) + w.slice(at + 1)
    : kind === "swap" ? w.slice(0, at) + w[at + 1] + w[at] + w.slice(at + 2)
    : kind === "double" ? w.slice(0, at) + w[at] + w.slice(at)
    : w.slice(0, at) + pick("aeiou".split("").filter((v) => v !== w[at])) + w.slice(at + 1);
  if (mut === w) return null;
  words[idx] = mut;
  return words.join(" ");
}

const out = [];
const add = (id, q, cls, r, useLoc) => {
  const twins = byName.get(fold(r.name)).filter((t) => km(t, r) <= 2).map((t) => t.id);
  out.push({
    id, q, class: cls, country: r.cc, region: r.region, completeness: r.comp, nameCommonness: r.common,
    ...(useLoc ? { loc: { lat: +(r.lat + (rand() - 0.5) * 0.3).toFixed(2), lng: +(r.lng + (rand() - 0.5) * 0.3).toFixed(2) } } : {}),
    accept: twins,
  });
};
sample(30).forEach((r, i) => add(`gen-full-${i}`, r.name, "full-name", r, i % 2 === 0));
sample(30).forEach((r, i) => {
  const cut = Math.max(4, Math.min(r.name.length - 1, Math.round(r.name.length * (0.4 + rand() * 0.4))));
  add(`gen-prefix-${i}`, r.name.slice(0, cut).trimEnd(), "typeahead", r, i % 2 === 0);
});
let t = 0;
for (const r of sample(60)) {
  if (t >= 30) break;
  const q = typo(r.name);
  if (q) add(`gen-typo-${t}`, q, "typo", r, t++ % 2 === 0);
}
const withCity = sample(400).filter((r) => r.city).slice(0, 30);
withCity.forEach((r, i) => add(`gen-city-${i}`, i % 2 ? `${r.name}, ${r.city}` : `${r.name} ${r.city}`, "name-and-place", r, false));

writeFileSync("eval/golden-generated.jsonl", out.map((o) => JSON.stringify(o)).join("\n") + "\n");
console.log("generated", out.length, Object.entries(out.reduce((a, o) => ({ ...a, [o.class]: (a[o.class] ?? 0) + 1 }), {})));
