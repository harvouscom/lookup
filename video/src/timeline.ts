// The film's clock: every visual beat and sound cue, in seconds from the start. Both the picture
// (src/) and the score script (scripts/score.ts) read this file, so cuts and sounds can't drift apart.
// Plain TypeScript with no runtime imports, so Node can run it directly.

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** Length of the story, in story seconds (the time every beat below is written in). */
export const SECONDS = 74.5;

/**
 * Pacing. The story is written at a comfortable speed; the film plays it back faster where little is
 * happening and at full weight where it matters. Each span plays at `speed`× (story seconds per film
 * second), with half-second eased changes between spans so motion never lurches.
 */
const WARP: [from: number, to: number, speed: number][] = [
  [0, 5.5, 1.3],      // first light
  [5.5, 8.8, 1.5],    // headline
  [8.8, 12.0, 1.3],   // rain and gather
  [12.0, 16.3, 1.15], // the search
  [16.3, 19.1, 1.25], // window builds
  [19.1, 21.8, 1.1],  // the fill: full weight
  [21.8, 24.7, 1.5],  // filled-form hold
  [24.7, 30.3, 1.4],  // styles and the fan
  [30.3, 38.3, 1.12], // the code layer: full weight
  [38.3, 47.3, 1.35], // the fix
  [47.3, 51.6, 1.05], // home to Dallas: full weight
  [51.6, 58.4, 1.35], // every app
  [58.4, 66.4, 1.55], // better data
  [66.4, 74.5, 1.25], // Lookup
];
const STEP = 1 / 600;
function speedAt(s: number): number {
  let v = WARP[0][2];
  for (let i = 1; i < WARP.length; i++) {
    const at = WARP[i][0], k = Math.min(1, Math.max(0, (s - at + 0.25) / 0.5));
    v += (WARP[i][2] - WARP[i - 1][2]) * k * k * (3 - 2 * k);
  }
  return v;
}
// Film time at each story step, integrated once.
const OUT: number[] = [0];
for (let s = 0; s < SECONDS + 1; s += STEP) OUT.push(OUT[OUT.length - 1] + STEP / speedAt(s + STEP / 2));

/** Story time → film time. */
export function toOut(s: number): number {
  const i = Math.max(0, Math.min(OUT.length - 2, Math.floor(s / STEP)));
  return OUT[i] + (OUT[i + 1] - OUT[i]) * (s / STEP - i);
}
/** Film time → story time. */
export function toStory(o: number): number {
  let lo = 0, hi = OUT.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (OUT[m] <= o) lo = m; else hi = m; }
  return (lo + (o - OUT[lo]) / Math.max(1e-9, OUT[lo + 1] - OUT[lo])) * STEP;
}

/** The film's real length. */
export const OUT_SECONDS = Math.ceil(toOut(SECONDS) * 10) / 10;
export const DURATION = Math.round(OUT_SECONDS * FPS);

/** The query typed into the search box, one key at a time; results refresh as it grows. */
export const QUERY = "church in dallas";
const TYPE = 12.0;
const KEY_GAP = 0.1;
/** When the nth character (1-based) of the query lands. */
export const keyAt = (n: number) => TYPE + (n - 1) * KEY_GAP;

// Later acts are laid out relative to the beats before them, so tightening one moves the rest.
const A = 16.3 - 24.55;   // straight from the headline into the search
const STYLES = 30.05 + A + 2.9; // a short hold on the filled form, then the token swaps
const B = STYLES + 5.6 - 45; // the swaps and fan are quicker
const C = 1.1;             // a longer, deeper dive into Dallas

/** Scene starts, matching the storyboard. */
export const SCENE = {
  firstLight: 0,
  everyChurch: 5.5,
  find: 8.8,
  type: 12,
  fill: 28 + A,
  styles: STYLES,
  oneTag: 45 + B,
  fix: 53 + B,
  source: 62 + B,
  better: 72 + B + C,
  outro: 80 + B + C,
  end: SECONDS,
} as const;

/** Named beats. Scenes animate between these; the score lands sounds on them. */
export const T = {
  // 1 · First light
  pixelIn: 0.35,
  scatter: 1.45,
  globeUp: 4.8,
  rimStart: 3.6,
  rimEnd: 5.3,
  auroraIn: 4.4,

  // 2 · Every church: the headline, while the globe lights up densest places first
  headline: 5.6,
  countStart: 5.8,
  countEnd: 8.6,

  // 3 · Find: the headline rains across the globe, then specks from all over it gather into the search box
  dissolve: 8.8,
  liftStart: 9.6,
  liftEnd: 11.05,
  boxIn: 10.75,
  /** The map flies to Dallas once the query names it (see placeResults). */
  flyStart: 12.0 + 11 * 0.1 + 0.1,
  flyEnd: 12.0 + 11 * 0.1 + 0.1 + 2.4,
  localGlow: 12.0 + 11 * 0.1 + 0.1 + 2.1,

  // 4 · Type: results arrive after three letters and refresh as the query grows
  typeStart: TYPE,
  keyGap: KEY_GAP,
  typeEnd: keyAt(QUERY.length) + KEY_GAP,
  results: keyAt(3) + 0.2,
  /** "church in da": the place is recognized and results move to Dallas. */
  placeResults: keyAt(12) + 0.18,
  /** The settled results once typing pauses. */
  finalResults: keyAt(QUERY.length) + 0.32,
  arrowDown: 15.45,
  enter: 16.3,

  // 5 · Fill
  windowIn: 25.15 + A,
  burst: 27.35 + A,
  fieldsStart: 28.3 + A,
  fieldGap: 0.22,
  filledNote: 30.05 + A,
  fillCaption: 30.2 + A,

  // 6 · Your styles
  teal: STYLES,
  amber: STYLES + 1.15,
  fan: STYLES + 2.3,
  stylesCaption: STYLES + 2.6,

  // 7 · One tag
  codeIn: 45.2 + B,
  codeTypeStart: 45.9 + B,
  codeTypeEnd: 49.3 + B,
  links: 49.6 + B,
  tagCaption: 49.8 + B,

  // 8 · Fix
  formBack: 53.0 + B,
  focusTimes: 54.3 + B,
  deleteStart: 54.75 + B,
  retypeStart: 55.55 + B,
  panelIn: 56.55 + B,
  shareClick: 58.15 + B,
  live: 59.0 + B,
  fixCaption: 59.1 + B,

  // 9 · Back to the source: a deep dive into Dallas, then all the way out
  collapse: 62.0 + B,
  arcStart: 63.0 + B,
  impact: 64.6 + B,
  pullBack: 65.2 + B + C,
  orbitsIn: 66.4 + B + C,
  review: 70.2 + B + C,
  sourceCaption: 67.2 + B + C,

  // 10 · Better for everyone
  brighten: 72.0 + B + C,
  outflow: 74.0 + B + C,
  better1: 72.6 + B + C,
  better2: 74.2 + B + C,
  better3: 75.8 + B + C,

  // 11 · Lookup
  ctaMove: 80.0 + B + C,
  mark: 81.0 + B + C,
  wordmark: 82.4 + B + C,
  url: 83.6 + B + C,
  fadeOut: 86.3 + B + C,
} as const;

/** The seven fields Lookup fills, in fill order. */
export const FIELDS = 7;
export const fieldAt = (i: number) => T.fieldsStart + i * T.fieldGap;

/** The keys typed while fixing service times: backspaces over "9:00 am", then "10:30 am". */
export const FIX_DELETE = "9:00 am".length;
export const FIX_TYPE = "10:30 am";
export const FIX_KEY_GAP = 0.09;

/** Code typing: characters per second for the code panel. */
export const CODE_CPS = 120;

/** Sound cues, in seconds, for the score and the effects track. */
export type Cue = { at: number; kind: CueKind; i?: number; gain?: number };
export type CueKind =
  | "swell" | "scatter" | "shimmer" | "sparkle" | "whoosh" | "lift" | "clickIn" | "key" | "rows"
  | "select" | "build" | "burst" | "fill" | "done" | "swipe" | "fan" | "codeKey" | "link"
  | "backspace" | "panel" | "click" | "live" | "collapse" | "arc" | "impact" | "pullBack"
  | "stream" | "approve" | "brighten" | "resolve" | "tail"
  // Moments with their own voice:
  | "gather" | "space" | "locate" | "zoom" | "card" | "flip" | "synced" | "stroke" | "count";

export function cues(): Cue[] {
  const c: Cue[] = [];
  c.push({ at: 0, kind: "swell" });
  c.push({ at: T.scatter, kind: "scatter" });
  c.push({ at: T.rimStart, kind: "shimmer" });
  c.push({ at: T.countStart, kind: "sparkle" });
  c.push({ at: T.flyStart, kind: "whoosh" });
  c.push({ at: T.liftStart, kind: "gather" });
  c.push({ at: T.boxIn + 0.25, kind: "clickIn" });
  for (let i = 1; i <= QUERY.length; i++) c.push({ at: keyAt(i), kind: QUERY[i - 1] === " " ? "space" : "key", i });
  c.push({ at: T.placeResults, kind: "locate" });
  c.push({ at: T.flyStart, kind: "zoom" });
  c.push({ at: T.results, kind: "rows" });
  c.push({ at: T.placeResults, kind: "rows", i: 1 });
  c.push({ at: T.finalResults, kind: "rows", i: 2 });
  c.push({ at: T.arrowDown, kind: "key", i: 99 });
  c.push({ at: T.enter, kind: "select" });
  c.push({ at: T.windowIn, kind: "build" });
  c.push({ at: T.burst, kind: "burst" });
  for (let i = 0; i < FIELDS; i++) c.push({ at: fieldAt(i), kind: "fill", i });
  c.push({ at: T.filledNote, kind: "done" });
  c.push({ at: T.teal, kind: "swipe" });
  c.push({ at: T.amber, kind: "swipe", i: 1 });
  c.push({ at: T.fan, kind: "fan" });
  const codeKeys = Math.floor((T.codeTypeEnd - T.codeTypeStart) * 14);
  for (let i = 0; i < codeKeys; i++) c.push({ at: T.codeTypeStart + i / 14, kind: "codeKey", i });
  for (let i = 0; i < 3; i++) c.push({ at: T.links + i * 0.28, kind: "link", i });
  for (let i = 0; i < FIX_DELETE; i++) c.push({ at: T.deleteStart + i * FIX_KEY_GAP, kind: "backspace", i });
  for (let i = 0; i < FIX_TYPE.length; i++) c.push({ at: T.retypeStart + i * FIX_KEY_GAP, kind: "key", i: 50 + i });
  c.push({ at: T.panelIn, kind: "panel" });
  c.push({ at: T.shareClick, kind: "click" });
  c.push({ at: T.live, kind: "live" });
  c.push({ at: T.collapse, kind: "collapse" });
  c.push({ at: T.arcStart, kind: "arc" });
  c.push({ at: T.impact, kind: "impact" });
  c.push({ at: T.impact + 0.12, kind: "card" });
  c.push({ at: T.impact + 0.6, kind: "flip" });
  c.push({ at: T.pullBack, kind: "pullBack" });
  for (let i = 0; i < 9; i++) c.push({ at: T.orbitsIn + 0.6 + i * 0.47, kind: "stream", i });
  c.push({ at: T.review, kind: "approve" });
  c.push({ at: T.brighten, kind: "brighten" });
  for (let n = 0; n < 12; n++) c.push({ at: T.outflow + 1.0 + (n % 6) * 0.35 + Math.floor(n / 6) * 1.6, kind: "synced", i: n });
  c.push({ at: T.mark, kind: "resolve" });
  c.push({ at: T.mark + 0.25, kind: "stroke" });
  c.push({ at: T.url + 0.8, kind: "count" });
  c.push({ at: T.fadeOut - 0.4, kind: "tail" });
  return c.sort((a, b) => a.at - b.at);
}
