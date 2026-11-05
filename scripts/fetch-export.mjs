#!/usr/bin/env node
// Download the moderated HMC export. Resumable: finished regions are skipped.
// Key comes from LOOKUP_INTERNAL_KEY or ~/.config/heresmychurch/lookup-internal-key, and is never logged.
// Usage: node scripts/fetch-export.mjs <outDir>
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const API = "https://api.heresmychurch.com/internal/lookup";
const key = process.env.LOOKUP_INTERNAL_KEY ?? readFileSync(`${process.env.HOME}/.config/heresmychurch/lookup-internal-key`, "utf8").trim();
const headers = { "x-lookup-key": key };
mkdirSync(dir, { recursive: true });
const listRes = await fetch(`${API}/regions`, { headers });
if (!listRes.ok) throw new Error(`regions: ${listRes.status}`);
const list = await listRes.json();
writeFileSync(`${dir}/regions.json`, JSON.stringify(list));
writeFileSync(`${dir}/countries.json`, await (await fetch("https://api.heresmychurch.com/churches/countries")).text());
let next = 0;
const missing = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < list.regions.length) {
    const { cc, abbrev } = list.regions[next++];
    const file = `${dir}/${cc}__${abbrev}.json`;
    if (existsSync(file)) continue;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${API}/region/${cc}/${abbrev}`, { headers });
      if (res.ok) { writeFileSync(`${file}.tmp`, await res.text()); renameSync(`${file}.tmp`, file); break; }
      if (res.status === 404) { missing.push(`${cc}/${abbrev}`); break; }
      if (attempt >= 4) throw new Error(`${cc}/${abbrev}: ${res.status}`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}));
writeFileSync(`${dir}/missing.json`, JSON.stringify(missing));
console.log("regions listed", list.regions.length, "missing", missing);
