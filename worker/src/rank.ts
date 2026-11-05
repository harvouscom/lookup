// Ranking. Strict bands first, so a complete listing can never beat a clearly better name match.
// Pure, so the guardrails can be tested without a database.
import { canonical, STOPWORDS } from "./parse.ts";
import { tokenize } from "./project.ts";
import { COMMON_TOKENS } from "./common.generated.ts";

export const BAND = { exact: 0, inOrder: 1, anyOrder: 2, partial: 3 } as const;

export interface Candidate {
  rid: number;
  name: string;
  city: string | null;
  near: string | null;
  regionName: string;
  countryName: string;
  lat: number;
  lng: number;
  completeness: number;
  /** Found by a corrected query, which can be at best any-order. */
  corrected?: boolean;
  /** Found by the any-token fallback. */
  partial?: boolean;
  /** 1-based rank from semantic search, if it found this listing. */
  semanticRank?: number;
  /** Found only by semantic search. */
  semanticOnly?: boolean;
}

/** Reciprocal rank fusion constant. Larger values flatten the difference between ranks. */
export const RRF_K = 60;

export const km = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180), y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111.32;
};

const weight = (t: string) => (COMMON_TOKENS.has(t) || STOPWORDS.has(t) ? 0.15 : 1);

/** @param tokens the query's tokens. The last is treated as a prefix. */
export function band(tokens: string[], nameTokens: string[], locTokens: string[]): number {
  const q = tokens.map(canonical);
  const name = nameTokens.map(canonical);
  if (!q.length) return BAND.anyOrder;
  if (q.length === name.length && q.every((t, i) => t === name[i])) return BAND.exact;
  const matches = (t: string, n: string, last: boolean) => t === n || (last && n.startsWith(t));
  const req = q.filter((t, i) => !STOPWORDS.has(t) || i === q.length - 1);
  const list = req.length ? req : q;
  let pos = 0, inOrder = true;
  for (let i = 0; i < list.length && inOrder; i++) {
    const last = i === list.length - 1;
    while (pos < name.length && !matches(list[i]!, name[pos]!, last)) pos++;
    if (pos >= name.length) inOrder = false;
    pos++;
  }
  if (inOrder) return BAND.inOrder;
  const hay = [...name, ...locTokens.map(canonical)];
  const every = list.every((t, i) => hay.some((n) => matches(t, n, i === list.length - 1)));
  return every ? BAND.anyOrder : BAND.partial;
}

function textScore(tokens: string[], nameTokens: string[]): number {
  const q = tokens.map(canonical), name = nameTokens.map(canonical);
  const total = q.reduce((s, t) => s + weight(t), 0);
  if (!total) return 0;
  let hit = 0;
  q.forEach((t, i) => { if (name.some((n) => n === t || (i === q.length - 1 && n.startsWith(t)))) hit += weight(t); });
  const nameTotal = name.reduce((s, t) => s + weight(t), 0) || 1;
  return 0.7 * (hit / total) + 0.3 * Math.min(1, hit / nameTotal);
}

export interface Ranked<T> { item: T; band: number; score: number; distanceKm: number | null }

/** @param isOutside true for a result outside a place the person named. It drops to the lowest band. */
export function rank<T extends Candidate>(items: T[], tokens: string[], center: { lat: number; lng: number } | null, isOutside?: (item: T) => boolean): Ranked<T>[] {
  const out = items.map((item) => {
    const nameTokens = tokenize(item.name);
    const locTokens = tokenize([item.city ?? item.near ?? "", item.regionName, item.countryName].join(" "));
    let b = band(tokens, nameTokens, locTokens);
    if (item.corrected) b = Math.max(b, BAND.anyOrder);
    if (item.partial || item.semanticOnly || isOutside?.(item)) b = BAND.partial;
    const distanceKm = center ? km(center.lat, center.lng, item.lat, item.lng) : null;
    const proximity = distanceKm === null ? 0 : 1 / (1 + distanceKm / 25);
    const score = 0.6 * textScore(tokens, nameTokens) + 0.25 * proximity + 0.15 * (item.completeness / 100);
    return { item, band: b, score, distanceKm };
  });
  out.sort((a, b) => a.band - b.band || b.score - a.score || a.item.rid - b.item.rid);
  // Inside the lowest band, fuse the lexical order with the semantic order. Higher bands are untouched,
  // so semantic search can add results but never reorder a real name match.
  const low = out.filter((r) => r.band === BAND.partial);
  if (low.some((r) => r.item.semanticRank)) {
    const lexical = low.filter((r) => !r.item.semanticOnly);
    const rrf = (r: Ranked<T>) => {
      const li = lexical.indexOf(r);
      return (li >= 0 ? 1 / (RRF_K + li + 1) : 0) + (r.item.semanticRank ? 1 / (RRF_K + r.item.semanticRank) : 0);
    };
    const fused = [...low].sort((a, b) => rrf(b) - rrf(a) || a.item.rid - b.item.rid);
    return [...out.filter((r) => r.band !== BAND.partial), ...fused];
  }
  return out;
}
