// Text the widget shows or announces. English is built in; Spanish, French, German, Portuguese and
// Polish load as small separate files (strings-es.js and so on) so the element stays small. Pick a
// language with `lang` (or the page's), and override any string with the `strings` property.

export interface Strings {
  label: string;
  placeholder: string;
  /** Shown when a search finds nothing; the add link follows it. */
  none: string;
  add: string;
  /** Announced when a search finds nothing. */
  noneShort: string;
  error: string;
  found: (n: number) => string;
  /** The row after the results that loads more, and its text while loading. */
  more: string;
  loading: string;
  /** Announced when more results are added. */
  moreFound: (n: number) => string;
  /** Shown above the results when a misspelling was searched as something else. */
  corrected: (q: string) => string;
  retry: string;
  filled: (n: number, missing: string[]) => string;
  loadFail: string;
  dataFrom: string;
  clear: string;
  required: string;
  /** Consent panel. */
  shareTitle: string;
  shareBody: string;
  share: string;
  notNow: string;
  goesLive: string;
  /** No longer shown: replacements say `checked`. Kept so existing overrides still type-check. */
  reviewed: string;
  /** A replacement, which Here's My Church checks automatically. */
  checked: string;
  /** Any change on a listing the church has claimed. */
  churchReviews: string;
  /** After sending, a change held for the church to review. */
  sentToChurch: string;
  soon: string;
  st: { live: string; in_review: string; not_applied: string; rejected: string; try_again: string; coming_soon: string };
  shared: (n: number) => string;
  sending: string;
  sandbox: string;
  confirmQ: string;
  stillCorrect: string;
  done: string;
  thanks: string;
  changedNote: (n: number) => string;
  /** The one consent row for street, city and postal code. */
  address: string;
  /** The share button, with how many checked changes it sends. */
  shareN: (n: number) => string;
  /** "Report a problem" and its choices. */
  report: string;
  reports: { reportClosed: string; reportDuplicate: string; reportRelocated: string };
  reported: string;
  /** Link to the church's page on Here's My Church, for fixes Lookup doesn't take. */
  moreFixes: string;
  /** Offered when the form is filled without picking a church. */
  addQ: (name: string) => string;
  addBody: string;
  addBtn: string;
  adding: string;
  similarQ: string;
  noneOfThese: string;
  added: (name: string) => string;
}


/** Shared across separately loaded bundles, so a language file can register into the element. */
const REG_KEY = "__hmcLookupStrings";
type Registry = Record<string, Partial<Strings>>;
export const registry = (): Registry => ((globalThis as unknown as Record<string, Registry>)[REG_KEY] ??= {});

const list = (m: string[], label: string) => (m.length ? ` ${label} ${m.join(", ")}.` : "");

export const EN: Strings = {
    label: "Church",
    placeholder: "Start typing your church's name",
    none: "No matching church. What you typed stays in the form. ",
    add: "Add it on Here's My Church",
    noneShort: "No matching church.",
    error: "Search isn't available right now. You can keep typing your church's details.",
    found: (n) => `${n} ${n === 1 ? "church" : "churches"} found. Use up and down arrows to choose.`,
    more: "Show more results",
    loading: "Loading…",
    moreFound: (n) => `${n} more ${n === 1 ? "church" : "churches"}.`,
    corrected: (q) => `Showing results for “${q}”`,
    retry: "Try again",
    filled: (n, m) => `Filled ${n} ${n === 1 ? "field" : "fields"}.${list(m, "Not available:")}`,
    loadFail: "Couldn't load that church's details. You can type them in.",
    dataFrom: "Data from",
    clear: "Clear church",
    required: "Choose your church from the list.",
    shareTitle: "Share your fixes with Here's My Church?",
    shareBody: "Uncheck anything you'd rather not share. Nothing is sent until you choose Share.",
    share: "Share",
    notNow: "Not now",
    goesLive: "Goes live",
    reviewed: "A moderator reviews it",
    checked: "Checked automatically",
    churchReviews: "The church reviews this",
    sentToChurch: "Sent to the church",
    soon: "Coming soon",
    st: { live: "Live now", in_review: "Sent for review", not_applied: "Not changed: Here's My Church kept the listed value", rejected: "Not accepted", try_again: "Couldn't send. Try again shortly.", coming_soon: "Coming soon" },
    shared: (n) => `Shared ${n} ${n === 1 ? "change" : "changes"}.`,
    sending: "Sending…",
    sandbox: "Demo only: nothing was sent.",
    confirmQ: "Details from Here's My Church. Still correct?",
    stillCorrect: "Still correct",
    done: "Done",
    thanks: "Thanks for confirming.",
    changedNote: (n) => `You changed ${n} ${n === 1 ? "detail" : "details"}. You can share ${n === 1 ? "it" : "them"} with Here's My Church below the church field.`,
    address: "Address",
    shareN: (n) => `Share ${n} ${n === 1 ? "fix" : "fixes"}`,
    report: "Report a problem",
    reports: { reportClosed: "Closed", reportDuplicate: "Duplicate", reportRelocated: "Moved" },
    reported: "Thanks. A moderator will check it.",
    moreFixes: "More fixes on Here's My Church",
    addQ: (name) => `Add ${name} to Here's My Church?`,
    addBody: "It goes live right away, so the next person can find it. Check the details first.",
    addBtn: "Add church",
    adding: "Adding…",
    similarQ: "Is it one of these?",
    noneOfThese: "None of these, add it",
    added: (name) => `Added ${name}. Thank you!`,
  };

/** The languages with a strings file next to the element. */
export const LANGS = ["es", "fr", "de", "pt", "pl"];

/** Add or replace a language. Elements already on the page pick it up. */
export function registerStrings(lang: string, strings: Partial<Strings>): void {
  registry()[lang] = strings;
  if (typeof document !== "undefined") document.dispatchEvent(new Event("hmc-strings"));
}

/** The strings for a language tag such as "es-MX". Anything a language leaves out is English. */
export function stringsFor(lang: string | null | undefined): Strings {
  const base = (lang ?? "").toLowerCase().split("-")[0]!;
  return { ...EN, ...registry()[base] };
}
