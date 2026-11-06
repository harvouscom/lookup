// Query parsing. Pure: the caller resolves a place candidate against the `places` table.
// A place is detected only from a comma, in/near/at, a full region or country name, or an
// uppercase code. So lowercase "in" is never Indiana.
import { fold, tokenize } from "./project.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";

const REGION_BY_NAME = new Map<string, string[]>();
for (const [code, r] of Object.entries(REGIONS)) {
  const key = tokenize(r.n).join(" ");
  REGION_BY_NAME.set(key, [...(REGION_BY_NAME.get(key) ?? []), code]);
}
const COUNTRY_BY_NAME = new Map(Object.entries(COUNTRIES).map(([cc, n]) => [tokenize(n).join(" "), cc]));
COUNTRY_BY_NAME.set("usa", "US");
COUNTRY_BY_NAME.set("uk", "GB");

export const STOPWORDS: ReadonlySet<string> = new Set([
  "of", "the", "a", "an", "and", "for", "in", "at", "on", "de", "du", "des", "la", "le", "les", "el", "los", "las",
  "di", "del", "della", "da", "do", "dos", "das", "der", "die", "von", "van", "zu", "zum", "zur", "pw", "w",
]);

const CONNECTORS = new Set(["in", "near", "at", "around"]);

// The full form comes first: `canonical` compares by it.
const SYNONYM_GROUPS = [
  ["saint", "st", "sankt"], ["sainte", "ste"], ["saints", "sts", "ss"], ["mount", "mt"], ["mountain", "mtn"], ["fort", "ft"],
  ["heilig", "hl", "heilige", "heiligen"], ["swietego", "sw", "swietej"], ["san", "sant"],
  ["first", "1st"], ["second", "2nd"], ["third", "3rd"], ["fourth", "4th"], ["fifth", "5th"], ["seventh", "7th"],
  ["baptist", "bapt"], ["methodist", "meth"], ["presbyterian", "presb", "presby", "pres"], ["lutheran", "luth"],
  ["episcopal", "episc", "epis"], ["church", "ch"], ["assembly", "assemblies", "assy"], ["center", "centre", "ctr"],
  ["international", "intl"],
];
export const SYNONYMS: ReadonlyMap<string, string[]> = new Map(SYNONYM_GROUPS.flatMap((g) => g.map((t) => [t, g] as const)));

/** Other spellings a token may be indexed under: synonyms, and German `ue` for an indexed `u`. */
export function variants(token: string): string[] {
  const out = new Set([token, ...(SYNONYMS.get(token) ?? [])]);
  if (token.length >= 5 && /[aou]e/.test(token)) out.add(token.replace(/([aou])e/g, "$1"));
  // "st peters" should find "St Peter", while the prefix on the typed form still finds "St Peter's".
  if (token.length >= 4 && token.endsWith("s") && !token.endsWith("ss")) out.add(token.slice(0, -1));
  return [...out];
}

/** One spelling per synonym group, so `st` and `saint` compare as equal when ranking. */
export const canonical = (token: string): string => SYNONYMS.get(token)?.[0] ?? token;

export interface ParsedQuery {
  /** Folded search tokens, with place words removed. */
  tokens: string[];
  /** Folded place words to resolve, if a place signal was found. */
  placeKey: string | null;
  regionHint: string | null;
  countryHint: string | null;
  /** The tokens to fall back to if the place words turn out not to be a place. */
  fallbackTokens: string[];
  /**
   * A lowercase trailing code such as "tx". It stays in `tokens` (it may be a word being typed, like
   * "grace co"), and only adds rows in that region as matches and a small ranking bonus.
   */
  softRegion: string | null;
  /**
   * Words before a trailing region that may name a city ("dallas" in "first baptist dallas tx"), longest
   * first. `rest` is what to search for if that key turns out to be a place in the region.
   */
  placeCandidates: { key: string; rest: string[] }[];
}

/** Codes read without a comma when lowercase: US and Canadian ones that aren't stopwords, plus a few short forms. */
const REGION_ALIASES: Record<string, string> = { NSW: "AUNSW", QLD: "AUQLD", VIC: "AUVIC", TAS: "AUTAS", NRW: "DENW" };
const SOFT_ALIASES = new Set(["nsw", "qld", "nrw"]);

/** City nicknames read as a place at the end of a query, with a word before them ("st patricks nyc"). */
const IMPLICIT_ALIASES = new Set(["nyc", "philly", "okc", "slc", "nola", "atl", "sf", "kc"]);
/** Place-key spellings for nicknames. "la" and "vegas" are only read after a comma or connector. */
const CITY_ALIASES: Record<string, string> = {
  nyc: "new york", philly: "philadelphia", okc: "oklahoma city", slc: "salt lake city", nola: "new orleans",
  atl: "atlanta", sf: "san francisco", kc: "kansas city", la: "los angeles", vegas: "las vegas",
};
const PLACE_SYNONYM_GROUPS = [["saint", "st", "ste", "sainte"], ["fort", "ft"], ["mount", "mt"], ["north", "n"], ["south", "s"], ["east", "e"], ["west", "w"]];
const PLACE_SYNONYMS = new Map(PLACE_SYNONYM_GROUPS.flatMap((g) => g.map((t) => [t, g] as const)));
const MAX_PLACE_KEYS = 12;

function matchRegionSuffix(words: string[], preferCc?: string): { code: string | null; cc: string | null; used: number } {
  for (let n = Math.min(4, words.length); n >= 1; n--) {
    const key = tokenize(words.slice(-n).join(" ")).join(" ");
    const codes = REGION_BY_NAME.get(key);
    if (codes) {
      const code = codes.find((c) => REGIONS[c]!.cc === preferCc) ?? codes[0]!;
      return { code, cc: REGIONS[code]!.cc, used: n };
    }
    const cc = COUNTRY_BY_NAME.get(key);
    if (cc) return { code: null, cc, used: n };
  }
  return { code: null, cc: null, used: 0 };
}

/** Only an uppercase or dotted code ("N.C.") counts, unless the caller has already seen a comma or connector. */
function regionCode(word: string, allowLower: boolean): string | null {
  const dotted = /^[a-z]\.[a-z]\.?,?$/i.test(word);
  const w = word.replace(/[.,]/g, "");
  if (!allowLower && !dotted && w !== w.toUpperCase()) return null;
  const up = w.toUpperCase();
  if (up === "DC") return "DC";
  if (REGION_ALIASES[up]) return REGION_ALIASES[up]!;
  return REGIONS[up] && /^[A-Z0-9]{2,6}$/.test(up) ? up : null;
}

/** A lowercase trailing code, read softly: a US or Canadian two-letter code that isn't a stopword, or nsw/qld/nrw. */
function softCode(word: string): string | null {
  const w = fold(word).replace(/[.,]/g, "");
  if (SOFT_ALIASES.has(w)) return REGION_ALIASES[w.toUpperCase()]!;
  if (!/^[a-z]{2}$/.test(w) || STOPWORDS.has(w)) return null;
  const up = w.toUpperCase();
  const r = REGIONS[up];
  return r && (r.cc === "US" || r.cc === "CA") ? up : null;
}

/** The last 1-3 words as possible city names, always leaving one real search word. */
function candidates(words: string[]): ParsedQuery["placeCandidates"] {
  const out: ParsedQuery["placeCandidates"] = [];
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const rest = toks(words.slice(0, words.length - n));
    const key = toks(words.slice(-n)).join(" ");
    if (key && rest.some((t) => !STOPWORDS.has(t))) out.push({ key, rest });
  }
  return out;
}

const toks = (words: string[]) => tokenize(words.join(" "));

/** Split place words into a place key and any trailing region. */
function readPlace(words: string[], preferCc?: string, afterComma = false): Pick<ParsedQuery, "placeKey" | "regionHint" | "countryHint"> {
  let rest = [...words];
  let regionHint: string | null = null;
  let countryHint: string | null = null;
  const last = rest[rest.length - 1];
  const code = last ? regionCode(last, afterComma || rest.length > 1) : null;
  if (code) {
    regionHint = code;
    countryHint = REGIONS[code]!.cc;
    rest = rest.slice(0, -1);
  } else {
    const m = matchRegionSuffix(rest, preferCc);
    if (m.used) {
      regionHint = m.code;
      countryHint = m.cc;
      rest = rest.slice(0, rest.length - m.used);
    }
  }
  const key = toks(rest).join(" ");
  return { placeKey: key || null, regionHint, countryHint };
}

export function parseQuery(raw: string, preferCc?: string): ParsedQuery {
  const text = raw.trim().replace(/\s+/g, " ");
  const all = tokenize(text);
  const none = { softRegion: null, placeCandidates: [] };
  const plain = (): ParsedQuery => ({ tokens: all, placeKey: null, regionHint: null, countryHint: null, fallbackTokens: all, ...none });

  // 1. Comma: everything after the first comma is place.
  const comma = text.indexOf(",");
  if (comma >= 0) {
    const before = text.slice(0, comma);
    const after = text.slice(comma + 1).replace(/,/g, " ").trim();
    if (after) {
      const place = readPlace(after.split(" "), preferCc, true);
      return { tokens: tokenize(before), ...place, fallbackTokens: all, ...none };
    }
    return plain();
  }

  const words = text.split(" ");

  // 2. Connector: the last in/near/at with words after it.
  for (let i = words.length - 2; i >= 0; i--) {
    if (CONNECTORS.has(fold(words[i]!))) {
      const place = readPlace(words.slice(i + 1), preferCc);
      return { tokens: toks(words.slice(0, i)), ...place, fallbackTokens: all, ...none };
    }
  }

  const last = words[words.length - 1]!;
  const before = words.slice(0, -1);
  const hasWord = (ws: string[]) => toks(ws).some((t) => !STOPWORDS.has(t));

  // 3. Trailing uppercase or dotted code, unless the whole query is shouting.
  if (words.length > 1 && text !== text.toUpperCase()) {
    const code = regionCode(last, false);
    if (code) return { tokens: toks(before), placeKey: null, regionHint: code, countryHint: REGIONS[code]!.cc, fallbackTokens: all, softRegion: null, placeCandidates: candidates(before) };
  }

  // 3b. A lowercase code is read softly: it may be the start of a word ("grace co" for Community).
  const soft = words.length > 1 && hasWord(before) ? softCode(last) : null;
  if (soft) return { tokens: all, placeKey: null, regionHint: null, countryHint: null, fallbackTokens: all, softRegion: soft, placeCandidates: candidates(before) };

  // 3c. A trailing city nickname ("st patricks cathedral nyc").
  if (words.length > 1 && IMPLICIT_ALIASES.has(fold(last)) && hasWord(before)) {
    return { tokens: toks(before), placeKey: fold(last), regionHint: null, countryHint: null, fallbackTokens: all, ...none };
  }

  // 4. Trailing full region or country name, with search words left over.
  const m = matchRegionSuffix(words, preferCc);
  if (m.used && m.used < words.length) {
    const rest = words.slice(0, words.length - m.used);
    return { tokens: toks(rest), placeKey: null, regionHint: m.code, countryHint: m.cc, fallbackTokens: all, softRegion: null, placeCandidates: m.code ? candidates(rest) : [] };
  }
  return plain();
}

/** Tokens that must match. Stopwords only drop out when something else remains. */
export function requiredTokens(tokens: string[]): string[] {
  const kept = tokens.filter((t) => !STOPWORDS.has(t));
  return kept.length ? kept : tokens;
}

/** Key spellings to try for a place: `st louis` may be stored as `saint louis`, `ft worth` as `fort worth`, `nyc` as `new york`. */
export function placeKeys(key: string): string[] {
  let keys = [""];
  for (const part of key.split(" ")) {
    const alts = PLACE_SYNONYMS.get(part) ?? [part];
    keys = keys.flatMap((k) => alts.map((a) => (k ? `${k} ${a}` : a))).slice(0, MAX_PLACE_KEYS);
  }
  const out = new Set([key, ...keys]);
  if (CITY_ALIASES[key]) out.add(CITY_ALIASES[key]!);
  return [...out].slice(0, MAX_PLACE_KEYS);
}
