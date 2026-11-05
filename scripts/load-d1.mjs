#!/usr/bin/env node
// Load a build directory into remote D1, in file order, with a checkpoint so a failure can resume.
// Usage: node scripts/load-d1.mjs <buildDir> [database]
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";

const [dir, db = "hmc-lookup"] = process.argv.slice(2);
const checkpoint = `${dir}/.loaded`;
const done = new Set(existsSync(checkpoint) ? readFileSync(checkpoint, "utf8").split("\n").filter(Boolean) : []);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let written = 0, seconds = 0;
for (const f of files) {
  if (done.has(f)) continue;
  const t0 = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const out = execFileSync("npx", ["wrangler", "d1", "execute", db, "--remote", "--yes", "--config", "worker/wrangler.jsonc", "--file", `${dir}/${f}`, "--json"], { encoding: "utf8", maxBuffer: 1e8, stdio: ["ignore", "pipe", "pipe"] });
      const meta = JSON.parse(out.slice(out.indexOf("[")))[0]?.meta ?? {};
      written += meta.rows_written ?? 0;
      console.log(f, `${((Date.now() - t0) / 1000).toFixed(0)}s`, `sql ${(meta.duration ?? 0).toFixed(0)}ms`, `written ${meta.rows_written}`, `size ${(meta.size_after / 1e6).toFixed(0)}MB`);
      break;
    } catch (e) {
      console.error(f, "attempt", attempt, String(e.stderr ?? e.message).slice(0, 400));
      if (attempt >= 1 || f.startsWith("000")) throw e; // A re-run of a partly applied file could duplicate rows, so stop quickly.
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
  seconds += (Date.now() - t0) / 1000;
  appendFileSync(checkpoint, f + "\n");
}
console.log("loaded", files.length, "files,", `${written} rows written,`, `${seconds.toFixed(0)}s`);
