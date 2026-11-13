// Renders review stills at the given story times (seconds, as written in timeline.ts) from one bundle,
// into out/stills/, named by story time.
// Usage: node scripts/stills.mjs 1 2.5 8.5 ...   (defaults to one key frame per scene)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { toOut } from "../src/timeline.ts";

const root = path.resolve(import.meta.dirname, "..");
const times = process.argv.slice(2).map(Number);
const at = times.length ? times : [2.6, 9.5, 14.2, 18.4, 23.2, 28.9, 33, 39.2, 43.4, 50.6, 57.6, 60.2, 63.6, 65, 69.5, 76.5, 85];
const scale = Number(process.env.SCALE ?? 0.5);
mkdirSync(path.join(root, "out/stills"), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "LookupFilm", chromiumOptions: { gl: "angle" } });
for (const s of at) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(toOut(s) * composition.fps));
  const output = path.join(root, `out/stills/s${String(Math.round(s * 100)).padStart(5, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, scale, chromiumOptions: { gl: "angle" }, logLevel: "error" });
  console.log(output);
}
