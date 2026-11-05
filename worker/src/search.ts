// The lexical search pipeline: parse, resolve place, query rungs, then correct typos or relax
// only when results are short.
import { allTokens, anyToken, combine, geoAny, rungs, RUNG_SQL, type Scope } from "./match.ts";
import { parseQuery, placeKeys, requiredTokens, STOPWORDS } from "./parse.ts";
import { tokenize } from "./project.ts";
import { BAND, km, rank, type Candidate } from "./rank.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";
import { lookupKeys, MIN_TYPO_LENGTH, pickCorrection, type Candidate as VocabCandidate } from "./vocab.ts";
import { COMMON_TOKENS } from "./common.generated.ts";
import type { EmbedEnv } from "./embed.ts";
import { semanticIds, SEMANTIC_TIMEOUT_MS, withTimeout } from "./semantic.ts";

/** Below this many distinct results, a query is short and may correct or relax. */
export const SHORT_RESULTS = 3;
/** A token this rare may itself be a typo stored in a name, so it can still be corrected. */
const RARE_DF = 5;
const RARE_RATIO = 20;
const MAX_KEYS = 90;
const MAX_CORRECTED = 3;
/** Results further than this from a place the person named rank below everything inside it. */
const PLACE_KM = 75;
/** Semantic search runs only on settled queries at least this long. */
export const SEMANTIC_MIN_LENGTH = 4;

export interface SearchInput {
  q: string;
  near?: string | null;
  lat?: number | null;
  lng?: number | null;
  country?: string | null;
  region?: string | null;
  limit: number;
  /** The person stopped typing. Only then may the semantic path run. */
  settled?: boolean;
  /** Present when semantic search is enabled and this caller is within its rate limit. */
  semantic?: EmbedEnv | null;
  /** Request location. Used in memory only, and never when geo=off. */
  user?: { lat: number | null; lng: number | null; country: string | null } | null;
}

export interface SearchRow {
  rid: number; id: string; name: string; street: string | null; city: string | null; near: string | null;
  region: string; country: string; lat: number; lng: number; denomination: string | null; completeness: number;
}

export interface SearchResult {
  results: ReturnType<typeof present>[];
  place: { name: string; region: string; country: string } | null;
  corrected: string | null;
  degraded: boolean;
  /** Whether semantic search ran: "used", "skipped" (every word matched, or the query was too short), "off", or "failed". */
  semantic: "used" | "skipped" | "off" | "failed";
  timing: { statements: number; d1Ms: number; aiMs: number };
}

type Db = D1Database | D1DatabaseSession;

interface Run { db: Db; statements: number; d1Ms: number }

async function batch<T>(run: Run, stmts: { sql: string; params: unknown[] }[]): Promise<T[][]> {
  if (!stmts.length) return [];
  const t0 = Date.now();
  const res = await run.db.batch<T>(stmts.map((s) => run.db.prepare(s.sql).bind(...s.params)));
  run.d1Ms += Date.now() - t0;
  run.statements += stmts.length;
  return res.map((r) => r.results);
}

const searchStmt = (match: string) => ({ sql: RUNG_SQL, params: [match] });

function toCandidate(row: SearchRow, flags: Pick<Candidate, "corrected" | "partial" | "semanticOnly" | "semanticRank"> = {}): SearchRow & Candidate {
  return {
    ...row, ...flags,
    regionName: REGIONS[row.region]?.n ?? row.region,
    countryName: COUNTRIES[row.country] ?? row.country,
  };
}

function present(r: ReturnType<typeof rank<SearchRow & Candidate>>[number]) {
  const c = r.item;
  return {
    id: c.id,
    name: c.name,
    // One line for display, e.g. "Grace Church, 241 St Davids Road, Thorold, Ontario".
    label: `${c.name}, ${locationLabel(c)}`,
    locationLabel: locationLabel(c),
    street: c.street,
    city: c.city,
    nearestPlace: c.city ? null : c.near,
    region: c.region,
    regionName: c.regionName,
    country: c.country,
    countryName: c.countryName,
    latitude: c.lat,
    longitude: c.lng,
    denomination: c.denomination,
    completeness: c.completeness,
    distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm * 10) / 10,
    band: r.band,
    source: c.semanticOnly ? "semantic" : c.semanticRank ? "both" : "lexical",
  };
}

/** Street and city when known, else city or nearest place with the region. */
export function locationLabel(c: { street: string | null; city: string | null; near: string | null; regionName: string; countryName: string; region: string }): string {
  if (c.street && c.city) return `${c.street}, ${c.city}, ${c.regionName}`;
  if (c.city) return `${c.city}, ${c.regionName}`;
  if (c.near) return `near ${c.near}, ${c.regionName}`;
  return `${c.regionName}, ${c.countryName}`;
}

interface PlaceRow { key: string; name: string; region: string; country: string; lat: number; lng: number; n: number }

async function resolvePlace(run: Run, key: string, regionHint: string | null, countryHint: string | null, preferCc: string | null): Promise<PlaceRow | null> {
  const keys = placeKeys(key);
  const [rows] = await batch<PlaceRow>(run, [{
    sql: `SELECT key, name, region, country, lat, lng, n FROM places WHERE key IN (${keys.map(() => "?").join(",")}) ORDER BY n DESC LIMIT 30`,
    params: keys,
  }]);
  let best: PlaceRow | null = null, bestScore = -1;
  for (const p of rows ?? []) {
    if (regionHint && p.region !== regionHint) continue;
    if (countryHint && p.country !== countryHint) continue;
    const score = p.n * (preferCc && p.country === preferCc ? 5 : 1);
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return best;
}

/** For each token that can't match anything, or barely does, find its likely spelling. */
async function correctTokens(run: Run, tokens: string[]): Promise<string[] | null> {
  const eligible = tokens.map((t, i) => ({ t, i })).filter(({ t }) => t.length >= MIN_TYPO_LENGTH && !/^\d+$/.test(t) && !STOPWORDS.has(t)).slice(0, MAX_CORRECTED);
  if (!eligible.length) return null;
  const stmts = eligible.flatMap(({ t, i }) => [
    { sql: "SELECT df FROM vocab WHERE token = ?", params: [t] },
    // Is this a prefix of something real? Only the last token is being typed.
    { sql: "SELECT 1 AS hit FROM vocab WHERE token > ? AND token < ? LIMIT 1", params: i === tokens.length - 1 ? [t, t + "￿"] : ["", ""] },
    {
      sql: `SELECT DISTINCT v.token, v.df FROM vocab_del d JOIN vocab v ON v.id = d.id WHERE d.del IN (${lookupKeys(t).slice(0, MAX_KEYS).map(() => "?").join(",")})`,
      params: lookupKeys(t).slice(0, MAX_KEYS),
    },
  ]);
  const res = await batch<{ df?: number; hit?: number; token?: string }>(run, stmts);
  const out = [...tokens];
  let changed = false;
  eligible.forEach(({ t, i }, e) => {
    const df = res[e * 3]?.[0]?.df ?? 0;
    const isPrefix = (res[e * 3 + 1]?.length ?? 0) > 0;
    if (isPrefix && df === 0) return;
    if (df >= RARE_DF) return;
    const candidates = (res[e * 3 + 2] ?? []).filter((c) => c.token && (c.df ?? 0) >= Math.max(1, df * RARE_RATIO)) as VocabCandidate[];
    const fix = pickCorrection(t, candidates);
    if (fix) { out[i] = fix; changed = true; }
  });
  return changed ? out : null;
}

export async function search(db: Db, input: SearchInput): Promise<SearchResult> {
  const run: Run = { db, statements: 0, d1Ms: 0 };
  const preferCc = input.country ?? input.user?.country ?? null;
  const parsed = parseQuery(input.q, preferCc ?? undefined);

  let tokens = parsed.tokens;
  let placeRow: PlaceRow | null = null;
  let regionHint = parsed.regionHint;
  let countryHint = parsed.countryHint;

  const nearKey = input.near ? tokenize(input.near).join(" ") : null;
  const placeKey = nearKey || parsed.placeKey;
  if (placeKey) {
    placeRow = await resolvePlace(run, placeKey, regionHint, countryHint, preferCc);
    if (!placeRow && parsed.placeKey && !regionHint && !countryHint) tokens = parsed.fallbackTokens;
    if (!placeRow && parsed.placeKey && (regionHint || countryHint)) {
      // The region was understood but the city wasn't: keep its words as search text.
      tokens = [...parsed.tokens, ...parsed.placeKey.split(" ")];
    }
  }

  const center = placeRow
    ? { lat: placeRow.lat, lng: placeRow.lng }
    : input.lat != null && input.lng != null
      ? { lat: input.lat, lng: input.lng }
      : input.user?.lat != null && input.user?.lng != null && !regionHint && !countryHint
        ? { lat: input.user.lat, lng: input.user.lng }
        : null;

  const filter = combine(
    input.region ? geoAny(["r" + input.region.toLowerCase()]) : null,
    input.country ? geoAny(["cc" + input.country.toLowerCase()]) : null,
  );
  const scope: Scope = {
    center,
    region: regionHint ?? placeRow?.region ?? null,
    country: input.country ? null : countryHint ?? placeRow?.country ?? input.user?.country ?? null,
    filter,
  };

  // A completed place means the words before it are finished, but the prefix costs nothing and stays useful.
  const required = requiredTokens(tokens);
  const text = allTokens(required, true);
  if (!text && !scope.center && !scope.region && !scope.country && !filter) {
    return { results: [], place: null, corrected: null, degraded: false, semantic: "skipped", timing: { statements: run.statements, d1Ms: run.d1Ms, aiMs: 0 } };
  }

  const found = new Map<number, SearchRow & Candidate>();
  const addRows = (rows: SearchRow[][], flags: Pick<Candidate, "corrected" | "partial"> = {}) => {
    for (const set of rows) for (const row of set) if (!found.has(row.rid)) found.set(row.rid, toCandidate(row, flags));
  };

  const rungList = rungs(text, scope);
  addRows(await batch<SearchRow>(run, rungList.map(searchStmt)));

  let corrected: string | null = null;
  let degraded = false;
  try {
    // Nothing nearby or in the country: look everywhere, if the query was scoped at all.
    if (found.size < input.limit && text && !filter && (scope.center || scope.region || scope.country)) {
      addRows(await batch<SearchRow>(run, [searchStmt(text)]));
    }
    if (found.size < SHORT_RESULTS && required.length) {
      const fixed = await correctTokens(run, required);
      if (fixed) {
        const fixedText = allTokens(fixed, false);
        const list = [...rungs(fixedText, scope), ...(filter ? [] : [fixedText!])];
        addRows(await batch<SearchRow>(run, [...new Set(list)].map(searchStmt)), { corrected: true });
        if (found.size) { corrected = fixed.join(" "); tokens = fixed; }
      }
    }
    if (found.size < SHORT_RESULTS && required.length > 1) {
      const informative = required.filter((t) => !COMMON_TOKENS.has(t));
      const relaxed = anyToken(informative.length ? informative : required, true);
      const list = [...rungs(relaxed, scope), ...(filter ? [] : [relaxed!])];
      addRows(await batch<SearchRow>(run, [...new Set(list)].map(searchStmt)), { partial: true });
    }
  } catch (e) {
    // The first lexical pass worked, so return it rather than failing the request.
    if (!found.size) throw e;
    degraded = true;
  }

  // A region hint with no city still orders by closeness to that region, without claiming a distance.
  const hinted = regionHint ? REGIONS[regionHint] : undefined;
  const rankCenter = center ?? (hinted ? { lat: hinted.la, lng: hinted.lo } : null);
  const isOutside = (c: SearchRow & Candidate): boolean => {
    if (placeRow) return km(placeRow.lat, placeRow.lng, c.lat, c.lng) > PLACE_KM;
    if (regionHint) return c.region !== regionHint;
    if (countryHint) return c.country !== countryHint;
    return false;
  };
  let ranked = rank([...found.values()], tokens, rankCenter, isOutside);

  let semantic: SearchResult["semantic"] = input.semantic ? "skipped" : "off";
  let aiMs = 0;
  // Semantic search runs only when no word result matches every word. In the milestone 3 eval it never
  // changed a query that lexical search had fully matched, so elsewhere it was cost and latency for nothing.
  const weak = !ranked.length || ranked[0]!.band >= BAND.partial;
  if (input.semantic && input.settled && input.q.trim().length >= SEMANTIC_MIN_LENGTH && weak) {
    const t0 = Date.now();
    try {
      // Place words are already a filter, so embed only what's left.
      const text = placeRow || parsed.regionHint || parsed.countryHint ? tokens.join(" ") : input.q.trim();
      const hits = text ? await withTimeout((async () => {
        const ids = await semanticIds(input.semantic!, text, {
          country: input.country ?? (input.region ? null : countryHint ?? null),
          region: input.region ?? (placeRow ? null : regionHint ?? null),
          near: placeRow ? { lat: placeRow.lat, lng: placeRow.lng } : null,
        });
        if (!ids.length) return [];
        const [rows] = await batch<SearchRow>(run, [{
          sql: `SELECT rowid AS rid, id, name, street, city, near, region, country, lat, lng, denomination, completeness FROM church WHERE id IN (${ids.map(() => "?").join(",")})`,
          params: ids.map((i) => i.id),
        }]);
        const order = new Map(ids.map((h, i) => [h.id, i + 1]));
        return (rows ?? []).map((r) => ({ row: r, rank: order.get(r.id)! }));
      })(), SEMANTIC_TIMEOUT_MS) : [];
      for (const { row, rank: semanticRank } of hits) {
        const existing = found.get(row.rid);
        if (existing) existing.semanticRank = semanticRank;
        else found.set(row.rid, toCandidate(row, { semanticOnly: true, semanticRank }));
      }
      ranked = rank([...found.values()], tokens, rankCenter, isOutside);
      semantic = "used";
    } catch {
      semantic = "failed";
      degraded = true;
    }
    aiMs = Date.now() - t0;
  }
  return {
    results: ranked.slice(0, input.limit).map((r) => present(center ? r : { ...r, distanceKm: null })),
    place: placeRow ? { name: placeRow.name, region: placeRow.region, country: placeRow.country } : null,
    corrected,
    degraded,
    semantic,
    timing: { statements: run.statements, d1Ms: run.d1Ms, aiMs },
  };
}
