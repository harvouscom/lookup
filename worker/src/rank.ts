// Ranking. Pure, so the guardrails can be tested without a database.
//
// Without a location the person gave (none, or only the request's approximate location), bands come
// first, so a complete listing can never beat a clearly better name match. When they gave one (a
// point, or a place they typed), every listing that matches all the words shares one tier and
// distance counts: an exact name 300 km away shouldn't beat the same name with one more word next door.
import { STOPWORDS } from "./parse.ts";
import { fold, postalTokens, regionToken, tokenize } from "./project.ts";
import { COMMON_TOKENS } from "./common.generated.ts";
import { normalizeSeq, type SeqToken } from "./abbrev.ts";
import { GENERIC } from "./match.ts";

export const BAND = { exact: 0, inOrder: 1, anyOrder: 2, partial: 3 } as const;

export interface Candidate {
  rid: number;
  name: string;
  city: string | null;
  near: string | null;
  regionName: string;
  countryName: string;
  region?: string;
  country?: string;
  postalCode?: string | null;
  lat: number;
  lng: number;
  completeness: number;
  /** Found by a corrected query, which can be at best any-order. */
  corrected?: boolean;
  /** Found with every word as a prefix and generic words optional, which can be at best any-order. */
  prefixed?: boolean;
  /** Words to rank this row by, when it was found by a corrected query. */
  rankTokens?: string[];
  /** Found by the any-token fallback. */
  partial?: boolean;
  /** 1-based rank from semantic search, if it found this listing. */
  semanticRank?: number;
  /** Found only by semantic search. */
  semanticOnly?: boolean;
}

/**
 * Where the ranking center came from. "user" is a point the caller sent, "place" a place in the query,
 * "implicit" a city read from unmarked words. "ip" is the request's approximate location and "region"
 * a region's middle: those keep strict bands.
 */
export type CenterKind = "user" | "place" | "implicit" | "ip" | "region" | null;

export interface RankOptions {
  center?: { lat: number; lng: number } | null;
  centerKind?: CenterKind;
  /** Keys of the named place, for the in-city bonus. */
  placeKeys?: string[];
  /** True for a result outside a place the person named. It drops to the lowest band. */
  isOutside?: (item: Candidate) => boolean;
  /** A lowercase trailing code read softly. Rows in that region get a small bonus. */
  softRegion?: string | null;
  /** The person stopped typing, so a soft code is more likely a code than the start of a word. */
  settled?: boolean;
}

/** Reciprocal rank fusion constant. Larger values flatten the difference between ranks. */
export const RRF_K = 60;

export const km = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180), y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111.32;
};

const weight = (t: string) => (COMMON_TOKENS.has(t) || STOPWORDS.has(t) ? 0.15 : 1);
const PREFIX_MIN = 3;

function matcher(prefixAll: boolean) {
  return (q: SeqToken, n: SeqToken, last: boolean) =>
    q.t === n.t || ((last || (prefixAll && q.raw.length >= PREFIX_MIN)) && (n.t.startsWith(q.t) || n.raw.startsWith(q.raw)));
}

/**
 * @param tokens the query's tokens. The last is treated as a prefix.
 * @param opts.prefixAll every word of 3+ letters may be a prefix, and generic words may be missing.
 */
export function band(tokens: string[], nameTokens: string[], locTokens: string[], opts: { prefixAll?: boolean } = {}): number {
  const q = normalizeSeq(tokens);
  const name = normalizeSeq(nameTokens);
  if (!q.length) return BAND.anyOrder;
  if (q.length === name.length && q.every((t, i) => t.t === name[i]!.t)) return BAND.exact;
  const matches = matcher(Boolean(opts.prefixAll));
  let req = q.filter((t, i) => !STOPWORDS.has(t.t) || i === q.length - 1);
  if (opts.prefixAll && req.some((t) => !GENERIC.has(t.t))) req = req.filter((t) => !GENERIC.has(t.t));
  const list = req.length ? req : q;
  const lastQ = q[q.length - 1];
  let pos = 0, inOrder = true;
  for (let i = 0; i < list.length && inOrder; i++) {
    const last = list[i] === lastQ;
    while (pos < name.length && !matches(list[i]!, name[pos]!, last)) pos++;
    if (pos >= name.length) inOrder = false;
    pos++;
  }
  if (inOrder) return BAND.inOrder;
  const hay = [...name, ...normalizeSeq(locTokens)];
  const every = list.every((t) => hay.some((n) => matches(t, n, t === lastQ)));
  return every ? BAND.anyOrder : BAND.partial;
}

/** How much of the query the name (and, in the merged tier, the location) covers. */
function textParts(tokens: string[], nameTokens: string[], locTokens: string[], prefixAll: boolean) {
  const q = normalizeSeq(tokens), name = normalizeSeq(nameTokens), loc = normalizeSeq(locTokens);
  const matches = matcher(prefixAll);
  const total = q.reduce((s, t) => s + weight(t.t), 0);
  let nameHit = 0, anyHit = 0;
  q.forEach((t, i) => {
    const last = i === q.length - 1;
    if (name.some((n) => matches(t, n, last))) { nameHit += weight(t.t); anyHit += weight(t.t); }
    else if (loc.some((n) => matches(t, n, last))) anyHit += 0.8 * weight(t.t);
  });
  const nameTotal = name.reduce((s, t) => s + weight(t.t), 0) || 1;
  return { name: total ? nameHit / total : 0, any: total ? anyHit / total : 0, coverage: Math.min(1, nameHit / nameTotal) };
}

export interface Ranked<T> { item: T; band: number; score: number; distanceKm: number | null }

const MERGED: ReadonlySet<CenterKind> = new Set(["user", "place", "implicit"]);
const BAND_BONUS = [0.12, 0.05, 0, 0];

export function rank<T extends Candidate>(items: T[], tokens: string[], opts: RankOptions = {}): Ranked<T>[] {
  const { center = null, centerKind = center ? "user" : null, isOutside, softRegion = null, settled = false } = opts;
  const merged = Boolean(center) && MERGED.has(centerKind);
  const reach = centerKind === "user" ? 50 : 12;
  const cityKeys = new Set(opts.placeKeys ?? []);
  const out = items.map((item) => {
    const q = item.rankTokens ?? tokens;
    const nameTokens = tokenize(item.name);
    const locTokens = tokenize([item.city ?? item.near ?? "", ...postalTokens(item.postalCode, item.country ?? ""), item.regionName,
      item.region ? regionToken(item.region, item.country ?? "") ?? "" : "", item.countryName].join(" "));
    const inSoft = Boolean(softRegion && item.region === softRegion);
    // Settled on a soft code in its region: band by the other words, since the code was a code.
    const bandTokens = inSoft && settled && q.length > 1 ? q.slice(0, -1) : q;
    let b = band(bandTokens, nameTokens, locTokens, { prefixAll: item.prefixed });
    if (item.corrected || item.prefixed) b = Math.max(b, BAND.anyOrder);
    if (item.partial || item.semanticOnly || isOutside?.(item)) b = BAND.partial;
    const distanceKm = center ? km(center.lat, center.lng, item.lat, item.lng) : null;
    const text = textParts(bandTokens, nameTokens, locTokens, Boolean(item.prefixed));
    const softBonus = inSoft ? 0.05 : 0;
    let score: number;
    if (merged) {
      const prox = distanceKm === null ? 0 : 1 / (1 + (distanceKm / reach) ** 2);
      const place = fold(item.city ?? item.near ?? "");
      const inCity = cityKeys.size && cityKeys.has(tokenize(place).join(" ")) ? 1 : 0;
      score = 0.4 * text.any + 0.03 * text.coverage + BAND_BONUS[b]! + 0.3 * prox + 0.1 * inCity + 0.04 * (item.completeness / 100) + softBonus;
    } else {
      const proximity = distanceKm === null ? 0 : 1 / (1 + distanceKm / 25);
      score = 0.6 * (0.7 * text.name + 0.3 * text.coverage) + 0.25 * proximity + 0.15 * (item.completeness / 100) + softBonus;
    }
    return { item, band: b, score, distanceKm };
  });
  const tier = (r: Ranked<T>) => (merged ? (r.band === BAND.partial ? 1 : 0) : r.band);
  out.sort((a, b) => tier(a) - tier(b) || b.score - a.score || a.item.rid - b.item.rid);
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
