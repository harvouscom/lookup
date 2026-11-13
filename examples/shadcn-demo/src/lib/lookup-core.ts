// Lookup by Here's My Church, headless core v0.4.0. Generated from @heresmychurch/lookup
// (packages/sdk/src) by scripts/build-registry.mjs. MIT. https://lookup.heresmychurch.com/docs
/* eslint-disable */

// ── dev.ts ──
// Setup hints for developers. Each prints once, and only on a local development host (localhost,
// 127.0.0.1, *.localhost, *.test), so production consoles and servers stay quiet.
const said: Record<string, 1> = {};

export function devWarn(message: string): void {
  const host = typeof location == "object" ? location.hostname : "";
  if (said[message] || !/^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/.test(host)) return;
  said[message] = 1;
  console.warn("Lookup: " + message);
}

// ── client.ts ──
// @heresmychurch/lookup core client. No dependencies.

export interface SearchOptions {
  near?: string;
  lat?: number;
  lng?: number;
  country?: string;
  region?: string;
  limit?: number;
  /** The person stopped typing. Allows the slower semantic path. */
  settled?: boolean;
  /** Set false to stop the API using the request's approximate location. */
  geo?: boolean;
  signal?: AbortSignal;
}

export interface SearchResult {
  id: string;
  name: string;
  label: string;
  locationLabel: string;
  street: string | null;
  city: string | null;
  nearestPlace: string | null;
  region: string;
  regionName: string;
  country: string;
  countryName: string;
  latitude: number;
  longitude: number;
  denomination: string | null;
  completeness: number;
  distanceKm: number | null;
  band: number;
  source: "lexical" | "semantic" | "both";
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  /** More churches ranked past `limit`. Ask again with a higher limit to get them. */
  hasMore?: boolean;
  /** The place understood from the query or `near`, such as Dallas, TX. */
  place: { name: string; region: string; country: string } | null;
  /** The spelling searched instead of what was typed, or null. */
  corrected: string | null;
  /** A fallback answer: part of the search didn't run. */
  degraded: boolean;
  /** Whether semantic search ran. */
  semantic?: "used" | "skipped" | "off" | "failed";
  attribution: string;
}

/** One weekly service. */
export interface ServiceSlot {
  /** 0 is Sunday, 6 is Saturday. */
  dayOfWeek: number;
  /** 24-hour "HH:MM", such as "09:30". */
  startTime: string;
}

export interface ServiceTimes {
  /** The listed text, such as "Sun 9:00 AM; Wed 7:00 PM", or null when there is none. */
  raw: string | null;
  /** The services read from `raw`. Empty when it couldn't be read; `raw` still holds the text. */
  slots: ServiceSlot[];
  /** Whether every part of `raw` was read into `slots`. */
  parsed: boolean;
}

/** A church's details. Every key is always present, with null or [] when the directory has nothing. */
export interface ChurchFields {
  name: string;
  street: string | null;
  city: string | null;
  /** A region code, such as "TX" or "ON". */
  region: string;
  /** The region's name, such as "Texas". */
  regionName: string;
  postalCode: string | null;
  /** An ISO country code, such as "US". */
  country: string;
  countryName: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  denomination: string | null;
  serviceTimes: ServiceTimes;
  languages: string[];
  ministries: string[];
  pastorName: string | null;
}

/** A field name in a church record, as data-hmc-field takes. */
export type ChurchField = keyof ChurchFields | "id";

export interface ChurchRecord {
  id: string;
  /** Only with { follow: false }: this listing merged into another. Load that ID instead; nothing else is set. */
  movedTo?: string;
  /** The ID you asked for, when it merged into this church. Store this record's `id` instead. */
  movedFrom?: string;
  fields: ChurchFields;
  missing: string[];
  completeness: number;
  /** When someone last confirmed the listing (ms since 1970), or null if never. */
  freshness?: { lastVerified: number | null };
  hints: { nearestPlace: string | null };
  /** The church's page on Here's My Church, where people can fix anything else. Add ?suggest=1 to open the form. */
  links?: { heresMyChurch: string | null };
  attribution: string;
}

/** What happened to one contributed field. See the API docs for each status. */
export type FieldStatus = "live" | "in_review" | "not_applied" | "rejected" | "try_again" | "coming_soon";
export interface ContributionResult {
  churchId: string;
  sandbox?: boolean;
  results: { field: string; status: FieldStatus; message?: string }[];
}
/** A church to add: record field names. Name, city and region (a code or name) are required. */
export interface NewChurch {
  name: string; city: string; region: string; street?: string; postalCode?: string; country?: string;
  phone?: string; email?: string; website?: string; denomination?: string; serviceTimes?: string;
  languages?: string | string[]; ministries?: string | string[]; pastorName?: string; latitude?: number; longitude?: number;
}
/** live: added (with its new `id`). similar: it may already be listed; `similar` holds candidates, send again with confirmAdd to add anyway. */
export interface AddResult { status: "live" | "similar" | "rejected" | "try_again"; id?: string | null; similar?: SearchResult[]; message?: string; sandbox?: boolean }
export interface ConfirmResult { churchId: string; sandbox?: boolean; status: "confirmed" | FieldStatus; message?: string; lastVerified?: number }
export interface Meta {
  fields: string[];
  contributableFields: Record<string, { countries: "all" | string[]; review: "live" | "moderated"; status?: "coming_soon" }>;
  completenessWeights: Record<string, number>;
  /** Whether addChurch() takes new churches right now. */
  addEnabled?: boolean;
  attribution: string;
}

export class LookupError extends Error {
  status: number;
  /** Seconds to wait before trying again, on a 429 or 503. */
  retryAfter?: number;
  /** A stable reason: invalid, not_found, rate_limited, overloaded, unavailable, timeout, … */
  code?: string;
  constructor(status: number, message: string, retryAfter?: number, code?: string) {
    super(message);
    this.name = "LookupError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

export interface LookupOptions {
  baseUrl?: string;
  /** Your tool's name, such as "my-chms". Self-declared; shown to reviewers as declared. */
  client?: string;
  fetch?: typeof fetch;
  /** Give up on a request after this many milliseconds, with a LookupError whose code is "timeout". Defaults to 15000; 0 waits forever. */
  timeout?: number;
}

export function createLookup(opts: LookupOptions = {}) {
  const base = (opts.baseUrl ?? "https://lookup.heresmychurch.com").replace(/\/+$/, "") + "/v1";
  const f = opts.fetch ?? fetch.bind(globalThis);
  const timeout = opts.timeout ?? 15000;
  if (!opts.client) devWarn('set client="my-app" so Here\'s My Church knows which tool is asking. Use "lookup-demo" while testing.');

  async function get<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
    // One signal for the caller's abort and the timeout. A caller's abort still rejects with AbortError.
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    const timer = timeout > 0 ? setTimeout(stop, timeout) : 0;
    if (signal?.aborted) stop();
    signal?.addEventListener("abort", stop);
    try {
      const res = await f(base + path, { ...init, signal: ctl.signal });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new LookupError(res.status, body.error ?? res.statusText, Number(res.headers.get("retry-after")) || undefined, body.code);
      return body;
    } catch (e) {
      // Aborted, but not by the caller: the timeout fired.
      throw ctl.signal.aborted && !signal?.aborted ? new LookupError(0, "Timed out", undefined, "timeout") : e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    }
  }

  const post = <T>(path: string, body: unknown, keepalive?: boolean) =>
    get<T>(path, undefined, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), ...(keepalive ? { keepalive } : {}) });
  const client = opts.client ?? "unknown";

  return {
    search(q: string, o: SearchOptions = {}): Promise<SearchResponse> {
      const p = new URLSearchParams({ q });
      for (const k of ["near", "lat", "lng", "country", "region", "limit"] as const) if (o[k] != null) p.set(k, String(o[k]));
      if (o.settled) p.set("settled", "1");
      if (o.geo === false) p.set("geo", "off");
      if (opts.client) p.set("client", opts.client);
      return get(`/search?${p}`, o.signal);
    },
    /** The autofill record. An ID whose listing merged into another loads that church, with `movedFrom`. */
    async getChurch(id: string, o: { signal?: AbortSignal; follow?: boolean } = {}): Promise<ChurchRecord> {
      const one = (i: string) => get<ChurchRecord>(`/churches/${encodeURIComponent(i)}`, o.signal);
      const rec = await one(id);
      return rec.movedTo && o.follow !== false ? { ...(await one(rec.movedTo)), movedFrom: id } : rec;
    },
    /** Field names, which fields can be contributed and how each is reviewed. */
    meta(): Promise<Meta> {
      return get("/meta");
    },
    /** Send corrections. Each field comes back live, in review, or with a reason. keepalive lets it finish as the page unloads. */
    contribute(id: string, changes: { field: string; value: unknown }[], o: { keepalive?: boolean } = {}): Promise<ContributionResult> {
      return post(`/churches/${encodeURIComponent(id)}/contributions`, { client, changes }, o.keepalive);
    },
    /** "Still correct": bumps the church's last-verified date. */
    confirm(id: string): Promise<ConfirmResult> {
      return post(`/churches/${encodeURIComponent(id)}/confirm`, { client });
    },
    /** Add a church to Here's My Church. Similar listings come back first; confirmAdd adds it anyway. */
    addChurch(church: NewChurch, o: { confirmAdd?: boolean } = {}): Promise<AddResult> {
      return post("/churches", { client, church, ...(o.confirmAdd ? { confirmAdd: true } : {}) });
    },
  };
}

export type Lookup = ReturnType<typeof createLookup>;

// ── dom.ts ──
export type FieldTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Set a value the way a person typing would, so frameworks that track input (React) see it. */
export function setNativeValue(el: FieldTarget, value: string): void {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── strings.ts ──
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
  reviewed: string;
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

// ── fields.ts ──
// @heresmychurch/lookup/fields: find the form fields a church fills by their name, id or autocomplete,
// so a form works without data-hmc-field tags. Pass matchField to findTargets.

// Words (and word pairs) in a field's name, id or autocomplete, and the record field each means.
const WORDS: Record<string, string> = {
  name: "name", organization: "name", id: "id",
  street: "street", address: "street", "street-address": "street", "address-line1": "street",
  city: "city", town: "city", "address-level2": "city",
  state: "region", province: "region", region: "region", "address-level1": "region",
  zip: "postalCode", postal: "postalCode", postcode: "postalCode", "postal-code": "postalCode",
  country: "country", "country-name": "countryName",
  phone: "phone", tel: "phone", telephone: "phone", email: "email",
  website: "website", url: "website", web: "website", denomination: "denomination", pastor: "pastorName",
};

/**
 * The record field an untagged input is for, or null. Only the church's own fields match, named like
 * church_city, churchWebsite or autocomplete="section-church tel". With `generic`, plain ones match too
 * (city, zip, tel), but never name or id, which on most forms are the person's. Address line 2 and
 * hidden, password, checkbox and similar inputs never match, nor does anything inside the widget.
 */
export function matchField(el: FieldTarget, generic = false): string | null {
  if (/^(hidden|submit|button|reset|checkbox|radio|file|password|image)$/.test(el.type) || el.closest("church-lookup,[data-slot=church-lookup]")) return null;
  const t = [el.name, el.id, el.getAttribute("autocomplete")].join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/)
    .flatMap((w) => (w.startsWith("church") && w.length > 6 ? ["church", w.slice(6)] : [w]));
  const ours = t.includes("church");
  if ((!ours && !generic) || t.some((w) => /^(address|line|street)?[2-9]$/.test(w))) return null;
  const pair = t.slice(1).map((w, i) => WORDS[`${t[i]}-${w}`]).find(Boolean);
  const hits = t.map((w) => WORDS[w]);
  return pair ?? hits.filter((f) => f && f !== "name" && f !== "id").pop() ?? (ours ? hits.find(Boolean) : null) ?? null;
}

// ── core.ts ──
// @heresmychurch/lookup/core: the headless engine behind <church-lookup>, for building your own UI
// (the shadcn registry components use it). No rendering and no side effects on import: nothing is
// registered, and timers only run while a search is pending.


export const DEBOUNCE_MS = 150;
export const SETTLE_MS = 700;
/** Queries this long or longer also get a settled search, which may use semantic search. */
export const SETTLED_MIN = 4;
export const MIN_QUERY = 2;
/** Results on the first page, and each "Show more" after it. */
export const PAGE_SIZE = 8;
/** The most results "Show more" reaches: the API's highest limit. */
export const MAX_RESULTS = 50;

/** A record field as the text a form field should hold, or null when the directory has nothing. */
export function fieldValue(record: ChurchRecord, field: string): string | null {
  const v = field === "id" ? record.id : (record.fields as unknown as Record<string, unknown>)[field];
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "object") return (v as { raw?: string | null }).raw ?? null;
  return String(v);
}

// ── Search state ──

export interface SearchParams {
  region?: string;
  country?: string;
  /** Rank near a place, such as "Dallas". */
  near?: string;
  /** Rank near a point, such as the device's location. Send both. */
  lat?: number;
  lng?: number;
  /** Results per page: the first page and each "Show more". Defaults to 8. */
  limit?: number;
  /** The most results "Show more" can reach. Defaults to 50, the most the API returns. */
  maxResults?: number;
  /** Characters typed before searching. Defaults to 2. */
  minChars?: number;
  /** Milliseconds to wait after typing before searching. Defaults to 150. */
  debounce?: number;
  /** Set false to skip the search after a pause, which may use semantic search. */
  semantic?: boolean;
  /** Set false to stop the API using the visitor's approximate location. */
  geo?: boolean;
}

export interface ControllerState {
  /** The text being searched, trimmed. */
  query: string;
  results: SearchResult[];
  /** Index of the highlighted result, or -1. Equals results.length when the "Show more" row is highlighted. */
  active: number;
  open: boolean;
  /** True while a search for the current query is in flight. */
  loading: boolean;
  /** Search failed; the results are empty. */
  error: boolean;
  /** The chosen church, or null. */
  selected: SearchResult | null;
  /** More results can be shown with more(). Show a "Show more" row after the results. */
  hasMore: boolean;
  /** True while more() is loading. */
  loadingMore: boolean;
  /** The spelling searched instead of what was typed, such as "grace" for "gracee", or null. */
  corrected: string | null;
}

export interface ControllerOptions {
  /** A client, or a function returning one (read on each request). Defaults to createLookup({ client, baseUrl }). */
  lookup?: Lookup | (() => Lookup);
  client?: string;
  baseUrl?: string;
  /** Search options, read when each search runs. */
  params?: SearchParams | (() => SearchParams);
  /** The text currently in the box. Results for anything else are dropped. Defaults to the last input(). */
  text?: () => string;
  onChange?: (state: ControllerState) => void;
  /** New results (or an error) are ready to render, with the rows more() added. Called before onChange. */
  onShow?: (state: ControllerState, added?: SearchResult[]) => void;
  /** Results arrived and are shown. `more` is true when they came from more(). */
  onResults?: (detail: { query: string; results: SearchResult[]; settled: boolean; more: boolean }) => void;
  /** A search or a "Show more" failed. */
  onError?: (error: unknown, query: string) => void;
  /** A church is about to be chosen. Return false to cancel. */
  onSelect?: (result: SearchResult) => boolean | void;
}

export type LookupController = ReturnType<typeof createLookupController>;

export function createLookupController(opts: ControllerOptions = {}) {
  let own: Lookup | null = null;
  const client = (): Lookup => {
    const l = typeof opts.lookup === "function" ? opts.lookup() : opts.lookup;
    return l ?? (own ??= createLookup({ client: opts.client, baseUrl: opts.baseUrl }));
  };
  const state: ControllerState = { query: "", results: [], active: -1, open: false, loading: false, error: false, selected: null, hasMore: false, loadingMore: false, corrected: null };
  let timers: ReturnType<typeof setTimeout>[] = [];
  let ctrl: AbortController | null = null;
  let seq = 0;
  /** The query the shown results belong to, and the ranked rows more() hasn't revealed yet. */
  let shown = "";
  let rest: SearchResult[] = [];
  const emit = () => opts.onChange?.(state);
  const clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; };
  const params = (): SearchParams => (typeof opts.params === "function" ? opts.params() : opts.params) ?? {};
  const most = (p: SearchParams) => Math.min(p.maxResults || MAX_RESULTS, MAX_RESULTS);
  const page = (p: SearchParams) => Math.max(1, Math.min(p.limit || PAGE_SIZE, most(p)));
  const current = () => (opts.text ? opts.text().trim() : state.query);
  const isAbort = (e: unknown, n: number) => (e as Error).name === "AbortError" || n !== seq;

  function request(q: string, settled: boolean, limit: number) {
    ctrl?.abort();
    const mine = (ctrl = new AbortController());
    const p = params();
    return { n: ++seq, res: client().search(q, { settled, signal: mine.signal, region: p.region, country: p.country, near: p.near, lat: p.lat, lng: p.lng, limit, geo: p.geo !== false }) };
  }

  async function run(q: string, settled: boolean, retried = false): Promise<void> {
    const p = params();
    const { n, res } = request(q, settled, page(p));
    if (!state.loading) { state.loading = true; emit(); }
    try {
      const r = await res;
      if (n !== seq || current() !== q) return;
      rest = [];
      shown = q;
      show(r.results, false, (r.hasMore ?? r.results.length >= page(p)) && r.results.length < most(p), r.corrected);
      opts.onResults?.({ query: q, results: state.results, settled, more: false });
    } catch (e) {
      if (isAbort(e, n)) return;
      const wait = (e as LookupError).retryAfter;
      // A busy database asks for a short pause: wait once, quietly, then try again.
      if (!retried && (e as LookupError).status === 503 && wait && wait <= 5) {
        timers.push(setTimeout(() => void run(q, settled, true), wait * 1000));
        return;
      }
      opts.onError?.(e, q);
      show([], true, false, null);
    }
  }

  /** The highlighted church keeps its place when settled results arrive. */
  function show(next: SearchResult[], error: boolean, hasMore: boolean, corrected: string | null): void {
    const onMore = state.hasMore && state.active === state.results.length;
    const pinned = state.results[state.active];
    if (pinned) {
      const at = state.active;
      next = next.filter((r) => r.id !== pinned.id);
      next.splice(Math.min(at, next.length), 0, pinned);
      state.active = Math.min(at, next.length - 1);
    } else state.active = onMore && hasMore ? next.length : -1;
    Object.assign(state, { results: next, error, hasMore, corrected, loading: false, loadingMore: false, open: true });
    opts.onShow?.(state);
    emit();
  }

  /** Append the next page from the rows already loaded. The rows already shown never move. */
  function reveal(): SearchResult[] {
    const p = params();
    const added = rest.splice(0, Math.min(page(p), most(p) - state.results.length));
    const wasOnMore = state.active === state.results.length;
    state.results = state.results.concat(added);
    state.hasMore = rest.length > 0 && state.results.length < most(p);
    if (wasOnMore) state.active = state.results.length - (added.length || 1);
    opts.onShow?.(state, added);
    emit();
    opts.onResults?.({ query: shown, results: state.results, settled: true, more: true });
    return added;
  }

  /** Show the next page of results. Resolves to the rows it added. */
  async function more(): Promise<SearchResult[]> {
    const q = shown;
    if (!state.hasMore || state.loadingMore || current() !== q) return [];
    if (rest.length) return reveal();
    // One request for every row "Show more" can reach. It replaces any pending settled search.
    clearTimers();
    const p = params();
    const { n, res } = request(q, q.length >= SETTLED_MIN && p.semantic !== false, most(p));
    state.loadingMore = true;
    emit();
    try {
      const r = await res;
      if (n !== seq || current() !== q) return [];
      const seen = new Set(state.results.map((x) => x.id));
      rest = r.results.filter((x) => !seen.has(x.id));
      state.loadingMore = false;
      return reveal();
    } catch (e) {
      if (isAbort(e, n)) return [];
      state.loadingMore = false;
      opts.onError?.(e, q);
      emit();
      return [];
    }
  }

  return {
    get state(): Readonly<ControllerState> { return state; },
    get lookup(): Lookup { return client(); },
    /** The person typed. Debounces, then searches; long queries also get a settled search. */
    input(text: string): void {
      clearTimers();
      const q = text.trim();
      const p = params();
      state.query = q;
      // Typing after a pick starts over: the old choice no longer matches what's in the box.
      if (state.selected && q !== state.selected.name) state.selected = null;
      if (q.length < (p.minChars ?? MIN_QUERY)) {
        ctrl?.abort();
        Object.assign(state, { results: [], loading: false, loadingMore: false, open: false, active: -1, hasMore: false, corrected: null });
        emit();
        return;
      }
      emit();
      const wait = p.debounce ?? DEBOUNCE_MS;
      const settle = q.length >= SETTLED_MIN && p.semantic !== false;
      if (!settle || wait < SETTLE_MS) timers.push(setTimeout(() => void run(q, false), wait));
      if (settle) timers.push(setTimeout(() => void run(q, true), Math.max(SETTLE_MS, wait)));
    },
    /** Search the current text again, such as after an error. */
    retry(): void {
      clearTimers();
      if (state.query) void run(state.query, false);
    },
    more,
    /** Move the highlight by one, wrapping, through the results and the "Show more" row. Down on that row shows more. */
    move(dir: 1 | -1): void {
      const n = state.results.length + (state.hasMore ? 1 : 0);
      if (!state.open && state.results.length) state.open = true;
      if (!n) return emit();
      if (dir === 1 && state.hasMore && state.active === state.results.length) { void more(); return; }
      state.active = dir === 1 ? (state.active + 1) % n : state.active <= 0 ? n - 1 : state.active - 1;
      emit();
    },
    highlight(i: number): void { state.active = i; emit(); },
    open(): void { if (state.results.length) { state.open = true; emit(); } },
    close(): void { if (state.open) { state.open = false; emit(); } },
    /**
     * Choose a result (the highlighted one by default) and load its record. Resolves to the record, or
     * null when cancelled by onSelect, when the index is the "Show more" row (which shows more instead),
     * or when the text changed while it loaded. Rejects when the record can't load.
     */
    async choose(i = state.active): Promise<ChurchRecord | null> {
      if (i === state.results.length && state.hasMore) { await more(); return null; }
      const result = state.results[i];
      if (!result) return null;
      clearTimers();
      ctrl?.abort();
      // A new search after choosing starts fresh, with nothing pinned.
      Object.assign(state, { open: false, results: [], active: -1, loading: false, loadingMore: false, hasMore: false, corrected: null });
      rest = [];
      emit();
      if (opts.onSelect?.(result) === false) return null;
      state.query = result.name;
      emit();
      const record = await client().getChurch(result.id);
      if (state.query !== result.name) return null;
      state.selected = record.id === result.id ? result : { ...result, id: record.id };
      emit();
      return record;
    },
    /** Mark a church as chosen without searching, such as one saved earlier. */
    select(result: SearchResult | null): void { state.selected = result; if (result) state.query = result.name; emit(); },
    /** Forget the query, results and choice. */
    reset(): void {
      clearTimers();
      ctrl?.abort();
      rest = [];
      shown = "";
      Object.assign(state, { query: "", results: [], active: -1, open: false, loading: false, error: false, selected: null, hasMore: false, loadingMore: false, corrected: null });
      emit();
    },
    /** Stop pending searches, such as when the UI unmounts. */
    destroy(): void { clearTimers(); ctrl?.abort(); },
  };
}

// ── Fill ──

export interface FillChange { field: string; element: FieldTarget; value: string }
export interface FillPlan { changes: FillChange[]; empty: string[] }
type Targets = Map<string, FieldTarget> | Iterable<[string, FieldTarget]>;

/** What a fill would change: empty fields only unless overwrite, and only values a select can take. */
export function planFill(record: ChurchRecord, targets: Targets, { overwrite = false } = {}): FillPlan {
  const changes: FillChange[] = [];
  const empty: string[] = [];
  for (const [field, element] of targets) {
    const value = fieldValue(record, field);
    if (value == null) { empty.push(field); continue; }
    if (!overwrite && element.value.trim()) continue;
    let v: string | undefined = value;
    if (element instanceof HTMLSelectElement) {
      // An option whose value or text is the code or the name: "TX" or "Texas", "US" or "United States".
      const pair = fieldValue(record, field.endsWith("Name") ? field.slice(0, -4) : field + "Name");
      const want = [value, pair].map((x) => x?.trim().toLowerCase());
      v = [...element.options].find((o) => want.includes(o.value.toLowerCase()) || want.includes(o.text.trim().toLowerCase()))?.value;
      if (v == null) continue;
    }
    changes.push({ field, element, value: v });
  }
  return { changes, empty };
}

/** Set each value the way typing would, so React and other frameworks see it. */
export function applyFill(changes: FillChange[]): void {
  for (const c of changes) setNativeValue(c.element, c.value);
}

/** Fill form fields from a record. Returns what changed and which fields the directory had nothing for. */
export function fillTargets(record: ChurchRecord, targets: Targets, opts: { overwrite?: boolean } = {}): FillPlan {
  const plan = planFill(record, targets, opts);
  applyFill(plan.changes);
  return plan;
}

/**
 * The fields a church fills inside a scope (a form, by default the whole document): inputs tagged
 * data-hmc-field ("none" leaves one out), plus untagged ones `match` recognizes, such as matchField
 * from @heresmychurch/lookup/fields. A tag wins over a match, and the first match for a field wins.
 */
export function findTargets(scope: ParentNode = document, match?: (el: FieldTarget) => string | null): Map<string, FieldTarget> {
  const out = new Map<string, FieldTarget>();
  if (match) scope.querySelectorAll<FieldTarget>("input:not([data-hmc-field]),select:not([data-hmc-field]),textarea:not([data-hmc-field])").forEach((el) => {
    const f = match(el);
    if (f && !out.has(f)) out.set(f, el);
  });
  scope.querySelectorAll<FieldTarget>("[data-hmc-field]").forEach((el) => { if (el.dataset.hmcField !== "none") out.set(el.dataset.hmcField!, el); });
  return out;
}

// ── Consent ──

export type ContributableRule = NonNullable<Meta["contributableFields"]>[string];

/** The contribution rule for a form field in a church's country, or null if it can't be shared. */
export function contributable(meta: Meta | null | undefined, field: string, country: string): ContributableRule | null {
  const rule = meta?.contributableFields?.[ADDRESS_FIELDS.includes(field) ? "address" : field];
  if (!rule || (rule.countries !== "all" && !rule.countries.includes(country))) return null;
  return rule;
}

/** The form fields that make up an address. They're shown and sent as one "address" change. */
export const ADDRESS_FIELDS = ["street", "city", "postalCode"];

export interface ConsentRow { field: string; was: string; value: string }

/** Rows whose value changed from the record and hasn't already been sent as that value. */
export function consentDiff<T extends ConsentRow>(rows: T[], sent: Map<string, string> = new Map()): T[] {
  return rows.filter((r) => { const v = r.value.trim(); return v && v !== r.was && sent.get(r.field) !== v; });
}

/** Street, city and postal code rows become one "address" row in the first one's place, with `parts` to send. */
export function mergeAddress<T extends ConsentRow>(rows: T[]): (T & { parts?: Record<string, string> })[] {
  const parts = rows.filter((r) => ADDRESS_FIELDS.includes(r.field));
  if (!parts.length) return rows;
  const join = (k: "was" | "value") => parts.map((r) => r[k].trim()).filter(Boolean).join(", ");
  const address = { ...parts[0]!, field: "address", was: join("was"), value: join("value"), parts: Object.fromEntries(parts.map((r) => [r.field, r.value.trim()])) };
  return rows.flatMap((r) => (r === parts[0] ? [address] : parts.includes(r) ? [] : [r]));
}

/** The change to send for a consent row: an address goes as its parts. */
export const changeFor = (r: ConsentRow & { parts?: Record<string, string> }) => ({ field: r.field, value: r.parts ?? r.value.trim() });

// ── Here's My Church ──

export const HMC_SITE = "https://heresmychurch.com";
/** "Still correct?" is only worth asking when nobody has confirmed the listing for this long. */
export const STALE_MS = 365 * 864e5;

/** The listing was never confirmed, or not in the last 12 months. */
export function isStale(record: ChurchRecord, now = Date.now()): boolean {
  const v = record.freshness?.lastVerified;
  return v == null || now - v > STALE_MS;
}

/** The church's page with the suggest-a-fix form open, or null when the record has no page. */
export const suggestUrl = (record: ChurchRecord): string | null => (record.links?.heresMyChurch ? `${record.links.heresMyChurch}?suggest=1` : null);

/** Here's My Church's add-a-church form, prefilled with what's known. */
export function addUrl(p: { name?: string; city?: string; region?: string } = {}): string {
  const q = new URLSearchParams();
  for (const k of ["name", "city", "region"] as const) { const v = p[k]?.trim(); if (v) q.set(k, v); }
  const qs = q.toString();
  return `${HMC_SITE}/add${qs ? `?${qs}` : ""}`;
}

const ADD_KEYS = ["street", "city", "region", "postalCode", "country", "phone", "email", "website", "denomination", "serviceTimes", "languages", "ministries", "pastorName"];

/**
 * A church to add, from the name typed in the search box and the form fields a fill would use. A
 * select gives its value, which the API reads as a code or a name. Null until name, city and region are known.
 */
export function newChurchFrom(name: string, targets: Targets): NewChurch | null {
  const v: Record<string, string> = {};
  for (const [field, el] of targets) {
    const key = field === "regionName" ? "region" : field === "countryName" ? "country" : field;
    const val = el.value.trim();
    if (val && (ADD_KEYS.includes(key) || key === "name") && !v[key]) v[key] = val;
  }
  const { name: mapped, ...rest } = v;
  const church = { name: name.trim() || mapped || "", ...rest } as NewChurch;
  return church.name.length >= 3 && church.city && church.region ? church : null;
}
