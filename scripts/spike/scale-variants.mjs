#!/usr/bin/env node
// 17x local model for candidate fixes. Tests extra prefix lengths and character folding.
// Usage: node --no-warnings scale-variants.mjs <rows.json> <dbDir> <out.json>
import { DatabaseSync } from "node:sqlite";
import { readFileSync, statSync, rmSync, writeFileSync } from "node:fs";
import { threeRungs, geohash } from "./lib.mjs";
const [rowsFile, dbDir, outFile] = process.argv.slice(2);
const base = JSON.parse(readFileSync(rowsFile, "utf8"));
const FOLD = { "ł": "l", "Ł": "L", "ß": "ss", "ø": "o", "Ø": "O", "đ": "d", "Đ": "D", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "ı": "i", "þ": "th", "ð": "d" };
const fold = (s) => s.replace(/[łŁßøØđĐæÆœŒıþð]/g, (c) => FOLD[c]);
const COPIES = 17;
const dallas = { lat: 32.7767, lng: -96.797, cc: "us" }, munich = { lat: 48.1351, lng: 11.582, cc: "de" }, poznan = { lat: 52.4064, lng: 16.9252, cc: "pl" };
const CASES = [["grace",dallas],["grace c",dallas],["grace co",dallas],["first bapt",dallas],["first baptist",dallas],["church",dallas],["church c",dallas],["baptist",dallas],["methodist",dallas],["community",dallas],["presbyterian",dallas],["church of christ",dallas],["baptist methodist",dallas],["kirche",munich],["evangelische",munich],["kosciol",poznan],["wroclaw",poznan]];
const VARIANTS = [
  { name: "A prefix 2-5 (section 2)", prefix: "2 3 4 5", fold: false },
  { name: "B prefix 2-5, folded", prefix: "2 3 4 5", fold: true },
  { name: "C prefix 2-8, folded", prefix: "2 3 4 5 6 7 8", fold: true },
  { name: "D prefix 1-5, folded", prefix: "1 2 3 4 5", fold: true },
  { name: "E prefix 1-8, folded", prefix: "1 2 3 4 5 6 7 8", fold: true },
  { name: "F prefix 2-5, folded, exact last token", prefix: "2 3 4 5", fold: true, exactLast: true },
];
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const out = [];
const order = [];
for (const r of base) for (let k = 0; k < COPIES; k++) order.push([(r.rid - 1) * COPIES + k + 1, r, k]);
order.sort((a, b) => a[0] - b[0]);
for (const v of VARIANTS) {
  const file = `${dbDir}/variant.db`; rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
    CREATE TABLE church (rowid INTEGER PRIMARY KEY, id TEXT, name TEXT, city TEXT, region TEXT, country TEXT, lat REAL, lng REAL, denomination TEXT, completeness INTEGER);
    CREATE VIRTUAL TABLE church_fts USING fts5(name, loc, geo, prefix='${v.prefix}', tokenize='unicode61 remove_diacritics 2');`);
  const ins = db.prepare("INSERT INTO church VALUES (?,?,?,?,?,?,?,?,?,?)"), insF = db.prepare("INSERT INTO church_fts (rowid,name,loc,geo) VALUES (?,?,?,?)");
  db.exec("BEGIN");
  const f = v.fold ? fold : (x) => x;
  for (const [rid, r, k] of order) {
    const lat = k === 0 ? r.lat : ((r.lat + 80 + k * 2.3) % 160) - 80, lng = k === 0 ? r.lng : ((r.lng + 180 + k * 3.7) % 360) - 180;
    ins.run(rid, r.id + "#" + k, r.name, r.city || null, r.state, r.country, lat, lng, r.denomination || null, r.completeness);
    insF.run(rid, f(r.name), f(r.city || r.near || ""), `g3${geohash(lat, lng, 3)} g4${geohash(lat, lng, 4)} cc${r.country.toLowerCase()} r${r.state.toLowerCase()}`);
  }
  db.exec("COMMIT"); db.exec("INSERT INTO church_fts(church_fts) VALUES('optimize')");
  const mb = Math.round(statSync(file).size / 1e6);
  const row = { name: v.name, mb, cases: {} };
  for (const [q, loc] of CASES) {
    const stmts = threeRungs(q, loc).map((s) => ({ ...s, params: v.exactLast ? [s.params[0].replace(/"\*(?= AND geo)/, '"')] : s.params })).map((s) => ({ ...s, p: db.prepare(s.sql) }));
    const times = stmts.map(() => []); let rows = [];
    for (let i = 0; i < 31; i++) stmts.forEach((s, j) => { const a = performance.now(); const o = s.p.all(...s.params); const b = performance.now(); if (i) times[j].push(b - a); rows[j] = o.length; });
    row.cases[q] = { rows: rows.join("/"), ms: +times.reduce((a, t) => a + pct(t, 0.5), 0).toFixed(1) };
  }
  out.push(row);
  console.log(`\n${v.name}: ${mb} MB`); console.log(Object.entries(row.cases).map(([q, c]) => `${q}=${c.ms}ms(${c.rows})`).join("  "));
  db.close();
}
rmSync(`${dbDir}/variant.db`, { force: true });
writeFileSync(outFile, JSON.stringify(out, null, 1) + "\n");
