#!/usr/bin/env node
// Write site/data/globe.json: church counts per half-degree cell, for the homepage globe.
// Reads D1 once (read-only) and writes aggregates only, never individual rows.
// Usage: node scripts/build-globe-data.mjs [database]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const db = process.argv[2] ?? "hmc-lookup";
const sql = "SELECT CAST(round(lat * 2) AS INTEGER) AS a, CAST(round(lng * 2) AS INTEGER) AS b, count(*) AS c FROM church GROUP BY a, b";
const out = execFileSync("npx", ["wrangler", "d1", "execute", db, "--remote", "--config", "worker/wrangler.jsonc", "--json", "--command", sql], { encoding: "utf8", maxBuffer: 1e9 });
const rows = JSON.parse(out.slice(out.indexOf("[")))[0].results;
const total = rows.reduce((s, r) => s + r.c, 0);
// Flat [latHalfDeg, lngHalfDeg, count, ...] keeps the file small.
const cells = rows.sort((x, y) => y.c - x.c).flatMap((r) => [r.a, r.b, r.c]);
writeFileSync("site/data/globe.json", JSON.stringify({ unit: 0.5, total, cells: cells.length / 3, data: cells }));
console.log(`${rows.length} cells, ${total} churches`);
