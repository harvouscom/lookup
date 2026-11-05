#!/usr/bin/env node
// Score a search system on eval/golden.jsonl.
//   node eval/run.mjs lookup [--split dev|test|gate|all] [--verbose]
//   node eval/run.mjs lookup-hybrid  (settled queries, so semantic search may run)
//   node eval/run.mjs today        (production search without state)
//   node eval/run.mjs today-state  (production search, told the right state: an oracle it wouldn't normally have)
// Results go to eval/results/runs/<system>.jsonl. `today` runs resume from that file, since they can take 30 s per query.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const system = args[0];
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] ?? true : d; };
const split = flag("split", "all");
const verbose = args.includes("--verbose");
const LOOKUP = process.env.LOOKUP_URL ?? "https://lookup.heresmychurch.com";
const TODAY = "https://api.heresmychurch.com/churches/search";
const TIMEOUT_MS = 60000;
const golden = readFileSync("eval/golden.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const OUT_DIR = "eval/results/runs";
mkdirSync(OUT_DIR, { recursive: true });
const outFile = `${OUT_DIR}/${system}.jsonl`;

const fold = (s) => (s ?? "").toLowerCase().replace(/ł/g, "l").replace(/ß/g, "ss").normalize("NFD").replace(/\p{M}/gu, "");
const km = (a, lat, lng) => { const x = (lng - a.lng) * Math.cos(((a.lat + lat) / 2) * Math.PI / 180), y = lat - a.lat; return Math.sqrt(x * x + y * y) * 111.32; };

/** Is this result relevant? Generated queries name acceptable ids; hand-written ones state a rule. */
function relevant(g, r) {
  if (g.accept) return g.accept.includes(r.id);
  const w = g.want;
  const name = fold(r.name);
  const any = fold(`${r.name} ${r.denomination ?? ""}`);
  if (w.nameAll && !w.nameAll.every((t) => name.includes(fold(t)))) return false;
  if (w.nameAny && !w.nameAny.some((t) => name.includes(fold(t)))) return false;
  if (w.anyField && !w.anyField.some((t) => any.includes(fold(t)))) return false;
  if (w.region && r.region !== w.region && r.state !== w.region) return false;
  if (w.country && r.country !== w.country) return false;
  if (w.near) {
    const lat = r.latitude ?? r.lat, lng = r.longitude ?? r.lng;
    if (lat == null || km(w.near, lat, lng) > w.near.km) return false;
  }
  return true;
}

function request(g) {
  if (system.startsWith("lookup")) {
    const u = new URL(`${LOOKUP}/v1/search`);
    if (system === "lookup-hybrid") u.searchParams.set("settled", "1");
    u.searchParams.set("q", g.q);
    u.searchParams.set("limit", "20");
    if (g.near) u.searchParams.set("near", g.near);
    if (g.loc) { u.searchParams.set("lat", g.loc.lat); u.searchParams.set("lng", g.loc.lng); } else u.searchParams.set("geo", "off");
    return u;
  }
  const u = new URL(TODAY);
  u.searchParams.set("q", g.near ? `${g.q} ${g.near}` : g.q);
  if (system === "today-state") {
    const state = g.region ?? g.want?.region;
    if (!state) return null;
    u.searchParams.set("state", state);
  }
  return u;
}

const prior = new Map();
const isLookup = system.startsWith("lookup");
if (!isLookup && existsSync(outFile)) for (const l of readFileSync(outFile, "utf8").split("\n").filter(Boolean)) { const o = JSON.parse(l); prior.set(o.id, o); }
if (isLookup) writeFileSync(outFile, "");

const rows = [];
for (const g of golden) {
  if (split !== "all" && g.split !== split) continue;
  let row = prior.get(g.id);
  if (!row) {
    const url = request(g);
    if (!url) { rows.push({ id: g.id, skipped: true }); continue; }
    const t0 = performance.now();
    let status = 0, results = [], cache = null, corrected = null, semantic = null, tries = 0;
    for (;;) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        status = res.status; cache = res.headers.get("x-lookup-cache");
        const body = await res.json().catch(() => ({}));
        results = body.results ?? []; corrected = body.corrected ?? null; semantic = body.semantic ?? null;
      } catch {
        status = 0; results = []; // Timed out: counted as an error, not retried.
        break;
      }
      if (status !== 429 && status !== 503 || ++tries > 4) break;
      await new Promise((r) => setTimeout(r, 15000));
    }
    const ms = Math.round(performance.now() - t0);
    const ranks = results.map((r, i) => (relevant(g, r) ? i + 1 : 0)).filter(Boolean);
    row = { id: g.id, class: g.class, split: g.split, status, ms, cache, count: results.length, firstRelevant: ranks[0] ?? null, corrected, semantic, semanticHits: results.filter((r) => r.source === "semantic").length, firstRelevantSource: results.find((r) => relevant(g, r))?.source ?? null, top: results.slice(0, 3).map((r) => r.name) };
    appendFileSync(outFile, JSON.stringify(row) + "\n");
    // The hybrid run stays under the per-IP semantic limit of 30 a minute, so it measures semantic search rather than the limiter.
    await new Promise((r) => setTimeout(r, system === "lookup-hybrid" ? 2100 : isLookup ? 550 : 500));
  }
  row = { ...row, hasLocation: Boolean(g.loc), nameCommonness: g.nameCommonness ?? null };
  rows.push(row);
  if (verbose && row.firstRelevant !== 1) console.log(`${String(row.firstRelevant ?? "-").padStart(3)} ${row.id.padEnd(26)} ${JSON.stringify(g.q).padEnd(44)} n=${row.count} ${row.corrected ? "fix=" + row.corrected + " " : ""}${(row.top ?? []).join(" | ").slice(0, 90)}`);
}

const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function summarize(list) {
  const r = list.filter((x) => !x.skipped);
  if (!r.length) return null;
  const m = r.filter((x) => x.cache !== "hit").map((x) => x.ms);
  return {
    n: r.length,
    top1: +(r.filter((x) => x.firstRelevant === 1).length / r.length).toFixed(3),
    top5: +(r.filter((x) => x.firstRelevant && x.firstRelevant <= 5).length / r.length).toFixed(3),
    mrr: +(r.reduce((s, x) => s + (x.firstRelevant ? 1 / x.firstRelevant : 0), 0) / r.length).toFixed(3),
    zero: +(r.filter((x) => x.count === 0).length / r.length).toFixed(3),
    errors: r.filter((x) => x.status !== 200).length,
    p50: pct(m, 0.5),
    p95: pct(m, 0.95),
  };
}
const classes = [...new Set(rows.map((r) => r.class).filter(Boolean))];
// A common name with no location can't be resolved by any search: nothing says which one was meant.
const unresolvable = (r) => r.nameCommonness === "common" && !r.hasLocation && r.class !== "name-and-place";
const report = { system, split, overall: summarize(rows), resolvable: summarize(rows.filter((r) => !unresolvable(r))), commonNameNoLocation: summarize(rows.filter(unresolvable)), byClass: Object.fromEntries(classes.map((c) => [c, summarize(rows.filter((r) => r.class === c))])) };
console.log("overall", JSON.stringify(report.overall));
console.log("resolvable", JSON.stringify(report.resolvable));
console.log("common name, no location", JSON.stringify(report.commonNameNoLocation));
console.table(report.byClass);
writeFileSync(`${OUT_DIR}/${system}-${split}.summary.json`, JSON.stringify(report, null, 1) + "\n");
