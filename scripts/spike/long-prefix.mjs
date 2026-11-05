// Words longer than the longest indexed prefix (8) can't use the prefix index, so check their cost directly.
import { threeRungs } from "./lib.mjs";
import { writeFileSync } from "node:fs";
const { SPIKE_URL, SPIKE_KEY } = process.env;
const post = async (p, b) => (await fetch(SPIKE_URL + p, { method: "POST", headers: { "x-spike-key": SPIKE_KEY }, body: JSON.stringify(b) })).json();
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const dallas = { lat: 32.7767, lng: -96.797, cc: "us" };
const out = [];
for (const q of ["methodist", "christian", "community", "presbyterian", "pentecostal", "missionary", "evangelische", "lutheran", "community church", "methodist church", "christian church", "church christian", "missionary baptist", "first united methodist"]) {
  const r = await post("/bench", { stmts: threeRungs(q, dallas, { fold: true }), repeat: 11 });
  if (r.error) { console.log(q, r.error); continue; }
  const w = r.runs.slice(1);
  const row = { q, wallP50: pct(w.map((x) => x.wallMs), 0.5), wallP95: pct(w.map((x) => x.wallMs), 0.95), sqlP50: w[0].rungs.map((_, i) => +pct(w.map((x) => x.rungs[i].durationMs), 0.5).toFixed(2)) };
  out.push(row); console.log(JSON.stringify(row));
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + "\n");
