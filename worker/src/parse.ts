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

const SYNONYM_GROUPS = [
  ["saint", "st", "sankt"], ["sainte", "ste"], ["saints", "sts", "ss"], ["mount", "mt"], ["mountain", "mtn"], ["fort", "ft"],
  ["heilig", "hl", "heilige", "heiligen"], ["swietego", "sw", "swietej"], ["san", "sant"],
];
const SYNONYMS = new Map<string, string[]>();
for (const g of SYNONYM_GROUPS) for (const t of g) SYNONYMS.set(t, g);

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
}

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

/** Only an uppercase code counts, unless the caller has already seen a comma or connector. */
function regionCode(word: string, allowLower: boolean): string | null {
  const w = word.replace(/[.,]/g, "");
  if (!allowLower && w !== w.toUpperCase()) return null;
  const up = w.toUpperCase();
  if (/^D\.?C\.?$/.test(up)) return "DC";
  return REGIONS[up] && /^[A-Z0-9]{2,6}$/.test(up) ? up : null;
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
  const plain = (): ParsedQuery => ({ tokens: all, placeKey: null, regionHint: null, countryHint: null, fallbackTokens: all });

  // 1. Comma: everything after the first comma is place.
  const comma = text.indexOf(",");
  if (comma >= 0) {
    const before = text.slice(0, comma);
    const after = text.slice(comma + 1).replace(/,/g, " ").trim();
    if (after) {
      const place = readPlace(after.split(" "), preferCc, true);
      return { tokens: tokenize(before), ...place, fallbackTokens: all };
    }
    return plain();
  }

  const words = text.split(" ");

  // 2. Connector: the last in/near/at with words after it.
  for (let i = words.length - 2; i >= 0; i--) {
    if (CONNECTORS.has(fold(words[i]!))) {
      const place = readPlace(words.slice(i + 1), preferCc);
      return { tokens: toks(words.slice(0, i)), ...place, fallbackTokens: all };
    }
  }

  // 3. Trailing uppercase code, unless the whole query is shouting.
  if (words.length > 1 && text !== text.toUpperCase()) {
    const code = regionCode(words[words.length - 1]!, false);
    if (code) return { tokens: toks(words.slice(0, -1)), placeKey: null, regionHint: code, countryHint: REGIONS[code]!.cc, fallbackTokens: all };
  }

  // 4. Trailing full region or country name, with search words left over.
  const m = matchRegionSuffix(words, preferCc);
  if (m.used && m.used < words.length) {
    return { tokens: toks(words.slice(0, words.length - m.used)), placeKey: null, regionHint: m.code, countryHint: m.cc, fallbackTokens: all };
  }
  return plain();
}

/** Tokens that must match. Stopwords only drop out when something else remains. */
export function requiredTokens(tokens: string[]): string[] {
  const kept = tokens.filter((t) => !STOPWORDS.has(t));
  return kept.length ? kept : tokens;
}

/** Key spellings to try for a place, since `st louis` may be stored as `saint louis`. */
export function placeKeys(key: string): string[] {
  const parts = key.split(" ");
  const out = new Set([key]);
  if (SYNONYMS.has(parts[0]!)) for (const v of SYNONYMS.get(parts[0]!)!) out.add([v, ...parts.slice(1)].join(" "));
  return [...out];
}
