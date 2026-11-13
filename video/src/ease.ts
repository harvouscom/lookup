// Small timing helpers. Everything in the film is a pure function of time in seconds.

import { useCurrentFrame } from "remotion";
import { FPS, toStory } from "./timeline.ts";

/** Story time for the current frame: the film plays the story through the pacing warp in timeline.ts. */
export const useT = () => toStory(useCurrentFrame() / FPS);

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0..1 progress of t through [a, b]. */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export type Ease = (k: number) => number;
export const linear: Ease = (k) => k;
export const inCubic: Ease = (k) => k * k * k;
export const outCubic: Ease = (k) => 1 - Math.pow(1 - k, 3);
export const inOutCubic: Ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const outQuint: Ease = (k) => 1 - Math.pow(1 - k, 5);
export const inOutQuint: Ease = (k) => (k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2);
export const outExpo: Ease = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
export const inOutSine: Ease = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
/** The site's cubic-bezier(.2,.8,.2,1), close enough: fast start, long soft landing. */
export const site: Ease = (k) => 1 - Math.pow(1 - k, 3.4);
/** A gentle overshoot for things that settle into place. */
export const outBack: Ease = (k) => { const c = 1.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

/** Eased 0..1 progress through [a, b]. */
export const ep = (t: number, a: number, b: number, e: Ease = inOutCubic) => e(prog(t, a, b));

/** Fade in over [a, a+inD], hold, fade out over [b-outD, b]. */
export const window01 = (t: number, a: number, b: number, inD = 0.4, outD = 0.4, e: Ease = inOutSine) =>
  Math.min(e(prog(t, a, a + inD)), 1 - e(prog(t, b - outD, b)));

/**
 * A keyframed value: [time, value, ease into this key]. Holds the first and last values outside the range.
 */
export type Key = [number, number, Ease?];
export function track(t: number, keys: Key[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e = inOutCubic] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return mix(v0, v1, e(prog(t, t0, t1)));
    }
  }
  return keys[keys.length - 1][1];
}

/** A stable pseudo-random number in 0..1 for an integer seed. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** A seeded generator, for scattering particles the same way every render. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A point on a quadratic bézier. */
export function quad(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, k: number) {
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
}
