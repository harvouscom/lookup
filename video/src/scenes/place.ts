// Where the app window and the search box sit over time, shared by the scenes that hand them off.
// The window is shot like a camera would: wide for context, then close on whatever is happening (the
// fields as they fill, the field being fixed, the share panel), with the world behind thrown out of
// focus. In the code scene the camera tips the app back into 3D so the code shows as the layer beneath.

import { inOutCubic, inOutQuint, outCubic, prog, track, type Ease, type Key } from "../ease.ts";
import { fieldBox, WIN_W, winH, CHURCH_H, CHURCH_Y, MAIN_W, MAIN_X, PANEL_Y } from "../ui/AppWindow.tsx";
import { LOOKS, type Look } from "../ui/tokens.ts";
import { SCENE, T } from "../timeline.ts";

/** The share panel's open amount. */
export const panelOpen = (t: number) => (t < T.collapse ? outCubic(prog(t, T.panelIn, T.panelIn + 0.6)) : 1);

type Shot = { s: number; cx: number; cy: number };
/** A shot that puts window point (wx, wy) at screen point (sx, sy) at scale s. */
const aim = (s: number, wx: number, wy: number, open = 0, sx = 960, sy = 540): Shot =>
  ({ s, cx: sx - (wx - WIN_W / 2) * s, cy: sy - (wy - winH(open) / 2) * s });

const WIDE = { s: 1.35, cx: 960, cy: 520 };
/** Close on the fields grid as the data lands. */
const FILL = aim(1.8, 594, 323, 0, 960, 560);
/** After the fill: pulled back and high enough to leave the caption room. */
const FILLED = { s: 1.35, cx: 960, cy: 495 };
const FAN = { s: 0.7, cx: 960, cy: 520 };
/** Face-on frame the code scene tips back from (and returns to). */
export const LAYER = { s: 0.86, cx: 960, cy: 455 };
const FIX = { s: 1.22, cx: 960, cy: 500 };
/** Close on the service times field while it's edited. */
const FIX_FIELD = aim(1.75, 831, 392, 0, 960, 520);
/** Close on the share panel while it's sent. */
const FIX_PANEL = aim(1.45, 594, PANEL_Y + 102, 1, 960, 545);
/** After sharing: pulled back with the caption clear beneath. */
const FIX_DONE = { s: 1.08, cx: 960, cy: 462 };

const SHOTS: [number, Shot, Ease?][] = [
  [0, WIDE], [T.burst + 0.2, WIDE], [T.burst + 0.95, FILL, inOutQuint], [T.filledNote - 0.15, FILL], [T.filledNote + 0.6, FILLED, inOutQuint],
  [T.fan, FILLED], [T.fan + 1.2, FAN, inOutQuint], [SCENE.oneTag - 0.2, FAN], [SCENE.oneTag + 0.8, LAYER, inOutCubic],
  [T.formBack - 0.2, LAYER], [T.formBack + 0.8, FIX, inOutQuint], [T.focusTimes - 0.55, FIX], [T.focusTimes, FIX_FIELD, inOutQuint],
  [T.panelIn - 0.25, FIX_FIELD], [T.panelIn + 0.65, FIX_PANEL, inOutQuint], [T.live + 0.05, FIX_PANEL], [T.live + 0.7, FIX_DONE, inOutQuint],
];
const keys = (k: keyof Shot): Key[] => SHOTS.map(([at, s, e]) => [at, s[k], e]);
const S_KEYS = keys("s"), X_KEYS = keys("cx"), Y_KEYS = keys("cy");

export function winPlace(t: number) {
  const s = track(t, S_KEYS), cx = track(t, X_KEYS), cy = track(t, Y_KEYS);
  const open = panelOpen(t);
  const H = winH(open);
  return { s, left: cx - (WIN_W / 2) * s, top: cy - (H / 2) * s, H, open, cx, cy };
}

/** How out of focus the world behind is, in pixels: the background softens while the camera is close. */
export function depthBlur(t: number) {
  return track(t, [[0, 0], [T.burst + 0.2, 0], [T.burst + 0.95, 6], [T.filledNote - 0.15, 6], [T.filledNote + 0.6, 0],
    [SCENE.oneTag + 0.2, 0], [SCENE.oneTag + 1.3, 5], [T.formBack - 0.7, 5], [T.formBack + 0.2, 0],
    [T.focusTimes - 0.55, 0], [T.focusTimes, 6], [T.live + 0.05, 6], [T.live + 0.7, 0]]);
}

// ── The code scene: the app and its code as two layers in 3D ──

const PERSPECTIVE = 1900;
/** Where the code layer sits under the app, in the app window's own pixels, and how far below. */
export const CODE_UNDER = { x: 520, y: 175, gap: 320 };

/** 0 face-on, 1 fully tipped back. */
export function layerTilt(t: number) {
  return track(t, [[0, 0], [SCENE.oneTag + 0.15, 0], [SCENE.oneTag + 1.45, 1, inOutCubic], [T.formBack - 1.25, 1], [T.formBack - 0.2, 0, inOutCubic]]);
}

/**
 * The camera turns about a pivot in window pixels: the window's center face-on, and once tipped, the
 * middle of the app and its code layer together, pushed in close.
 */
function pivot(t: number) {
  const pl = winPlace(t), k = layerTilt(t);
  return { x: WIN_W / 2 + (690 - WIN_W / 2) * k, y: pl.H / 2 + (330 - pl.H / 2) * k };
}

function camera3d(t: number) {
  const k = layerTilt(t), pl = winPlace(t);
  // A slow drift in while tipped, so the shot breathes.
  const drift = k * prog(t, SCENE.oneTag + 1.45, T.formBack - 1.25);
  const persp = new DOMMatrix();
  persp.m34 = -1 / PERSPECTIVE;
  const s = pl.s * (1 + 0.5 * k + 0.08 * drift);
  return new DOMMatrix().translate(pl.cx, pl.cy - 40 * k).multiply(persp)
    .rotate(44 * k, 0, 0).rotate(0, 0, -20 * k - 5 * drift).scale(s, s, s);
}

/** Window pixels → screen, as a CSS matrix and a point projector. */
export function appMatrix(t: number) {
  const p = pivot(t);
  return camera3d(t).translate(-p.x, -p.y, 0);
}
export function codeMatrix(t: number) {
  const p = pivot(t), k = layerTilt(t);
  return camera3d(t).translate(-p.x + CODE_UNDER.x, -p.y + CODE_UNDER.y, -CODE_UNDER.gap * k);
}
export function project(m: DOMMatrix, x: number, y: number) {
  const p = m.transformPoint(new DOMPoint(x, y, 0, 1));
  return { x: p.x / p.w, y: p.y / p.w };
}

export type Place = ReturnType<typeof winPlace>;
/** Window pixels → screen (follows the 3D layer camera too). */
export const toFilm = (p: { x: number; y: number }, _pl: Place, t?: number) => {
  if (t !== undefined) return project(appMatrix(t), p.x, p.y);
  return { x: _pl.left + p.x * _pl.s, y: _pl.top + p.y * _pl.s };
};

/** A field's input box on screen (face-on shots). */
export function fieldOnScreen(i: number, t: number) {
  const pl = winPlace(t), b = fieldBox(i, pl.open);
  return { x: pl.left + b.x * pl.s, y: pl.top + b.y * pl.s, w: b.w * pl.s, h: b.h * pl.s };
}

/** The window's church field on screen: where the hero search box lands. */
export function churchFieldOnScreen(t: number) {
  const pl = winPlace(t);
  return { x: pl.left + MAIN_X * pl.s, y: pl.top + CHURCH_Y * pl.s, w: MAIN_W * pl.s, h: CHURCH_H * pl.s, s: pl.s };
}

/** The look the window wears: plum, then two token swaps, then back to plum for the fan. */
export const WIPES: { at: number; from: Look; to: Look }[] = [
  { at: T.teal, from: LOOKS.plum, to: LOOKS.teal },
  { at: T.amber, from: LOOKS.teal, to: LOOKS.amber },
  { at: T.fan, from: LOOKS.amber, to: LOOKS.plum },
];
export const WIPE_DUR = 0.6;

/** The hero search box: centered in the sky above Dallas. */
export const HERO_BOX = { x: 557, y: 248, w: 806.4, h: 84, s: 1.4 };
