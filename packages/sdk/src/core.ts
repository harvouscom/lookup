// @heresmychurch/lookup/core: the headless engine behind <church-lookup>, for building your own UI
// (the shadcn registry components use it). No rendering and no side effects on import: nothing is
// registered, and timers only run while a search is pending.
import { createLookup, type ChurchRecord, type Lookup, type LookupError, type Meta, type NewChurch, type SearchResult } from "./client.ts";
import { setNativeValue, type FieldTarget } from "./dom.ts";

export * from "./client.ts";
export { setNativeValue, type FieldTarget };
export { EN, LANGS, registerStrings, stringsFor, type Strings } from "./strings.ts";

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
