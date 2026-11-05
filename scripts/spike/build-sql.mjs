#!/usr/bin/env node
// Build D1 import files from public R2 region JSON.
// MEASUREMENT ONLY: those files contain unmoderated overlays and must never feed a production index.
// Usage: node build-sql.mjs <regionsDir> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { completeness, isExcluded, addNearestPlace, locText, geoText } from "./lib.mjs";

const [regionsDir, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const REGIONS = ["TX", "DEBY", "PLWP"];
const all = [];
const stats = {};
for (const r of REGIONS) {
  const { churches } = JSON.parse(readFileSync(`${regionsDir}/${r}.json`, "utf8"));
  const kept = churches.filter((c) => !isExcluded(c));
  stats[r] = { source: churches.length, kept: kept.length };
  all.push(...kept);
}
stats.places = addNearestPlace(all);
stats.withNear = all.filter((c) => c.near).length;
all.forEach((c) => { c.completeness = completeness(c); });
// Rowids by descending completeness; ties broken by id so the build is deterministic.
all.sort((a, b) => b.completeness - a.completeness || (a.id < b.id ? -1 : 1));
all.forEach((c, i) => { c.rid = i + 1; });
stats.total = all.length;

const q = (v) => (v === null || v === undefined || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (Number.isFinite(v) ? v : "NULL");

writeFileSync(`${outDir}/00-schema.sql`, `
CREATE TABLE church (rowid INTEGER PRIMARY KEY, id TEXT NOT NULL, name TEXT NOT NULL, city TEXT, near TEXT, region TEXT, country TEXT, lat REAL, lng REAL, denomination TEXT, completeness INTEGER);
CREATE VIRTUAL TABLE church_fts USING fts5(name, loc, geo, prefix='2 3 4 5', tokenize='unicode61 remove_diacritics 2');
`);

for (const r of REGIONS) {
  const rows = all.filter((c) => c.state === r);
  const out = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    out.push(`INSERT INTO church (rowid,id,name,city,near,region,country,lat,lng,denomination,completeness) VALUES ${chunk.map((c) =>
      `(${c.rid},${q(c.id)},${q(c.name)},${q(c.city)},${q(c.near)},${q(c.state)},${q(c.country)},${num(c.lat)},${num(c.lng)},${q(c.denomination)},${c.completeness})`).join(",")};`);
    out.push(`INSERT INTO church_fts (rowid,name,loc,geo) VALUES ${chunk.map((c) => `(${c.rid},${q(c.name)},${q(locText(c))},${q(geoText(c))})`).join(",")};`);
  }
  writeFileSync(`${outDir}/${r}.sql`, out.join("\n") + "\n");
}
writeFileSync(`${outDir}/rows.json`, JSON.stringify(all));
console.log(stats);
