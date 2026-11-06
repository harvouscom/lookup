// Church-name abbreviations that stand for several words ("umc" for United Methodist). Single-word
// short forms ("bapt", "1st") are synonyms in parse.ts instead.
import { canonical } from "./parse.ts";

/** Each abbreviation's full forms, the first being the one names are compared by. `*` marks a prefix. */
export const ABBREVIATIONS: Readonly<Record<string, readonly string[][]>> = {
  umc: [["united", "methodist"]],
  fumc: [["first", "united", "methodist"]],
  fbc: [["first", "baptist"]],
  fpc: [["first", "presbyterian"]],
  ame: [["african", "methodist", "episcopal"]],
  amez: [["african", "methodist", "episcopal", "zion"]],
  cme: [["christian", "methodist", "episcopal"]],
  cogic: [["church", "of", "god", "in", "christ"]],
  cog: [["church", "of", "god"]],
  sda: [["seventh", "day", "adventist"]],
  lds: [["latter", "day", "saints"]],
  aog: [["assembly", "of", "god"], ["assemblies", "of", "god"]],
  ucc: [["united", "church", "of", "christ"]],
  rcc: [["roman", "catholic"]],
  mbc: [["missionary", "baptist"]],
  upc: [["united", "pentecostal"]],
};

const bare = (w: string) => w.replace(/\*$/, "");

/** A token's comparable form, plus the token as written, so a typed prefix can still match the raw name word. */
export interface SeqToken { t: string; raw: string }

/** Expand abbreviations to their primary form and map every word to its canonical spelling. */
export function normalizeSeq(tokens: string[]): SeqToken[] {
  return tokens.flatMap((raw) => {
    const full = ABBREVIATIONS[raw]?.[0];
    return full ? full.map((w) => ({ t: canonical(bare(w)), raw: bare(w) })) : [{ t: canonical(raw), raw }];
  });
}

/** Full forms keyed by their canonical words, longest first, for finding them inside a query. */
const FORMS = Object.entries(ABBREVIATIONS)
  .flatMap(([abbr, forms]) => forms.map((f) => ({ abbr, words: f.map((w) => canonical(bare(w))) })))
  .sort((a, b) => b.words.length - a.words.length);

export interface Run { start: number; end: number; abbr: string }

/**
 * Where a query spells out an abbreviation's full form ("first united methodist" for fumc), so the
 * search can also find listings that use the short form. Greedy, longest first, never overlapping.
 * `maxLen` keeps a run from matching itself when looking inside it.
 */
export function findRuns(tokens: string[], maxLen = Infinity): Run[] {
  const canon = tokens.map(canonical);
  const out: Run[] = [];
  for (let i = 0; i < canon.length; ) {
    const hit = FORMS.find((f) => f.words.length >= 2 && f.words.length <= maxLen && f.words.every((w, k) => canon[i + k] === w));
    if (hit) { out.push({ start: i, end: i + hit.words.length, abbr: hit.abbr }); i += hit.words.length; }
    else i++;
  }
  return out;
}

/** Full forms to search for an abbreviation, as FTS phrases. */
export function expansions(token: string): string[] {
  return (ABBREVIATIONS[token] ?? []).map((f) => {
    const prefix = f[f.length - 1]!.endsWith("*");
    return `"${f.map(bare).join(" ")}"${prefix ? "*" : ""}`;
  });
}
