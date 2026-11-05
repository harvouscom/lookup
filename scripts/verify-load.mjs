#!/usr/bin/env node
// Check remote D1 row counts against the build manifest. Exits non-zero on any mismatch.
// Usage: node scripts/verify-load.mjs <buildDir> [database]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const [dir, db = "hmc-lookup"] = process.argv.slice(2);
const m = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
const sql = (command) => {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", db, "--remote", "--yes", "--config", "worker/wrangler.jsonc", "--json", "--command", command], { encoding: "utf8", maxBuffer: 1e8, stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
};
const problems = [];
for (const [t, want] of Object.entries(m.counts)) {
  const got = sql(`SELECT count(*) AS c FROM ${t === "church_fts" ? "church_fts_docsize" : t}`)[0].c;
  console.log(t.padEnd(12), got, got === want ? "ok" : `WANT ${want}`);
  if (got !== want) problems.push(t);
}
const byRegion = Object.fromEntries(sql("SELECT region, count(*) AS c FROM church GROUP BY region").map((r) => [r.region, r.c]));
let bad = 0;
for (const [region, r] of Object.entries(m.regions)) if ((byRegion[region] ?? 0) !== r.kept) { bad++; console.log("region mismatch", region, byRegion[region], r.kept); }
console.log("regions checked", Object.keys(m.regions).length, "mismatched", bad);
const sum = Object.values(m.regions).reduce((s, r) => s + r.source - r.kept, 0);
console.log("source", m.source, "kept", m.kept, "excluded", sum, "listed", m.regionsListed, "loaded", m.regionsLoaded, "missing", m.regionsMissing.join(","));
if (sum !== m.source - m.kept) problems.push("exclusion sum");
if (bad) problems.push("regions");
if (problems.length) { console.error("FAILED:", problems.join(", ")); process.exit(1); }
console.log("all counts match");
