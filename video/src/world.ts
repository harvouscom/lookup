// The hero world's camera: where the globe sits, which way it faces, and how lit each layer is,
// as a function of film time. The globe, sky, aurora and arc all read this one state.

import { inOutCubic, inOutQuint, linear, outCubic, outQuint, prog, track } from "./ease.ts";
import { HEIGHT, SECONDS, T, WIDTH } from "./timeline.ts";

/** The globe canvas pixel ratio: 2px church specks and 3px shading cells at 1080p. */
export const DPR = 1.5;
/** Globe radius at scale 1, as in globe.js: min(W × 0.66, 1300 × dpr). */
export const R0 = Math.min(WIDTH * 0.66, 1300 * DPR);

/** The demo church: Dallas, Texas. */
export const DALLAS = { lat: 32.78, lng: -96.8 };
/** In the close-up, Dallas sits this many degrees above the view's center, so it lands low on screen. */
const TILT = 60;
const CLOSE = { lat: DALLAS.lat - TILT, lng: DALLAS.lng - 14, scale: 2.2, crest: 430 };
const WIDE = { lat: -16, scale: 1, crest: 560 };

export type Cam = {
  lat: number; lng: number; scale: number;
  /** Screen y of the globe's top edge. */
  crest: number;
  reveal: number; gain: number; glow: number; shade: number; limb: number;
  /** Opacity of the whole globe layer. */
  alpha: number;
  stars: number; aurora: number;
  /** The horizon arc above the headline: how much is drawn, and its opacity. */
  arc: number; arcAlpha: number;
  orbits: number;
  /** The night backdrop's violet glow. */
  backdrop: number;
};

const L = linear, C = inOutCubic, Q = inOutQuint, O = outCubic;

/** Seconds the pull-back from Dallas to the whole globe takes. */
const WIDE_IN = 3.3;

/** The base camera; scene 9's dive into Dallas overrides its framing (see `dive`). */
function base(t: number): Cam {
  return {
    lat: track(t, [[0, WIDE.lat], [T.flyStart, WIDE.lat], [T.flyEnd, CLOSE.lat, Q], [T.collapse, CLOSE.lat], [T.pullBack, CLOSE.lat],
      [T.pullBack + WIDE_IN, -13, Q], [T.ctaMove, -13], [T.ctaMove + 2.6, -18, Q]]),
    lng: track(t, [[0, -74, L], [T.flyStart, -63, L], [T.flyEnd, CLOSE.lng, Q], [T.enter, CLOSE.lng + 0.5, L], [T.collapse, CLOSE.lng + 0.5, L],
      [T.arcStart, CLOSE.lng], [T.pullBack, CLOSE.lng, L], [T.pullBack + WIDE_IN, -42, Q], [T.ctaMove, -31, L], [T.ctaMove + 2.6, -10, Q], [SECONDS, -5, L]]),
    scale: track(t, [[0, 1], [T.flyStart, 1], [T.flyEnd, CLOSE.scale, Q], [T.pullBack, CLOSE.scale], [T.pullBack + WIDE_IN, 1, Q],
      [T.ctaMove, 1], [T.ctaMove + 2.6, 1.8, Q], [SECONDS, 1.86, L]]),
    crest: track(t, [[0, HEIGHT + 420], [T.scatter, HEIGHT + 420], [T.globeUp, WIDE.crest, outQuint], [T.flyStart, WIDE.crest],
      [T.flyEnd, CLOSE.crest, Q], [T.burst + 0.4, CLOSE.crest], [T.burst + 2.2, 1015, C], [T.collapse + 0.2, 1015],
      [T.arcStart + 0.9, CLOSE.crest, C], [T.pullBack, CLOSE.crest], [T.pullBack + WIDE_IN, WIDE.crest, Q], [T.ctaMove, WIDE.crest],
      [T.ctaMove + 2.6, 690, Q], [SECONDS, 676, L]]),
    reveal: track(t, [[0, 0], [T.countStart, 0], [T.countEnd, 1, (k) => 1 - Math.pow(1 - k, 2.2)]]),
    gain: track(t, [[0, 1], [T.brighten, 1], [T.brighten + 3, 1.42, C], [T.ctaMove, 1.42], [T.ctaMove + 2.6, 1.15, C]]),
    glow: track(t, [[0, 0], [T.scatter, 0], [T.globeUp - 0.6, 1, O], [T.brighten, 1], [T.brighten + 3, 1.6, C], [T.ctaMove + 2.6, 1.2, C]]),
    shade: track(t, [[0, 0], [T.scatter + 0.3, 0], [T.globeUp, 1, O]]),
    limb: track(t, [[0, 0], [T.rimStart, 0], [T.rimEnd, 1, C]]),
    alpha: track(t, [[0, 1], [T.burst + 0.4, 1], [T.burst + 2.2, 0.75], [T.collapse, 0.75], [T.arcStart, 1]]),
    stars: track(t, [[0, 0], [1.0, 0], [3.6, 1, O], [T.burst + 0.4, 1], [T.burst + 2.2, 0.55], [T.collapse, 0.55], [T.arcStart, 1],
      [T.fadeOut, 1], [SECONDS, 0]]),
    aurora: track(t, [[0, 0], [T.auroraIn, 0], [T.auroraIn + 2.6, 1, O], [T.flyEnd, 0.8], [T.burst + 0.4, 0.8], [T.burst + 2.2, 0.4], [T.collapse, 0.4],
      [T.pullBack + WIDE_IN, 0.95], [T.fadeOut, 1], [SECONDS, 0]]),
    arc: track(t, [[0, 0], [T.rimStart, 0], [T.rimEnd, 1, C]]),
    arcAlpha: track(t, [[0, 1], [T.flyStart, 1], [T.flyStart + 1.2, 0, O]]),
    orbits: track(t, [[0, 0], [T.orbitsIn, 0], [T.orbitsIn + 1.4, 1, O], [T.ctaMove, 1], [T.ctaMove + 1.2, 0]]),
    backdrop: track(t, [[0, 0], [T.scatter, 0], [T.globeUp, 1, O], [T.fadeOut, 1], [SECONDS, 0]]),
  };
}

/** The deep close-up: looking nearly straight down on Dallas (tilt is degrees from the view center), close enough to see single churches. */
export const DEEP = { scale: 7.2, tilt: 18, off: 0, y: 560 };

/**
 * Scene 9 frames the globe by where Dallas sits instead of by the camera: the tilt above Dallas, the
 * longitude offset from it, the zoom (eased in log space, so the dive feels even) and Dallas's height
 * on screen. That keeps Dallas steady while the camera falls toward it and climbs back out.
 */
type Focus = { scale: number; tilt: number; off: number; y: number };

function focusOf(c: Cam): Focus {
  return { scale: c.scale, tilt: DALLAS.lat - c.lat, off: DALLAS.lng - c.lng, y: project(DALLAS.lat, DALLAS.lng, c).y };
}

function fromFocus(f: Focus, c: Cam): Cam {
  const lat = DALLAS.lat - f.tilt, lng = DALLAS.lng - f.off, R = R0 * f.scale;
  const sl = Math.sin(DALLAS.lat * RAD), cl = Math.cos(DALLAS.lat * RAD), s0 = Math.sin(lat * RAD), c0 = Math.cos(lat * RAD);
  const up = c0 * sl - s0 * cl * Math.cos(f.off * RAD);
  return { ...c, lat, lng, scale: f.scale, crest: f.y - R + up * R };
}

const mixFocus = (a: Focus, b: Focus, k: number): Focus => ({
  scale: Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * k),
  tilt: a.tilt + (b.tilt - a.tilt) * k, off: a.off + (b.off - a.off) * k, y: a.y + (b.y - a.y) * k,
});

const DIVE_FROM = T.collapse + 0.15;
const DIVE_AT = T.impact - 0.08;
const WIDE_AT = T.pullBack + WIDE_IN;

function dive(t: number, c: Cam): Cam {
  if (t <= DIVE_FROM || t >= WIDE_AT) return c;
  const from = focusOf(base(DIVE_FROM)), to = focusOf(base(WIDE_AT));
  // A slow drift in while the fix lands, so the close-up never freezes.
  const hold = { ...DEEP, scale: DEEP.scale * 1.08 };
  if (t < DIVE_AT) return fromFocus(mixFocus(from, DEEP, inOutCubic(prog(t, DIVE_FROM, DIVE_AT))), c);
  if (t < T.pullBack) return fromFocus(mixFocus(DEEP, hold, outCubic(prog(t, DIVE_AT, T.pullBack))), c);
  return fromFocus(mixFocus(hold, to, inOutQuint(prog(t, T.pullBack, WIDE_AT))), c);
}

export function camera(t: number): Cam {
  return dive(t, base(t));
}

const RAD = Math.PI / 180;

/** Where a place sits on screen for a camera, matching globe.js's orthographic projection. */
export function project(lat: number, lng: number, cam: Pick<Cam, "lat" | "lng" | "scale" | "crest">) {
  const R = R0 * cam.scale, cx = WIDTH / 2, cy = cam.crest + R;
  const sl = Math.sin(lat * RAD), cl = Math.cos(lat * RAD);
  const s0 = Math.sin(cam.lat * RAD), c0 = Math.cos(cam.lat * RAD);
  const d = (lng - cam.lng) * RAD;
  const x = cl * Math.sin(d), y = c0 * sl - s0 * cl * Math.cos(d), depth = s0 * sl + c0 * cl * Math.cos(d);
  return { x: cx + x * R, y: cy - y * R, depth, R };
}
