// Colors and copy, taken from the site (site/site.css) and the widget (packages/sdk/src/element.ts,
// packages/sdk/src/strings.ts) so the film shows the real product.

import { EN } from "../../../packages/sdk/src/strings.ts";

export const STR = EN;

export type RGBA = [number, number, number, number];

export function rgba(c: string): RGBA {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`color ${c}`);
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
}

export const css = ([r, g, b, a]: RGBA) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`;

/** Mix two colors, k = 0 gives a. */
export function mixc(a: string, b: string, k: number): string {
  const x = rgba(a), y = rgba(b);
  return css([0, 1, 2, 3].map((i) => x[i] + (y[i] - x[i]) * k) as RGBA);
}

/** The widget's tokens: the hero's dark glass, and the default light look inside an app. */
export const WIDGET = {
  hero: {
    bg: "rgba(255,255,255,0.05)", text: "#ffffff", inputBorder: "rgba(255,255,255,0.14)", border: "rgba(255,255,255,0.10)",
    popover: "#110C22", accent: "#C4B5FD", active: "rgba(167,139,250,0.16)", muted: "rgba(239,237,253,0.55)",
  },
  app: {
    bg: "#ffffff", text: "#18181b", inputBorder: "#a1a1aa", border: "#d4d4d8",
    popover: "#ffffff", accent: "#7C3AED", active: "#f3effe", muted: "#52525b",
  },
} as const;

export type WidgetLook = { -readonly [K in keyof typeof WIDGET.hero]: string };

export function widgetMix(k: number, accent?: string): WidgetLook {
  const out = {} as WidgetLook;
  for (const key of Object.keys(WIDGET.hero) as (keyof WidgetLook)[]) {
    out[key] = mixc(WIDGET.hero[key], key === "accent" && accent ? accent : WIDGET.app[key], k);
  }
  return out;
}

/** The app window's light theme (site.css :root) and the three looks from the homepage swatches. */
export const APP = {
  panel: "#FFFFFF", frame: "#EFEFF1", line: "#E4E4E7", line2: "#D4D4D8", text: "#111014", text2: "#3F3F46", muted: "#71717A",
};

export type Look = { name: string; accent: string; radius: number };
export const LOOKS: Record<"plum" | "teal" | "amber", Look> = {
  plum: { name: "Plum", accent: "#7C3AED", radius: 8 },
  teal: { name: "Teal", accent: "#0F766E", radius: 999 },
  amber: { name: "Amber", accent: "#B45309", radius: 2 },
};

/** The demo church. Fictional, with a 555 number, matching the site's own mockups. */
export const CHURCH = {
  name: "Grace Community Church",
  street: "1420 Elm St",
  city: "Dallas",
  region: "Texas",
  website: "gracecommunity.church",
  phone: "(214) 555-0142",
  times: "Sun 9:00 am",
  fixedTimes: "Sun 10:30 am",
  location: "1420 Elm St, Dallas, Texas",
};

export const RESULTS = [
  { name: CHURCH.name, sub: CHURCH.location, d: "1.2 km", lat: 32.78, lng: -96.8 },
  { name: "Grace Fellowship Dallas", sub: "Dallas, Texas", d: "3.8 km", lat: 32.81, lng: -96.77 },
  { name: "Trinity Chapel", sub: "Dallas, Texas", d: "5.1 km", lat: 32.75, lng: -96.84 },
  { name: "Hope Church Uptown", sub: "Dallas, Texas", d: "6.4 km", lat: 32.8, lng: -96.81 },
  { name: "St. Mark's Parish", sub: "Dallas, Texas", d: "7.9 km", lat: 32.74, lng: -96.76 },
];

/**
 * What the search shows as the query grows, nearest first, like the real widget: names starting
 * "chu" near Dallas, then (once "church in da" reads as a place) churches in Dallas, then the settled
 * list when typing pauses.
 */
export const RESULT_STAGES = [
  [
    { name: "Christ Church Dallas", sub: "Dallas, Texas", d: "2.4 km", lat: 32.79, lng: -96.78 },
    { name: "Churchill Way Baptist", sub: "Dallas, Texas", d: "6.8 km", lat: 32.89, lng: -96.79 },
    { name: "Church of the Living Water", sub: "Irving, Texas", d: "18 km", lat: 32.81, lng: -96.95 },
    { name: "Church on the Hill", sub: "Garland, Texas", d: "21 km", lat: 32.91, lng: -96.64 },
    { name: "Church of the Redeemer", sub: "Plano, Texas", d: "27 km", lat: 33.02, lng: -96.7 },
  ],
  [
    { name: CHURCH.name, sub: CHURCH.location, d: "1.2 km", lat: 32.78, lng: -96.8 },
    { name: "Christ Church Dallas", sub: "Dallas, Texas", d: "2.4 km", lat: 32.79, lng: -96.78 },
    { name: "Grace Fellowship Dallas", sub: "Dallas, Texas", d: "3.8 km", lat: 32.81, lng: -96.77 },
    { name: "Trinity Chapel", sub: "Dallas, Texas", d: "5.1 km", lat: 32.75, lng: -96.84 },
    { name: "Churchill Way Baptist", sub: "Dallas, Texas", d: "6.8 km", lat: 32.89, lng: -96.79 },
  ],
  RESULTS,
];

/** The fields the app tags, in the order Lookup fills them. */
export const FORM_FIELDS = [
  { label: "Church name", value: CHURCH.name, key: "name" },
  { label: "Street", value: CHURCH.street, key: "street" },
  { label: "City", value: CHURCH.city, key: "city" },
  { label: "Region", value: CHURCH.region, key: "regionName" },
  { label: "Website", value: CHURCH.website, key: "website" },
  { label: "Phone", value: CHURCH.phone, key: "phone" },
  { label: "Service times", value: CHURCH.times, key: "serviceTimes" },
] as const;
