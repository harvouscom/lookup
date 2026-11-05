// Ad-hoc checks: fan-out burst, diacritics, trigram. Prints counts and timings.
import { threeRungs, buildMatch, RUNG_SQL } from "./lib.mjs";
const { SPIKE_URL, SPIKE_KEY } = process.env;
const post = async (p, b) => (await fetch(SPIKE_URL + p, { method: "POST", headers: { "x-spike-key": SPIKE_KEY }, body: JSON.stringify(b) })).json();
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const dallas = { lat: 32.7767, lng: -96.797, cc: "us" }, poznan = { lat: 52.4064, lng: 16.9252, cc: "pl" }, munich = { lat: 48.1351, lng: 11.582, cc: "de" };
console.log("--- diacritics (country-rung hits, cap 60)");
const wait0=(ms)=>new Promise(r=>setTimeout(r,ms));
for (const [q, l] of [["kosciol", poznan], ["koscioł", poznan], ["kościół", poznan], ["kościol", poznan], ["swietego", poznan], ["świętego", poznan], ["wroclaw", poznan], ["wrocław", poznan], ["munchen", munich], ["münchen", munich], ["muenchen", munich], ["strasse", munich], ["straße", munich], ["st", munich], ["sankt", munich], ["heilig", munich], ["hl", munich]]) {
  const r = await post("/bench", { stmts: [threeRungs(q, l)[2]], repeat: 1 });
  console.log(q.padEnd(12), r.runs?.[0].rungs[0].rows ?? r.error); await wait0(100);
}

const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
console.log("--- trigram: fetch timings");
for (const [label, sql, params] of [
  ["substring grac", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rowid LIMIT 60", ['"grac"']],
  ["substring race", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rowid LIMIT 60", ['"race"']],
  ["substring chu", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rowid LIMIT 60", ['"chu"']],
  ["two chars gr (no trigram)", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rowid LIMIT 60", ['"gr"']],
  ["fuzzy gracee (OR grams)", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rowid LIMIT 60", ['"gra" OR "rac" OR "ace" OR "cee"']],
  ["fuzzy gracee bm25", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rank LIMIT 60", ['"gra" OR "rac" OR "ace" OR "cee"']],
  ["fuzzy chrch bm25", "SELECT rowid FROM church_tri WHERE church_tri MATCH ?1 ORDER BY rank LIMIT 60", ['"chr" OR "hrc" OR "rch"']],
]) {
  const r = await post("/bench", { stmts: [{ sql, params }], repeat: 11 });
  if (r.error) { console.log(label, r.error); continue; }
  const w = r.runs.slice(1);
  console.log(label.padEnd(28), "rows", w[0].rungs[0].rows, "rowsRead", w[0].rungs[0].rowsRead, "sql p50", pct(w.map((x) => x.rungs[0].durationMs), .5).toFixed(2), "p95", pct(w.map((x) => x.rungs[0].durationMs), .95).toFixed(2));
  await wait(200);
}
