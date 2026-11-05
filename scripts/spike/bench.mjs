#!/usr/bin/env node
// Run the three-rung query against the spike Worker. Writes metrics only, never church rows.
// Usage: SPIKE_URL=... SPIKE_KEY=... node bench.mjs <label> <outFile> [repeat]
import { writeFileSync } from "node:fs";
import { threeRungs } from "./lib.mjs";

const [label, outFile, repeat = "12"] = process.argv.slice(2);
const { SPIKE_URL, SPIKE_KEY } = process.env;
const LOCS = {
  dallas: { lat: 32.7767, lng: -96.797, cc: "us" },
  munich: { lat: 48.1351, lng: 11.582, cc: "de" },
  poznan: { lat: 52.4064, lng: 16.9252, cc: "pl" },
};
const BENCH_OPTS = process.env.SPIKE_TABLE ? { table: process.env.SPIKE_TABLE, fold: true } : {};
const CASES = [
  ...["gr", "gra", "grac", "grace", "grace c", "grace co", "grace comm", "gracee", "first bapt", "first baptist", "church", "church dallas", "baptist", "st mary", "saint", "chu", "ch", "zzqx", "church c", "church catholic", "baptist methodist", "first second third"].map((q) => [q, "dallas"]),
  ...["ki", "kirche", "st", "evangelische kirche", "dreif", "dreifaltigkeit", "kath kirche", "sankt josef"].map((q) => [q, "munich"]),
  ...["pa", "parafia", "parafia sw", "kosciol", "kościół", "kościół pw", "kosciol pw"].map((q) => [q, "poznan"]),
];
const post = async (path, body) => {
  for (let i = 0; ; i++) {
    const res = await fetch(SPIKE_URL + path, { method: "POST", headers: { "x-spike-key": SPIKE_KEY }, body: JSON.stringify(body) });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    if (i >= 3) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  }
};
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const rows = [];
for (const [q, where] of CASES) {
  const stmts = threeRungs(q, LOCS[where], BENCH_OPTS);
  const { colo, runs } = await post("/bench", { stmts, repeat: Number(repeat) + 1 });
  const warm = runs.slice(1); // the first run warms the page cache
  const row = {
    q, where, colo, coldMs: runs[0].wallMs,
    wallP50: pct(warm.map((r) => r.wallMs), 0.5), wallP95: pct(warm.map((r) => r.wallMs), 0.95),
    rungs: stmts.map((s, i) => ({
      rung: s.rung,
      rows: warm[0].rungs[i].rows,
      rowsRead: warm[0].rungs[i].rowsRead,
      sqlP50: +pct(warm.map((r) => r.rungs[i].durationMs), 0.5).toFixed(2),
      sqlP95: +pct(warm.map((r) => r.rungs[i].durationMs), 0.95).toFixed(2),
    })),
    region: warm[0].rungs[0].region, primary: warm[0].rungs[0].primary,
  };
  row.totalRowsRead = row.rungs.reduce((s, r) => s + r.rowsRead, 0);
  rows.push(row);
  console.log(`${q.padEnd(22)} wall p50 ${String(row.wallP50).padStart(4)} p95 ${String(row.wallP95).padStart(4)} cold ${String(row.coldMs).padStart(4)} | ` +
    row.rungs.map((r) => `${r.rung[0]} ${String(r.rows).padStart(2)}r ${String(r.rowsRead).padStart(6)}rr ${String(r.sqlP50).padStart(6)}ms`).join(" | "));
}
writeFileSync(outFile, JSON.stringify({ label, repeat: Number(repeat), capturedAt: new Date().toISOString(), rows }, null, 1) + "\n");
