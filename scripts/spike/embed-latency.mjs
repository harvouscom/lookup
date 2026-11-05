// Single-query embed latency, measured inside the Worker, against the 400 ms AI budget.
import { writeFileSync } from "node:fs";
const { SPIKE_URL, SPIKE_KEY } = process.env;
const qs = ["catholic church austin","grace community","iglesia bautista","first baptist dallas","korean church","kościół pw świętego","evangelische kirche münchen","lutheran near plano","cowboy church","greek orthodox","calvary chapel","church of christ","methodist waco","st marys","saint john","holy trinity","new life fellowship","assembly of god","presbyterian lubbock","non denominational"];
const walls = [];
for (let round = 0; round < 3; round++) for (const q of qs) {
  const res = await fetch(SPIKE_URL + "/embed", { method: "POST", headers: { "x-spike-key": SPIKE_KEY }, body: JSON.stringify({ text: [q + " " + round] }) });
  walls.push((await res.json()).wallMs);
  await new Promise((r) => setTimeout(r, 150));
}
const s = [...walls].sort((a, b) => a - b), p = (x) => s[Math.floor(x * s.length)];
const out = { n: s.length, p50: p(0.5), p90: p(0.9), p95: p(0.95), max: s.at(-1), over400: s.filter((x) => x > 400).length, over300: s.filter((x) => x > 300).length };
console.log(out);
writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + "\n");
