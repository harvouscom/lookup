#!/usr/bin/env node
// Local scale model with node:sqlite: replicate the spike rows up to about 588k by shifting
// coordinates, so doclists grow to corpus size. Same schema and queries as D1.
// Compare 1x vs 17x timings for a slowdown ratio. Replication keeps the vocabulary small,
// so common-word doclists are pessimistic. Prints metrics only.
// Usage: node --no-warnings scale-local.mjs <rows.json> <dbDir>
import { DatabaseSync } from "node:sqlite";
import { readFileSync, statSync, rmSync } from "node:fs";
import { threeRungs, geohash } from "./lib.mjs";

const [rowsFile, dbDir] = process.argv.slice(2);
const base = JSON.parse(readFileSync(rowsFile, "utf8"));
const LOCS = { dallas: { lat: 32.7767, lng: -96.797, cc: "us" }, munich: { lat: 48.1351, lng: 11.582, cc: "de" }, poznan: { lat: 52.4064, lng: 16.9252, cc: "pl" } };
const CASES = [["gr","dallas"],["grac","dallas"],["grace","dallas"],["grace c","dallas"],["grace co","dallas"],["grace comm","dallas"],["gracee","dallas"],["first bapt","dallas"],["first baptist","dallas"],["church","dallas"],["church c","dallas"],["baptist","dallas"],["st mary","dallas"],["zzqx","dallas"],["church catholic","dallas"],["baptist methodist","dallas"],["first second third","dallas"],["kirche","munich"],["evangelische kirche","munich"],["parafia sw","poznan"],["kościół pw","poznan"]];
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const results = {};
for (const copies of [1, 17]) {
  const file = `${dbDir}/scale-${copies}.db`;
  rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
    CREATE TABLE church (rowid INTEGER PRIMARY KEY, id TEXT, name TEXT, city TEXT, region TEXT, country TEXT, lat REAL, lng REAL, denomination TEXT, completeness INTEGER);
    CREATE VIRTUAL TABLE church_fts USING fts5(name, loc, geo, prefix='2 3 4 5', tokenize='unicode61 remove_diacritics 2');`);
  const ins = db.prepare("INSERT INTO church VALUES (?,?,?,?,?,?,?,?,?,?)");
  const insF = db.prepare("INSERT INTO church_fts (rowid,name,loc,geo) VALUES (?,?,?,?)");
  // Rowids stay in descending completeness order: rid = (base rid - 1) * copies + copy + 1.
  const order = [];
  for (const r of base) for (let k = 0; k < copies; k++) order.push([(r.rid - 1) * copies + k + 1, r, k]);
  order.sort((a, b) => a[0] - b[0]);
  db.exec("BEGIN");
  const t0 = Date.now();
  for (const [rid, r, k] of order) {
    const lat = k === 0 ? r.lat : ((r.lat + 80 + k * 2.3) % 160) - 80, lng = k === 0 ? r.lng : ((r.lng + 180 + k * 3.7) % 360) - 180;
    ins.run(rid, r.id + "#" + k, r.name, r.city || null, r.state, r.country, lat, lng, r.denomination || null, r.completeness);
    insF.run(rid, r.name, r.city || r.near || "", `g3${geohash(lat, lng, 3)} g4${geohash(lat, lng, 4)} cc${r.country.toLowerCase()} r${r.state.toLowerCase()}`);
  }
  db.exec("COMMIT");
  const bytes = statSync(file).size, buildS = (Date.now() - t0) / 1000;
  const n = db.prepare("SELECT count(*) c FROM church").get().c;
  console.log(`\n=== ${copies}x: ${n} rows, ${(bytes / 1e6).toFixed(0)} MB, built in ${buildS.toFixed(0)}s`);
  results[copies] = { rows: n, mb: Math.round(bytes / 1e6), cases: {} };
  for (const [q, where] of CASES) {
    const stmts = threeRungs(q, LOCS[where]).map((s) => ({ ...s, p: db.prepare(s.sql) }));
    const times = stmts.map(() => []);
    let rows = [];
    for (let i = 0; i < 41; i++) stmts.forEach((s, j) => {
      const a = performance.now(); const out = s.p.all(...s.params); const b = performance.now();
      if (i) times[j].push(b - a);
      rows[j] = out.length;
    });
    const p50 = times.map((t) => +pct(t, 0.5).toFixed(2)), max = times.map((t) => +Math.max(...t).toFixed(1));
    const totalP50 = +p50.reduce((a, b) => a + b, 0).toFixed(2);
    results[copies].cases[q] = { rows, p50, max, totalP50 };
    console.log(q.padEnd(22), `rows ${rows.join("/").padEnd(10)} p50 ${p50.join(" / ").padEnd(24)} total ${totalP50} ms`);
  }
  db.close();
}
const lines = ["query | 1x total p50 ms | 17x total p50 ms | ratio"];
for (const q of Object.keys(results[1].cases)) { const a = results[1].cases[q].totalP50, b = results[17].cases[q].totalP50; lines.push(`${q} | ${a} | ${b} | ${(b / a).toFixed(1)}`); }
console.log("\n" + lines.join("\n"));
console.log(JSON.stringify({ rows1: results[1].rows, mb1: results[1].mb, rows17: results[17].rows, mb17: results[17].mb }));
process.stdout.write("");
import("node:fs").then((fs) => fs.writeFileSync(process.env.SCALE_OUT ?? "/dev/null", JSON.stringify(results, null, 1) + "\n"));
