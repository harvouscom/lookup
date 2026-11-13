// Renders the film at 2× (3840×2160) so text and specks are supersampled, brings it to YouTube
// loudness (−14 LUFS, −1.5 dBTP) with a two-pass loudnorm, then downscales a crisp 1080p copy.
//   node scripts/render.mjs            → out/lookup-film-4k.mp4 and out/lookup-film.mp4 (1080p, 60 fps)
//   SCALE=0.5 node scripts/render.mjs  → a quicker half-size draft
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const root = path.resolve(import.meta.dirname, "..");
const scale = Number(process.env.SCALE ?? 2);
const name = scale === 2 ? "lookup-film-4k" : `lookup-film-${Math.round(1080 * scale)}p`;
mkdirSync(path.join(root, "out"), { recursive: true });
const raw = path.join(root, `out/${name}-raw.mp4`);
const final = path.join(root, `out/${name}.mp4`);

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const chromiumOptions = { gl: "angle" };
const composition = await selectComposition({ serveUrl, id: "LookupFilm", chromiumOptions });
let last = -1;
await renderMedia({
  serveUrl, composition, chromiumOptions, scale, codec: "h264", crf: 14, pixelFormat: "yuv420p", imageFormat: "png",
  audioCodec: "aac", audioBitrate: "320k", concurrency: Number(process.env.CONCURRENCY ?? 6), outputLocation: raw,
  onProgress: ({ progress }) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; console.log(`render ${Math.round(progress * 100)}%`); } },
});

// Two-pass loudness normalization; the picture is copied untouched. loudnorm prints its JSON to stderr.
const measure = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const j = JSON.parse(measure.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", final], { stdio: "inherit" });
console.log(final);

// The 1080p delivery: a Lanczos downscale of the 4K master, so UI text stays sharp.
if (scale === 2) {
  const hd = path.join(root, "out/lookup-film.mp4");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", final, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "slow",
    "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", hd], { stdio: "inherit" });
  console.log(hd);
}
