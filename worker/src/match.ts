// Builds FTS5 MATCH expressions. Tokens come from `tokenize`, so they hold only letters and numbers.
import { cellsAround } from "./project.ts";
import { STOPWORDS, variants } from "./parse.ts";
import { ABBREVIATIONS, expansions, findRuns } from "./abbrev.ts";

export const RUNG_LIMIT = 60;

export const RUNG_SQL = `SELECT c.rowid AS rid, c.id, c.name, c.street, c.city, c.near, c.postal_code, c.region, c.country, c.lat, c.lng, c.denomination, c.completeness
FROM (SELECT rowid FROM church_fts WHERE church_fts MATCH ?1 ORDER BY rowid LIMIT ${RUNG_LIMIT}) h
JOIN church c ON c.rowid = h.rowid`;

/** Words that name the kind of place, not the church. The widest fallback lets them go missing. */
export const GENERIC: ReadonlySet<string> = new Set(["church", "ch", "kirche", "iglesia", "eglise", "chiesa", "igreja", "kosciol", "kerk"]);
/** In the prefix-everywhere fallback, words this long get a `*`. Longer ones are past the prefix index. */
const PREFIX_MIN = 3, PREFIX_MAX = 8;

export interface TermOptions {
  /** Every word of PREFIX_MIN to PREFIX_MAX letters is a prefix, not only the last one. */
  prefixAll?: boolean;
  /** A trailing lowercase region code that also matches rows in that region. */
  softRegion?: string | null;
  /** Leave out generic words such as "church" when something else remains. */
  dropGeneric?: boolean;
}

/** One word: its spellings, any abbreviation it stands for, and a `*` on the typed form when it's a prefix. */
function word(token: string, prefix: boolean): string {
  const terms = variants(token).map((v) => `"${v}"${prefix && v === token ? "*" : ""}`);
  if (ABBREVIATIONS[token]) terms.push(...expansions(token));
  return terms.length > 1 ? `{name loc} : (${terms.join(" OR ")})` : `{name loc} : ${terms[0]}`;
}

/** Words in order; a spelled-out abbreviation also matches its short form ("united methodist" or "umc"). */
function sequence(tokens: string[], prefixes: boolean[], maxRun = Infinity): string[] {
  const runs = findRuns(tokens, maxRun);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    const run = runs.find((r) => r.start === i);
    if (!run) { out.push(word(tokens[i]!, prefixes[i]!)); i++; continue; }
    const inner = sequence(tokens.slice(run.start, run.end), prefixes.slice(run.start, run.end), run.end - run.start - 1);
    out.push(`((${inner.join(" AND ")}) OR {name loc} : "${run.abbr}")`);
    i = run.end;
  }
  return out;
}

/**
 * Every token required. The last one is a prefix unless the caller knows it is complete. Stopwords
 * drop out when something else remains, except inside a spelled-out abbreviation ("church of god").
 */
export function allTokens(tokens: string[], lastIsPrefix: boolean, opts: TermOptions = {}): string | null {
  if (!tokens.length) return null;
  const inRun = new Set(findRuns(tokens).flatMap((r) => Array.from({ length: r.end - r.start }, (_, k) => r.start + k)));
  const droppable = (t: string, i: number) => !inRun.has(i) && (STOPWORDS.has(t) || (opts.dropGeneric && GENERIC.has(t)));
  let keep = tokens.map((t, i) => !droppable(t, i));
  if (!keep.some(Boolean)) keep = tokens.map((t, i) => inRun.has(i) || !STOPWORDS.has(t));
  if (!keep.some(Boolean)) keep = tokens.map(() => true);
  const last = tokens.length - 1;
  const soft = opts.softRegion && tokens.length > 1 ? opts.softRegion : null;
  const kept = tokens.map((t, i) => ({ t, i })).filter(({ i }) => keep[i] && !(soft && i === last));
  const prefixes = kept.map(({ t, i }) => (lastIsPrefix && i === last) || Boolean(opts.prefixAll && t.length >= PREFIX_MIN && t.length <= PREFIX_MAX));
  const parts = sequence(kept.map((k) => k.t), prefixes);
  // The code itself still matches as a word being typed, so "grace co" keeps finding Grace Community.
  if (soft) parts.push(`({name loc} : "${tokens[last]}"${lastIsPrefix ? "*" : ""} OR geo : "r${soft.toLowerCase()}")`);
  return parts.length ? parts.join(" AND ") : null;
}

/** Any token matches. Used only for the partial band; words under 3 letters ("ca", "tx") are too loose. */
export function anyToken(tokens: string[], lastIsPrefix: boolean): string | null {
  const last = tokens.length - 1;
  const terms = tokens.flatMap((t, i) => (t.length < 3 ? [] : variants(t).map((v) => `"${v}"${lastIsPrefix && i === last && v === t ? "*" : ""}`)));
  return terms.length ? `{name loc} : (${terms.join(" OR ")})` : null;
}

export const geoAny = (geoTokens: string[]) => `geo : (${geoTokens.map((g) => `"${g}"`).join(" OR ")})`;

/** Words of a resolved place in the `loc` column, such as `loc : "fort worth"`. */
export const locPhrase = (key: string) => `loc : "${key}"`;

export function combine(...parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter(Boolean) as string[];
  if (!kept.length) return null;
  return kept.length === 1 ? kept[0]! : kept.map((p) => `(${p})`).join(" AND ");
}

export interface Scope {
  center: { lat: number; lng: number } | null;
  /** A resolved place: its rows come first, before the 60-row limit of wider rungs can cut them. */
  city?: { key: string; region: string } | null;
  /** Soft: a rung of its own, with wider rungs after it. */
  region: string | null;
  country: string | null;
  /** Hard: added to every rung. */
  filter: string | null;
}

/**
 * The named city, nearby cells, wider cells, then region and country. Then the filter alone, or global
 * when there is nothing to scope by. A filter is the widest rung: the soft scope comes from the
 * caller's location and may lie outside it entirely.
 */
export function rungs(text: string | null, scope: Scope): string[] {
  const out: string[] = [];
  const add = (...geo: (string | null)[]) => {
    const m = combine(text, ...geo, scope.filter);
    if (m) out.push(m);
  };
  if (scope.city) add(locPhrase(scope.city.key), geoAny(["r" + scope.city.region.toLowerCase()]));
  if (scope.center) {
    add(geoAny(cellsAround(scope.center.lat, scope.center.lng, 4).map((c) => "g4" + c)));
    add(geoAny(cellsAround(scope.center.lat, scope.center.lng, 3).map((c) => "g3" + c)));
  }
  if (scope.region) add(geoAny(["r" + scope.region.toLowerCase()]));
  if (scope.country) add(geoAny(["cc" + scope.country.toLowerCase()]));
  if (!out.length || scope.filter) add(null);
  return out;
}
