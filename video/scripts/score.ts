// The film's score and sound design, synthesized from src/timeline.ts so every sound lands on its
// frame. No dependencies: oscillators, filters and a small feedback-delay reverb, written to WAV.
//
//   pad.wav  slow D-major pad: chords change on scene boundaries, swells under the loop and the outro
//   ui.wav   in-key interface sounds (keys, plucks, chimes) and code-made stand-ins for the effects
//
// If a recorded effect exists in public/sfx/<name>.(wav|mp3) (for example an ElevenLabs take), its
// stand-in is left out of ui.wav and the take is placed on its cue instead. The manifest that tells
// the film what to play is written to src/audio-manifest.json.
//
// Run: node scripts/score.ts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cues as storyCues, OUT_SECONDS, SCENE as STORY_SCENE, T as STORY_T, toOut, type Cue } from "../src/timeline.ts";

// The timeline is written in story time; the film plays it through a pacing warp. Sound lives in film
// time, so every beat is mapped through it here (gaps such as keyGap are durations and stay as they are).
const DURATIONS = new Set(["keyGap", "fieldGap"]);
const T = Object.fromEntries(Object.entries(STORY_T).map(([k, v]) => [k, DURATIONS.has(k) ? v : toOut(v)])) as typeof STORY_T;
const SCENE = Object.fromEntries(Object.entries(STORY_SCENE).map(([k, v]) => [k, toOut(v)])) as typeof STORY_SCENE;
const SECONDS = OUT_SECONDS;
const cues = (): Cue[] => storyCues().map((c) => ({ ...c, at: toOut(c.at) }));

const SR = 48000;
const LEN = Math.ceil((SECONDS + 1) * SR);
const root = path.resolve(import.meta.dirname, "..");

// ── Small DSP kit ──

let seed = 0x2f6e2b1;
const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296); };
const noise = () => rand() * 2 - 1;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (k: number) => k * k * (3 - 2 * k);

class Stereo {
  L = new Float32Array(LEN);
  R = new Float32Array(LEN);
  add(i: number, v: number, pan = 0) {
    if (i < 0 || i >= LEN) return;
    const a = (pan + 1) * Math.PI / 4;
    this.L[i] += v * Math.cos(a);
    this.R[i] += v * Math.sin(a);
  }
}

/** RBJ biquad, coefficients set per call to `set`. */
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(type: "lp" | "hp" | "bp", f: number, q = 0.707) {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - al) / a0;
    return this;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** An 8-line feedback delay network: a soft, dark hall. */
function reverb(src: Stereo, seconds: number, damp: number, mix: number): Stereo {
  const out = new Stereo();
  const lens = [1931, 2213, 2647, 3011, 3389, 3853, 4271, 4789].map((n) => Math.round(n * 1.15));
  const g = Math.pow(10, (-3 * (lens.reduce((a, b) => a + b) / lens.length / SR)) / seconds);
  const bufs = lens.map((n) => new Float32Array(n));
  const idx = new Array(8).fill(0);
  const lp = new Array(8).fill(0);
  const pre = new Float32Array(Math.round(0.03 * SR));
  let pi = 0;
  for (let i = 0; i < LEN; i++) {
    const inL = pre[pi], inR = pre[(pi + 7) % pre.length];
    pre[pi] = (src.L[i] + src.R[i]) * 0.5;
    pi = (pi + 1) % pre.length;
    const o = bufs.map((b, k) => b[idx[k]]);
    // Hadamard-style mix.
    const s = o.reduce((a, b) => a + b, 0) * 0.25;
    let L = 0, R = 0;
    for (let k = 0; k < 8; k++) {
      lp[k] = lp[k] + (o[k] - lp[k]) * damp;
      const fb = (lp[k] - s * 0.5) * g;
      bufs[k][idx[k]] = fb + (k % 2 ? inR : inL) * 0.35;
      idx[k] = (idx[k] + 1) % bufs[k].length;
      if (k % 2) R += o[k]; else L += o[k];
    }
    out.L[i] = src.L[i] * (1 - mix) + L * 0.25 * mix;
    out.R[i] = src.R[i] * (1 - mix) + R * 0.25 * mix;
  }
  return out;
}

// ── The pad ──

const CHORDS: { at: number; notes: number[] }[] = [
  { at: 0, notes: [38, 45] },                                  // D drone, before anything is named
  { at: SCENE.everyChurch, notes: [38, 50, 57, 64, 66, 69] },  // D(add9)
  { at: SCENE.find, notes: [35, 47, 54, 57, 61, 62] },         // Bm9
  { at: SCENE.fill - 0.6, notes: [31, 43, 50, 54, 59, 61] },   // Gmaj7#11
  { at: SCENE.oneTag, notes: [28, 40, 47, 50, 54, 55] },       // Em9
  { at: SCENE.fix, notes: [33, 45, 52, 59, 62] },              // Asus4(add9)
  { at: SCENE.source, notes: [31, 43, 50, 57, 59, 66] },       // Gmaj9
  { at: SCENE.better, notes: [33, 45, 52, 59, 61, 64, 71] },   // A(add9), lifting
  { at: T.mark - 0.05, notes: [26, 38, 45, 50, 54, 57, 64, 66, 69] }, // D(add9), home
];

function pad(): Stereo {
  const out = new Stereo();
  const XF = 1.6; // crossfade between chords, seconds
  CHORDS.forEach((ch, ci) => {
    const start = ch.at - (ci ? XF / 2 : 0);
    const end = (CHORDS[ci + 1]?.at ?? SECONDS + 1) + XF / 2;
    ch.notes.forEach((m0, ni) => {
      // Roots sit in the low register, never the sub: they should be felt on headphones, heard on laptops.
      const m = m0 < 38 ? m0 + 12 : m0;
      const f = midi(m);
      const low = m < 48 && ni === 0;
      const voices = low ? [0] : [-7, 7];
      const pan = low ? 0 : ((ni % 2 ? 1 : -1) * (0.25 + 0.1 * ni)) % 0.8;
      const filt = new Biquad();
      const ph = voices.map(() => rand());
      const s0 = Math.max(0, Math.floor(start * SR)), s1 = Math.min(LEN, Math.floor(end * SR));
      // Stark and spacious: upper voices sit back, very high ones are only a glint.
      const amp = (low ? 0.075 : 0.034) * (m > 66 ? 0.55 : 1);
      for (let i = s0; i < s1; i++) {
        const t = i / SR;
        if ((i & 63) === 0) {
          const lfo = 0.5 + 0.5 * Math.sin(t * 0.31 + ni * 1.7);
          filt.set("lp", low ? 360 : 420 + 780 * lfo + 520 * levelAt(t), 0.55);
        }
        let v = 0;
        voices.forEach((cents, k) => {
          ph[k] += (f * Math.pow(2, cents / 1200)) / SR;
          ph[k] -= Math.floor(ph[k]);
          // Sines and soft triangles, no saw edge: it should feel like air, not a synth.
          v += low ? Math.sin(2 * Math.PI * ph[k]) : Math.sin(2 * Math.PI * ph[k]) * 0.7 + (1 - 4 * Math.abs(ph[k] - 0.5)) * 0.3;
        });
        const fin = clamp((t - start) / (ci ? XF : 4.5)), fout = clamp((end - t) / XF);
        const env = smooth(fin) * smooth(fout);
        out.add(i, filt.run(v) * amp * env * levelAt(t) * duck(t), pan);
      }
    });
  });
  space(out);
  return reverb(out, 9, 0.15, 0.68);
}

/**
 * The room itself: a low sub drone on D, and wind, a band of noise drifting slowly in pitch and across
 * the stereo field. Loudest over open space (the globe), barely there under the interface.
 */
function space(out: Stereo) {
  const bpL = new Biquad(), bpR = new Biquad(), lp = new Biquad().set("lp", 120, 0.7);
  let ph = 0;
  const air = (t: number) => {
    const keys: [number, number][] = [[0, 0], [1.2, 0.9], [SCENE.type, 0.75], [SCENE.fill, 0.35], [SCENE.source, 0.45], [T.pullBack, 1], [SCENE.outro, 0.85], [SECONDS, 0]];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return v0 + (v1 - v0) * smooth(clamp((t - t0) / (t1 - t0)));
    }
    return 0;
  };
  for (let i = 0; i < LEN; i++) {
    const t = i / SR;
    if ((i & 63) === 0) {
      const w = 0.5 + 0.5 * Math.sin(t * 0.11), w2 = 0.5 + 0.5 * Math.sin(t * 0.07 + 2);
      bpL.set("bp", 260 + 900 * w, 2.4);
      bpR.set("bp", 300 + 820 * w2, 2.4);
    }
    const a = air(t);
    ph += 36.7 / SR;
    const sub = (Math.sin(2 * Math.PI * ph) * 0.8 + lp.run(noise()) * 0.6) * 0.05 * a;
    out.L[i] += bpL.run(noise()) * 0.05 * a + sub;
    out.R[i] += bpR.run(noise()) * 0.05 * a + sub;
  }
}

/** The pad's level over the film: quiet under the UI scenes, wide open in the loop and the outro. */
function levelAt(t: number) {
  const keys: [number, number][] = [[0, 0.0], [1.4, 0.45], [SCENE.everyChurch, 0.7], [SCENE.find, 0.66], [SCENE.type + 1, 0.6], [SCENE.fill, 0.64], [SCENE.oneTag, 0.55],
    [SCENE.fix, 0.6], [SCENE.source, 0.7], [T.pullBack + 0.8, 0.85], [SCENE.better, 0.95], [SCENE.outro, 1], [T.fadeOut + 0.2, 0.9], [SECONDS + 0.5, 0]];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return 0;
}

/** Duck the pad a little under the big moments so they land. */
function duck(t: number) {
  let d = 1;
  for (const at of [T.impact, T.enter, T.live]) {
    const k = t - at;
    if (k > -0.05 && k < 1.4) d = Math.min(d, 1 - 0.35 * Math.exp(-Math.max(0, k) * 2.2));
  }
  return d;
}

// ── Interface sounds and stand-ins ──

const PENTA = [62, 64, 66, 69, 71]; // D E F# A B

/** A bell-like pluck: a few inharmonic partials, fast attack, exponential decay. */
function bell(out: Stereo, at: number, m: number, gain: number, decay = 0.9, pan = 0, partials = [[1, 1], [2.0, 0.28], [2.76, 0.16], [5.4, 0.05]]) {
  const f = midi(m), s0 = Math.floor(at * SR), n = Math.floor((decay * 5) * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const att = clamp(t / 0.004);
    let v = 0;
    for (const [mul, a] of partials) v += Math.sin(2 * Math.PI * f * mul * t) * a * Math.exp(-t / (decay / Math.sqrt(mul)));
    out.add(s0 + j, v * gain * att, pan);
  }
}

/** A soft key click: a band of noise and a tiny body. */
function click(out: Stereo, at: number, gain: number, pan = 0, tone = 4200) {
  const bp = new Biquad().set("bp", tone * (0.9 + rand() * 0.2), 1.4);
  const s0 = Math.floor(at * SR), n = Math.floor(0.05 * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    const v = bp.run(noise()) * Math.exp(-t / 0.004) * 1.6 + Math.sin(2 * Math.PI * 1650 * t) * Math.exp(-t / 0.012) * 0.25;
    out.add(s0 + j, v * gain, pan);
  }
}

/** Filtered noise swept through a band: whooshes and swishes. */
function whoosh(out: Stereo, at: number, dur: number, f0: number, f1: number, gain: number, panFrom = 0, panTo = 0, q = 0.8) {
  const bp = new Biquad(), lp = new Biquad();
  const s0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  for (let j = 0; j < n; j++) {
    const k = j / n;
    if ((j & 31) === 0) { bp.set("bp", f0 * Math.pow(f1 / f0, smooth(k)), q); lp.set("lp", 6000, 0.7); }
    const env = Math.sin(Math.PI * Math.pow(k, 0.8)) ** 1.6;
    out.add(s0 + j, lp.run(bp.run(noise())) * env * gain, panFrom + (panTo - panFrom) * k);
  }
}

/** A cloud of tiny high blips, for pixels: density per second over a span. */
function glitter(out: Stereo, at: number, dur: number, perSecond: (k: number) => number, gain: number, octave = 2) {
  let t = at;
  while (t < at + dur) {
    const k = (t - at) / dur;
    const m = PENTA[Math.floor(rand() * PENTA.length)] + 12 * octave;
    bell(out, t, m, gain * (0.4 + rand() * 0.6), 0.06 + rand() * 0.08, rand() * 1.6 - 0.8, [[1, 1], [2.0, 0.2]]);
    t += 1 / Math.max(1, perSecond(k) * 0.55) * (0.5 + rand());
  }
}

/** A sine that glides in pitch with a soft envelope. */
function glide(out: Stereo, at: number, dur: number, f0: number, f1: number, gain: number, pan = 0) {
  let ph = 0;
  const s0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  for (let j = 0; j < n; j++) {
    const k = j / n;
    ph += (f0 * Math.pow(f1 / f0, k)) / SR;
    out.add(s0 + j, Math.sin(2 * Math.PI * ph) * Math.sin(Math.PI * k) ** 2 * gain, pan);
  }
}

/** A low, warm thump for the stand-in impact. */
function thump(out: Stereo, at: number, gain: number) {
  let ph = 0;
  const lp = new Biquad().set("lp", 900, 0.7);
  const s0 = Math.floor(at * SR), n = Math.floor(2.4 * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    ph += (42 + 58 * Math.exp(-t / 0.09)) / SR;
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.55) + lp.run(noise()) * Math.exp(-t / 0.05) * 0.35;
    out.add(s0 + j, v * gain * clamp(t / 0.003));
  }
}

/** A slow swell of noise and sub, for the stand-in opening. */
function swell(out: Stereo, at: number, dur: number, gain: number) {
  const lp = new Biquad();
  let ph = 0;
  const s0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  for (let j = 0; j < n; j++) {
    const k = j / n;
    if ((j & 63) === 0) lp.set("lp", 120 + 900 * k * k, 0.8);
    ph += (44 + 6 * k) / SR;
    const env = smooth(clamp(k / 0.8)) * smooth(clamp((1 - k) / 0.2));
    out.add(s0 + j, (lp.run(noise()) * 0.6 + Math.sin(2 * Math.PI * ph) * 0.7) * env * gain);
  }
}

/** A marimba-like pop: a quick pitch drop into a round tone, with a bright overtone that dies fast. */
function pop(out: Stereo, at: number, m: number, gain: number, pan = 0, decay = 0.32) {
  const f = midi(m), s0 = Math.floor(at * SR), n = Math.floor(decay * 4 * SR);
  let ph = 0, ph2 = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    ph += (f * (1 + 0.5 * Math.exp(-t / 0.008))) / SR;
    ph2 += (f * 3.99) / SR;
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t / decay) + Math.sin(2 * Math.PI * ph2) * 0.25 * Math.exp(-t / 0.02);
    out.add(s0 + j, v * gain * clamp(t / 0.002), pan);
  }
}

/** Digital crackle: short bursts of coarse, sample-and-held noise, like pixels switching on. */
function crackle(out: Stereo, at: number, dur: number, perSecond: number, gain: number) {
  let t = at;
  const hp = new Biquad().set("hp", 1800, 0.7);
  while (t < at + dur) {
    const len = Math.floor((0.004 + rand() * 0.01) * SR), hold = 2 + Math.floor(rand() * 10), pan = rand() * 1.4 - 0.7;
    let v = 0;
    const s0 = Math.floor(t * SR);
    for (let j = 0; j < len; j++) {
      if (j % hold === 0) v = Math.round(noise() * 3) / 3;
      out.add(s0 + j, hp.run(v) * gain * (1 - j / len), pan);
    }
    t += (1 / perSecond) * (0.4 + rand() * 1.2);
  }
}

/** A sonar ping with two echoes: something found, somewhere. */
function sonar(out: Stereo, at: number, m: number, gain: number, pan = 0) {
  [[0, 1], [0.19, 0.4], [0.38, 0.16]].forEach(([d, g]) => {
    const f = midi(m), s0 = Math.floor((at + d) * SR), n = Math.floor(1.2 * SR);
    let ph = 0;
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      ph += (f * (1 - 0.04 * Math.min(1, t / 0.3))) / SR;
      out.add(s0 + j, Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.35) * clamp(t / 0.01) * gain * g, pan * (1 - d));
    }
  });
}

/** A reverse swell: noise and a rising cluster that grow, then stop on the beat. */
function revSwell(out: Stereo, at: number, dur: number, gain: number) {
  const bp = new Biquad(), s0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  const ph = [0, 0, 0];
  for (let j = 0; j < n; j++) {
    const k = j / n;
    if ((j & 31) === 0) bp.set("bp", 600 + 5000 * k * k, 1.2);
    const env = Math.pow(k, 2.6) * clamp((1 - k) / 0.03);
    let v = bp.run(noise()) * 0.8;
    [74, 78, 81].forEach((m, i) => { ph[i] += (midi(m) * (0.98 + 0.04 * k)) / SR; v += Math.sin(2 * Math.PI * ph[i]) * 0.25; });
    out.add(s0 + j, v * env * gain);
  }
}

/** A low, soft thock: the space bar, Enter, a card set down. */
function thock(out: Stereo, at: number, gain: number, pan = 0, body = 210) {
  const bp = new Biquad().set("bp", 1300, 1.0), s0 = Math.floor(at * SR), n = Math.floor(0.12 * SR);
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    out.add(s0 + j, (bp.run(noise()) * Math.exp(-t / 0.006) * 1.2 + Math.sin(2 * Math.PI * body * t) * Math.exp(-t / 0.035)) * gain, pan);
  }
}

/** A pen stroke: breathy noise whose band wanders like a hand drawing a loop. */
function pen(out: Stereo, at: number, dur: number, gain: number) {
  const bp = new Biquad(), s0 = Math.floor(at * SR), n = Math.floor(dur * SR);
  for (let j = 0; j < n; j++) {
    const k = j / n;
    if ((j & 31) === 0) bp.set("bp", 2200 + 1600 * Math.sin(k * Math.PI * 3.2), 2.2);
    out.add(s0 + j, bp.run(noise()) * Math.sin(Math.PI * k) ** 1.2 * gain, -0.4 + 0.8 * k);
  }
}

/** Pan for a screen x position. */
const panX = (x: number) => clamp((x / 1920) * 2 - 1, -1, 1) * 0.6;

/**
 * Recorded effects that replace a stand-in when present, and where they play. Gains sit each take a
 * little under the score: the ElevenLabs takes run 5–12 dB hotter than the bed.
 */
const TAKES: { name: string; kind: Cue["kind"]; at: number; gain: number; fadeOut?: number }[] = [
  { name: "swell", kind: "swell", at: 0, gain: 0.22 },
  { name: "rim-shimmer", kind: "shimmer", at: T.rimStart - 0.1, gain: 0.32 },
  { name: "whoosh-fly", kind: "whoosh", at: T.flyStart - 0.3, gain: 0.35 },
  { name: "pixel-scatter", kind: "scatter", at: T.scatter - 0.05, gain: 0.55 },
  { name: "pixel-scatter", kind: "scatter", at: T.dissolve, gain: 0.45 },
  { name: "pixel-scatter", kind: "burst", at: T.burst, gain: 0.4 },
  { name: "soft-impact", kind: "impact", at: T.impact - 0.05, gain: 0.8 },
  { name: "whoosh-pullback", kind: "pullBack", at: T.pullBack - 0.2, gain: 0.27 },
  { name: "closing-shimmer", kind: "tail", at: T.mark + 0.1, gain: 0.24, fadeOut: 1.2 },
];
const takeFile = (name: string) => ["wav", "mp3"].map((e) => `sfx/${name}.${e}`).find((f) => existsSync(path.join(root, "public", f)));
const hasTake = (kind: Cue["kind"]) => TAKES.some((t) => t.kind === kind && takeFile(t.name));

function ui(): Stereo {
  const out = new Stereo();
  for (const c of cues()) {
    const { at } = c;
    switch (c.kind) {
      case "swell": if (!hasTake("swell")) swell(out, 0, 5.5, 0.16); break;
      case "scatter":
        if (!hasTake("scatter")) glitter(out, at, 2.2, (k) => 70 * (1 - k) + 6, 0.05);
        bell(out, at, 74, 0.08, 1.4);
        break;
      case "shimmer":
        if (!hasTake("shimmer")) for (let i = 0; i < 9; i++) bell(out, at + i * 0.17, PENTA[i % 5] + 24, 0.045, 0.9, -0.7 + i * 0.17);
        break;
      case "sparkle":
        // The counter: blips that rush, then slow as the number settles.
        glitter(out, at, T.countEnd - at, (k) => 46 * Math.pow(1 - k, 1.6) + 3, 0.04, 2);
        bell(out, T.countEnd, 81, 0.05, 1.6, 0.2);
        break;
      case "whoosh": if (!hasTake("whoosh")) whoosh(out, at - 0.2, 2.8, 300, 2400, 0.22, -0.4, 0.5); break;
      case "gather":
        // Specks from all over the globe pulling into one place: a swell that lands on the box.
        revSwell(out, at, T.boxIn + 0.25 - at, 0.14);
        glitter(out, at, T.boxIn + 0.2 - at, (k) => 8 + 70 * k * k, 0.02, 2);
        break;
      case "clickIn": click(out, at, 0.16, -0.2, 3600); pop(out, at + 0.01, 74, 0.07, -0.2); break;
      case "key": click(out, at, c.i === 99 ? 0.08 : 0.085, -0.15 + rand() * 0.3, 2800 + rand() * 1600); break;
      case "space": thock(out, at, 0.11, 0, 190); break;
      case "locate": sonar(out, at, 81, 0.07, 0.45); break;
      case "zoom": glide(out, at, 2.4, 160, 55, 0.07, 0.2); break;
      case "codeKey": click(out, at, 0.03, 0.35 + rand() * 0.2, 4200); break;
      case "backspace": click(out, at, 0.12, 0.25, 3000); break;
      case "rows":
        // First results tumble in; the place-aware refresh re-sorts; the settled list lands on a soft chord.
        if (!c.i) RESULTS_N.forEach((_, i) => pop(out, at + 0.05 + i * 0.06, PENTA[i % 5] + 12, 0.045, -0.2 + i * 0.1, 0.18));
        else if (c.i === 1) RESULTS_N.forEach((_, i) => click(out, at + i * 0.035, 0.05, 0.3 - i * 0.12, 5200));
        else [62, 66, 69, 76].forEach((m, i) => bell(out, at + i * 0.02, m, 0.03, 1.4, -0.3 + i * 0.2));
        break;
      case "select": thock(out, at, 0.14, 0, 240); bell(out, at, 81, 0.08, 1.2, 0); bell(out, at + 0.07, 86, 0.055, 1.4, 0.1); break;
      case "build": whoosh(out, at, 1.6, 500, 3200, 0.05, -0.3, 0.3, 1.4); crackle(out, at + 0.05, 1.45, 55, 0.05); break;
      case "burst": if (!hasTake("burst")) glitter(out, at, 1.0, (k) => 60 * (1 - k) + 5, 0.035, 2); glide(out, at, 0.18, 1100, 380, 0.06); break;
      case "fill": pop(out, at + 0.05, [62, 64, 66, 69, 71, 74, 76][c.i ?? 0], 0.09, -0.3 + (c.i ?? 0) * 0.1, 0.75); break;
      case "done": [74, 78, 81, 88].forEach((m, i) => bell(out, at + i * 0.04, m, 0.035, 1.6, -0.3 + i * 0.2)); break;
      case "swipe":
        // Each look has its own color of sound: teal bright and airy, amber low and warm.
        if (!c.i) { whoosh(out, at - 0.05, 0.7, 1400, 6000, 0.09, -0.7, 0.7, 1.3); [76, 83].forEach((m, i) => bell(out, at + 0.3 + i * 0.05, m, 0.04, 0.9, 0.4)); }
        else { whoosh(out, at - 0.05, 0.8, 500, 2200, 0.11, -0.7, 0.7, 0.9); [67, 74].forEach((m, i) => pop(out, at + 0.3 + i * 0.06, m, 0.06, 0.4, 0.5)); }
        break;
      case "fan": whoosh(out, at, 1.3, 260, 1500, 0.1, 0, 0, 0.7); [-0.6, 0, 0.6].forEach((p, i) => thock(out, at + 0.35 + i * 0.13, 0.07, p, 160 + i * 40)); break;
      case "link": glide(out, at, 0.55, 600, 2400, 0.018, 0.3); pop(out, at + 0.5, [81, 83, 86][c.i ?? 0], 0.06, -0.1 * (c.i ?? 0)); break;
      case "panel": whoosh(out, at, 0.5, 1200, 3000, 0.05, 0, 0, 1.2); bell(out, at + 0.1, 69, 0.045, 0.5); break;
      case "click": click(out, at, 0.15, 0.1, 2600); click(out, at + 0.075, 0.09, 0.1, 3400); break;
      case "live": [66, 69, 74].forEach((m, i) => bell(out, at + i * 0.075, m + 12, 0.075, 1.1, -0.2 + i * 0.2)); glitter(out, at + 0.2, 0.6, () => 30, 0.02, 3); break;
      case "collapse": revSwell(out, at, 0.62, 0.1); break;
      case "card": pop(out, at, 69, 0.07, 0, 0.5); bell(out, at + 0.04, 76, 0.03, 1.2); break;
      case "flip": click(out, at, 0.08, 0.1, 3000); click(out, at + 0.08, 0.07, 0.15, 4400); bell(out, at + 0.12, 86, 0.05, 1.0, 0.1); break;
      case "synced": pop(out, at, [81, 83, 86, 88, 90, 93][(c.i ?? 0) % 6], 0.028, panX([300, 1000, 1700, 260, 1000, 1700][(c.i ?? 0) % 6]), 0.2); break;
      case "stroke": pen(out, at, 1.3, 0.05); break;
      case "count": {
        // The counter rolling up: ticks that start fast and slow to a stop.
        let tt = at;
        for (let n = 0; n < 26; n++) { click(out, tt, 0.04, 0.1, 5600); tt += 0.018 + n * n * 0.0011; }
        break;
      }
      case "arc": glide(out, at, 1.45, 1900, 420, 0.03, 0.4); whoosh(out, at, 1.45, 3000, 600, 0.06, -0.2, 0.5, 1.0); break;
      case "impact":
        if (!hasTake("impact")) thump(out, at, 0.22);
        [62, 69, 74, 78].forEach((m, i) => bell(out, at + 0.02 + i * 0.03, m, 0.05, 2.2, -0.3 + i * 0.2));
        break;
      case "pullBack": if (!hasTake("pullBack")) whoosh(out, at - 0.2, 3.2, 180, 1200, 0.22, 0.4, -0.4, 0.6); break;
      case "stream": {
        // A run of ticks into the globe; a fix that goes live rings bright, one sent for review drops softly into the queue.
        const i = c.i ?? 0, pan = panX([300, 1000, 1700, 260, 1000, 1700][i % 6]), review = [0, 2, 4].includes(i);
        for (let j = 0; j < 10; j++) bell(out, at + j * 0.06, PENTA[(j + i) % 5] + 24, 0.014, 0.07, pan, [[1, 1]]);
        if (review) { sonar(out, at + 0.9, 69, 0.03, 0.6); }
        else { pop(out, at + 0.9, [74, 78, 81, 83][i % 4], 0.06, pan, 0.3); bell(out, at + 0.92, [86, 90, 93, 95][i % 4], 0.025, 0.8, pan); }
        break;
      }
      case "approve": [0, 1, 2].forEach((i) => { click(out, at + i * 0.16, 0.05, 0.6, 5000); bell(out, at + i * 0.16, 81 + i * 2, 0.04, 0.5, 0.6); }); break;
      case "brighten": for (let i = 0; i < 16; i++) bell(out, at + i * 0.18, PENTA[i % 5] + 24 + (i > 9 ? 12 : 0), 0.012 + i * 0.0015, 1.2, Math.sin(i) * 0.6); break;
      case "resolve": [50, 57, 62, 66, 69, 74].forEach((m, i) => bell(out, at + i * 0.09, m + 12, 0.055, 3.2, -0.4 + i * 0.16)); break;
      case "tail": if (!hasTake("tail")) glitter(out, at, 3, (k) => 20 * (1 - k) + 2, 0.022, 2); break;
    }
  }
  // A long, dark tail on every interface sound: each one rings out into the same night as the pad.
  return reverb(out, 5.4, 0.24, 0.5);
}
const RESULTS_N = [0, 1, 2, 3, 4];

// ── Output ──

function normalize(s: Stereo, peakDb: number) {
  let peak = 0;
  for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(s.L[i]), Math.abs(s.R[i]));
  const g = peak ? Math.pow(10, peakDb / 20) / peak : 1;
  for (let i = 0; i < LEN; i++) { s.L[i] *= g; s.R[i] *= g; }
  return s;
}

function writeWav(file: string, s: Stereo) {
  const n = LEN, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const d = () => (rand() - rand()) / 32768; // TPDF dither
    buf.writeInt16LE(Math.round(clamp(s.L[i] + d(), -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(s.R[i] + d(), -1, 1) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}

mkdirSync(path.join(root, "public/audio"), { recursive: true });
const started = Date.now();
writeWav(path.join(root, "public/audio/pad.wav"), normalize(pad(), -9));
writeWav(path.join(root, "public/audio/ui.wav"), normalize(ui(), -4));

const clips = [
  { file: "audio/pad.wav", at: 0, gain: 0.8 },
  { file: "audio/ui.wav", at: 0, gain: 0.85 },
  ...TAKES.flatMap((t) => { const f = takeFile(t.name); return f ? [{ file: f, at: t.at, gain: t.gain, fadeOut: t.fadeOut, dur: t.fadeOut ? 4.6 : undefined }] : []; }),
];
writeFileSync(path.join(root, "src/audio-manifest.json"), JSON.stringify({ clips }, null, 2) + "\n");
console.log(`score: pad.wav + ui.wav, ${clips.length - 2} recorded takes, ${((Date.now() - started) / 1000).toFixed(1)}s`);
