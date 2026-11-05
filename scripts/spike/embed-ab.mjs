#!/usr/bin/env node
// A/B: bge-m3 over TX, brute-force cosine in memory. Arms: A name only; C name + place; B name + denomination + place (section 2 text).
// Relevance is a predicate per query, scored in two modes:
//   raw    = the full query text is embedded, no location filter
//   parsed = the place is removed from the query and candidates are limited to 50 km, as the section 2 parser would
// Usage: SPIKE_URL=... SPIKE_KEY=... node embed-ab.mjs <rows.json> <cacheDir> <out.json>
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [rowsFile, cacheDir, outFile] = process.argv.slice(2);
const { SPIKE_URL, SPIKE_KEY } = process.env;
const tx = JSON.parse(readFileSync(rowsFile, "utf8")).filter((r) => r.state === "TX");
const DIM = 1024;
const textA = (r) => r.name;
const textB = (r) => {
  const denom = r.denomination && r.denomination !== "Unknown" ? `${r.denomination}. ` : "";
  const place = r.city ? `${r.city}, ` : r.near ? `near ${r.near}, ` : "";
  return `${r.name}. ${denom}${place}Texas, United States.`;
};
const textC = (r) => {
  const place = r.city ? `${r.city}, ` : r.near ? `near ${r.near}, ` : "";
  return `${r.name}. ${place}Texas, United States.`;
};
async function embed(text) {
  for (let i = 0; ; i++) {
    const res = await fetch(SPIKE_URL + "/embed", { method: "POST", headers: { "x-spike-key": SPIKE_KEY }, body: JSON.stringify({ text }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.raw?.data) return j.raw;
    if (i >= 6) throw new Error(JSON.stringify(j).slice(0, 300));
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
}
const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s); return Float32Array.from(v, (x) => x / s); };
let tokens = { A: 0, B: 0, C: 0 };
async function corpus(name, fn) {
  const file = `${cacheDir}/ab-${name}.f32`;
  if (existsSync(file)) { const b = readFileSync(file); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); }
  const out = new Float32Array(tx.length * DIM);
  const batches = []; for (let i = 0; i < tx.length; i += 50) batches.push(i);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < batches.length) {
      const i = batches[next++];
      const raw = await embed(tx.slice(i, i + 50).map(fn));
      tokens[name] += raw.meta?.cost_metric_value_1 ?? 0;
      raw.data.forEach((v, k) => { if (v.length !== DIM) throw new Error("dim " + v.length); out.set(norm(v), (i + k) * DIM); });
      if (++done % 50 === 0) console.error(name, done, "/", batches.length);
    }
  }));
  writeFileSync(file, Buffer.from(out.buffer));
  return out;
}
const km = (aLat, aLng, bLat, bLng) => { const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180), y = bLat - aLat; return Math.sqrt(x * x + y * y) * 111.32; };
const C = { dallas: [32.7767, -96.797], houston: [29.7604, -95.3698], austin: [30.2672, -97.7431], sanantonio: [29.4241, -98.4936], elpaso: [31.7619, -106.485], fortworth: [32.7555, -97.3308], lubbock: [33.5779, -101.8552], amarillo: [35.222, -101.8313], waco: [31.5493, -97.1467], plano: [33.0198, -96.6989], corpus: [27.8006, -97.3964] };
const hay = (r) => `${r.name} ${r.denomination ?? ""}`.toLowerCase();
const has = (...w) => (r) => w.some((x) => hay(r).includes(x));
// [full query, query without place, place, predicate on the church itself]
const Q = [
  ["catholic church in austin", "catholic church", "austin", has("catholic")],
  ["presbyterian church lubbock", "presbyterian church", "lubbock", has("presbyterian")],
  ["methodist church in waco", "methodist church", "waco", has("methodist")],
  ["episcopal church san antonio", "episcopal church", "sanantonio", has("episcopal")],
  ["church of christ amarillo", "church of christ", "amarillo", has("church of christ")],
  ["first baptist fort worth", "first baptist", "fortworth", has("first baptist")],
  ["seventh day adventist austin", "seventh day adventist", "austin", has("adventist")],
  ["lutheran church near plano", "lutheran church", "plano", has("lutheran")],
  ["mormon church el paso", "mormon church", "elpaso", has("latter", "lds")],
  ["jehovahs witnesses corpus christi", "jehovahs witnesses", "corpus", has("jehovah", "kingdom hall")],
  ["iglesia bautista dallas", "iglesia bautista", "dallas", has("iglesia bautista", "bautista")],
  ["spanish speaking church san antonio", "spanish speaking church", "sanantonio", has("iglesia", "templo", "hispan", "spanish", "bautista")],
  ["korean church dallas", "korean church", "dallas", has("korean")],
  ["vietnamese catholic houston", "vietnamese catholic", "houston", has("vietnam", "viet")],
  ["chinese church houston", "chinese church", "houston", has("chinese")],
  ["greek orthodox houston", "greek orthodox", "houston", has("greek orthodox", "orthodox")],
  ["pentecostal church dallas", "pentecostal church", "dallas", has("pentecost", "assembly of god", "assemblies of god")],
  ["cowboy church fort worth", "cowboy church", "fortworth", has("cowboy")],
  ["non denominational church plano", "non denominational church", "plano", has("non-denom", "nondenom", "community", "fellowship")],
  ["grace comunity church dallas", "grace comunity church", "dallas", has("grace comm")],
];
function search(vecs, q, candidates) {
  const scored = [];
  for (const i of candidates) {
    let s = 0; const off = i * DIM;
    for (let d = 0; d < DIM; d++) s += vecs[off + d] * q[d];
    scored.push([s, i]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 10).map((x) => x[1]);
}
const A = await corpus("A", textA), B = await corpus("B", textB), C2 = await corpus("C", textC);
const allIdx = tx.map((_, i) => i);
const qRaw = await embed(Q.map((q) => q[0])), qStripped = await embed(Q.map((q) => q[1]));
const report = { rows: tx.length, dim: qRaw.data[0].length, tokens, sampleB: textB(tx[100]).replace(tx[100].name, "<name>"), queries: [] };
const score = (idx, ok) => { const rel = idx.map(ok); const first = rel.indexOf(true); return { hit1: +rel[0], hit5: +rel.slice(0, 5).some(Boolean), p10: rel.filter(Boolean).length / 10, rr: first < 0 ? 0 : 1 / (first + 1) }; };
const agg = {};
const add = (k, s) => { const a = (agg[k] ??= { n: 0, hit1: 0, hit5: 0, p10: 0, mrr: 0 }); a.n++; a.hit1 += s.hit1; a.hit5 += s.hit5; a.p10 += s.p10; a.mrr += s.rr; };
Q.forEach(([full, stripped, place, pred], qi) => {
  const [lat, lng] = C[place];
  const near = (r) => km(r.lat, r.lng, lat, lng) <= 50;
  const both = (r) => pred(r) && near(r);
  const nearIdx = allIdx.filter((i) => near(tx[i]));
  const q = norm(qRaw.data[qi]), qs = norm(qStripped.data[qi]);
  const row = { q: full, relevantInTx: tx.filter(both).length, modes: {} };
  for (const [name, vecs] of [["A", A], ["B", B], ["C", C2]]) {
    const raw = score(search(vecs, q, allIdx).map((i) => tx[i]), both);
    const parsed = score(search(vecs, qs, nearIdx).map((i) => tx[i]), both);
    // Queries with no relevant church in the data can't discriminate, so they are reported but not aggregated.
    if (row.relevantInTx) { add(`${name}-raw`, raw); add(`${name}-parsed`, parsed); }
    row.modes[`${name}-raw`] = raw; row.modes[`${name}-parsed`] = parsed;
  }
  report.queries.push(row);
  console.log(full.padEnd(38), `rel ${String(row.relevantInTx).padStart(4)} | raw p10 A ${row.modes["A-raw"].p10} C ${row.modes["C-raw"].p10} B ${row.modes["B-raw"].p10} | parsed p10 A ${row.modes["A-parsed"].p10} C ${row.modes["C-parsed"].p10} B ${row.modes["B-parsed"].p10}`);
});
for (const a of Object.values(agg)) { for (const k of ["hit1", "hit5", "p10", "mrr"]) a[k] = +(a[k] / a.n).toFixed(3); }
report.aggregate = agg;
console.log(agg, tokens);
writeFileSync(outFile, JSON.stringify(report, null, 1) + "\n");
