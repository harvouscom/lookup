#!/usr/bin/env node
// Build D1 import files and a manifest from a moderated export directory.
// Never point this at the public R2 files: they contain unmoderated overlays.
// Usage: node scripts/build-index.ts <exportDir> <outDir>
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cellsAround, exclusionReason, geohash, project, tokenize, type ExportChurch, type ProjectedChurch } from "../worker/src/project.ts";
import { deletions1, MIN_TYPO_LENGTH } from "../worker/src/vocab.ts";
import { COUNTRIES, REGIONS } from "../worker/src/regions.generated.ts";

const [exportDir, outDir] = process.argv.slice(2) as [string, string];
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const NEAR_KM = 30;
const MAX_STATEMENT_BYTES = 90_000;
const ROWS_PER_FILE = 40_000;

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180), y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111.32;
};

// ── Read and exclude ──
type Row = { raw: ExportChurch; region: string; near?: string };
const kept: Row[] = [];
const regionManifest: Record<string, { cc: string; source: number; kept: number; excluded: Record<string, number> }> = {};
const movedRows: [string, string][] = [];
const exclusions: Record<string, number> = {};
for (const f of readdirSync(exportDir).filter((n) => n.includes("__")).sort()) {
  const body = JSON.parse(readFileSync(`${exportDir}/${f}`, "utf8"));
  const [cc, region] = f.replace(".json", "").split("__") as [string, string];
  if (body.count !== body.churches.length) throw new Error(`${f}: count ${body.count} != rows ${body.churches.length}`);
  if (!REGIONS[region]) throw new Error(`no region table entry for ${region}`);
  const m = (regionManifest[region] = { cc, source: body.churches.length, kept: 0, excluded: {} as Record<string, number> });
  for (const raw of body.churches as ExportChurch[]) {
    const why = exclusionReason(raw);
    if (why) {
      m.excluded[why] = (m.excluded[why] ?? 0) + 1;
      exclusions[why] = (exclusions[why] ?? 0) + 1;
      if (why === "relocated") movedRows.push([raw.id, raw.relocatedTo!]);
      continue;
    }
    m.kept++;
    kept.push({ raw, region });
  }
}

// ── Places ──
type Place = { key: string; name: string; region: string; country: string; lat: number; lng: number; n: number };
const placeMap = new Map<string, Place & { names: Map<string, number> }>();
for (const { raw, region } of kept) {
  const city = raw.city?.trim();
  if (!city) continue;
  const key = tokenize(city).join(" ");
  if (!key) continue;
  const id = `${key}|${region}`;
  const p = placeMap.get(id) ?? { key, name: city, region, country: raw.country, lat: 0, lng: 0, n: 0, names: new Map() };
  p.lat += raw.lat; p.lng += raw.lng; p.n++;
  p.names.set(city, (p.names.get(city) ?? 0) + 1);
  placeMap.set(id, p);
}
const placeBuckets = new Map<string, Place[]>();
for (const p of placeMap.values()) {
  p.lat /= p.n; p.lng /= p.n;
  p.name = [...p.names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  const b = geohash(p.lat, p.lng, 3);
  (placeBuckets.get(b) ?? placeBuckets.set(b, []).get(b)!).push(p);
}
for (const row of kept) {
  if (row.raw.city?.trim()) continue;
  let best: string | undefined, bestKm = NEAR_KM;
  for (const cell of cellsAround(row.raw.lat, row.raw.lng, 3)) {
    for (const p of placeBuckets.get(cell) ?? []) {
      const d = km(row.raw.lat, row.raw.lng, p.lat, p.lng);
      if (d < bestKm) { bestKm = d; best = p.name; }
    }
  }
  if (best) row.near = best;
}

// ── Project and assign rowids ──
const docs: ProjectedChurch[] = kept.map(({ raw, region, near }) => {
  const r = REGIONS[region]!;
  return project(raw, region, { regionName: r.n, countryName: COUNTRIES[raw.country] ?? raw.country }, near ?? null);
});
docs.sort((a, b) => b.completeness - a.completeness || (a.id < b.id ? -1 : 1));

// ── SQL helpers ──
const q = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "NULL" : String(v));
const list = (v: string[]) => (v.length ? q(JSON.stringify(v)) : "NULL");
function writeInserts(prefix: string, head: string, values: Iterable<string>, rowsPerFile = ROWS_PER_FILE) {
  let file = 0, rows = 0, total = 0, buf: string[] = [], stmt: string[] = [], stmtBytes = 0;
  const flushStmt = () => { if (stmt.length) buf.push(`${head} ${stmt.join(",")};`); stmt = []; stmtBytes = 0; };
  const flushFile = () => {
    flushStmt();
    if (buf.length) writeFileSync(`${outDir}/${prefix}-${String(file++).padStart(3, "0")}.sql`, buf.join("\n") + "\n");
    buf = []; rows = 0;
  };
  for (const v of values) {
    if (v.length > MAX_STATEMENT_BYTES - head.length) throw new Error(`row too large: ${v.slice(0, 80)}`);
    if (stmtBytes + v.length + 1 > MAX_STATEMENT_BYTES - head.length) flushStmt();
    stmt.push(v); stmtBytes += Buffer.byteLength(v) + 1; rows++; total++;
    if (rows >= rowsPerFile) flushFile();
  }
  flushFile();
  return total;
}

writeFileSync(`${outDir}/000-schema.sql`, readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
const counts: Record<string, number> = {};
counts.church = writeInserts("100-church",
  "INSERT INTO church (rowid,id,short_id,name,street,city,near,postal_code,region,country,lat,lng,phone,email,website,denomination,service_times,languages,ministries,pastor_name,last_verified,completeness,doc_hash,embed_hash) VALUES",
  docs.map((d, i) => `(${i + 1},${q(d.id)},${q(d.shortId)},${q(d.name)},${q(d.street)},${q(d.city)},${q(d.near)},${q(d.postalCode)},${q(d.region)},${q(d.country)},${n(d.lat)},${n(d.lng)},${q(d.phone)},${q(d.email)},${q(d.website)},${q(d.denomination)},${q(d.serviceTimes)},${list(d.languages)},${list(d.ministries)},${q(d.pastorName)},${n(d.lastVerified)},${d.completeness},${q(d.docHash)},${q(d.embedHash)})`));
counts.church_fts = writeInserts("200-fts", "INSERT INTO church_fts (rowid,name,loc,geo) VALUES",
  docs.map((d, i) => `(${i + 1},${q(tokenize(d.name).join(" "))},${q(tokenize(d.loc).join(" "))},${q(d.geo)})`));
const places = [...placeMap.values()].sort((a, b) => b.n - a.n);
counts.places = writeInserts("300-places", "INSERT INTO places (key,name,region,country,lat,lng,n) VALUES",
  places.map((p) => `(${q(p.key)},${q(p.name)},${q(p.region)},${q(p.country)},${p.lat.toFixed(5)},${p.lng.toFixed(5)},${p.n})`));

// ── Vocabulary ──
const df = new Map<string, number>();
for (const d of docs) for (const t of new Set(tokenize(d.name))) df.set(t, (df.get(t) ?? 0) + 1);
for (const p of places) for (const t of p.key.split(" ")) if (!df.has(t)) df.set(t, 1);
const vocab = [...df.entries()].filter(([t]) => !/^\d+$/.test(t)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
counts.vocab = writeInserts("400-vocab", "INSERT INTO vocab (id,token,df) VALUES", vocab.map(([t, c], i) => `(${i + 1},${q(t)},${c})`));
function* delRows() {
  for (let i = 0; i < vocab.length; i++) {
    const t = vocab[i]![0];
    if (t.length < MIN_TYPO_LENGTH) continue;
    for (const d of deletions1(t)) yield `(${q(d)},${i + 1})`;
    yield `(${q(t)},${i + 1})`;
  }
}
counts.vocab_del = writeInserts("500-vocabdel", "INSERT INTO vocab_del (del,id) VALUES", delRows(), 300_000);
counts.moved = writeInserts("600-moved", "INSERT INTO moved (id,moved_to) VALUES", movedRows.map(([a, b]) => `(${q(a)},${q(b)})`));

// ── Common words, for the ranker ──
const COMMON_MIN_DF = 3000;
const common = vocab.filter(([, c]) => c >= COMMON_MIN_DF).map(([t]) => t);
writeFileSync(new URL("../worker/src/common.generated.ts", import.meta.url),
  `// GENERATED by scripts/build-index.ts. Name tokens in at least ${COMMON_MIN_DF} listings.\nexport const COMMON_TOKENS: ReadonlySet<string> = new Set(${JSON.stringify(common)});\n`);

// ── Field fill, for /meta and honest reporting ──
const fill = { street: 0, city: 0, near: 0, postalCode: 0, website: 0, phone: 0, email: 0, serviceTimes: 0, denomination: 0, languages: 0, ministries: 0, pastorName: 0 };
let serviceTimesDropped = 0, streetBlanked = 0;
for (const d of docs) {
  for (const k of Object.keys(fill) as (keyof typeof fill)[]) { const v = d[k]; if (Array.isArray(v) ? v.length : v) fill[k]++; }
}
for (const { raw } of kept) {
  if (raw.serviceTimes && exclusionReason(raw) === null && !project(raw, "x", { regionName: "", countryName: "" }).serviceTimes) serviceTimesDropped++;
  if (raw.address && !project(raw, "x", { regionName: "", countryName: "" }).street) streetBlanked++;
}
const hist: Record<string, number> = {};
for (const d of docs) hist[d.completeness] = (hist[d.completeness] ?? 0) + 1;
const missing = JSON.parse(readFileSync(`${exportDir}/missing.json`, "utf8"));
const listed = JSON.parse(readFileSync(`${exportDir}/regions.json`, "utf8")).regions.length;
const source = Object.values(regionManifest).reduce((s, r) => s + r.source, 0);
const manifest = {
  builtAt: new Date().toISOString(),
  regionsListed: listed, regionsLoaded: Object.keys(regionManifest).length, regionsMissing: missing,
  source, kept: docs.length, exclusions,
  counts, fill, serviceTimesDropped, streetBlanked, completenessHistogram: hist,
  regions: regionManifest,
};
writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 1));
const metaRows = { counts: { churches: docs.length, regions: Object.keys(regionManifest).length, countries: new Set(docs.map((d) => d.country)).size }, fill, builtAt: manifest.builtAt };
writeFileSync(`${outDir}/700-meta.sql`, `INSERT INTO lookup_meta (key,value) VALUES ('build',${q(JSON.stringify(metaRows))});\n`);
const { regions: _omit, ...summary } = manifest;
console.log(JSON.stringify(summary, null, 1));
