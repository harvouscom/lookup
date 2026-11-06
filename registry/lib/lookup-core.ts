// Lookup by Here's My Church, headless core v0.2.0. Generated from @heresmychurch/lookup
// (packages/sdk/src) by scripts/build-registry.mjs. MIT. https://lookup.heresmychurch.com/docs
/* eslint-disable */

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
  corrected: string | null;
  degraded: boolean;
  attribution: string;
}

export interface ChurchRecord {
  id: string;
  movedTo?: string;
  fields: Record<string, unknown> & { name: string; serviceTimes: { raw: string | null } };
  missing: string[];
  completeness: number;
  hints: { nearestPlace: string | null };
  attribution: string;
}

/** What happened to one contributed field. See the API docs for each status. */
export type FieldStatus = "live" | "in_review" | "not_applied" | "rejected" | "try_again" | "coming_soon";
export interface ContributionResult {
  churchId: string;
  sandbox?: boolean;
  results: { field: string; status: FieldStatus; message?: string }[];
}
export interface ConfirmResult { churchId: string; sandbox?: boolean; status: "confirmed" | FieldStatus; message?: string; lastVerified?: number }
export interface Meta {
  fields: string[];
  contributableFields: Record<string, { countries: "all" | string[]; review: "live" | "moderated"; status?: "coming_soon" }>;
  completenessWeights: Record<string, number>;
  attribution: string;
}

export class LookupError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export interface LookupOptions {
  baseUrl?: string;
  /** Your tool's name, such as "my-chms". Self-declared; shown to reviewers as declared. */
  client?: string;
  fetch?: typeof fetch;
}

export function createLookup(opts: LookupOptions = {}) {
  const base = (opts.baseUrl ?? "https://lookup.heresmychurch.com").replace(/\/+$/, "") + "/v1";
  const f = opts.fetch ?? fetch.bind(globalThis);

  async function get<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
    const res = await f(base + path, { signal, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new LookupError(res.status, body.error ?? res.statusText, Number(res.headers.get("retry-after")) || undefined);
    return body;
  }

  const post = <T>(path: string, body: unknown) =>
    get<T>(path, undefined, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  return {
    search(q: string, o: SearchOptions = {}): Promise<SearchResponse> {
      const p = new URLSearchParams({ q });
      for (const k of ["near", "lat", "lng", "country", "region", "limit"] as const) if (o[k] != null) p.set(k, String(o[k]));
      if (o.settled) p.set("settled", "1");
      if (o.geo === false) p.set("geo", "off");
      if (opts.client) p.set("client", opts.client);
      return get(`/search?${p}`, o.signal);
    },
    getChurch(id: string, o: { signal?: AbortSignal } = {}): Promise<ChurchRecord> {
      return get(`/churches/${encodeURIComponent(id)}`, o.signal);
    },
    /** Field names, which fields can be contributed and how each is reviewed. */
    meta(): Promise<Meta> {
      return get("/meta");
    },
    /** Send corrections. Each field comes back live, in review, or with a reason. */
    contribute(id: string, changes: { field: string; value: unknown }[]): Promise<ContributionResult> {
      return post(`/churches/${encodeURIComponent(id)}/contributions`, { client: opts.client ?? "unknown", changes });
    },
    /** "Still correct": bumps the church's last-verified date. */
    confirm(id: string): Promise<ConfirmResult> {
      return post(`/churches/${encodeURIComponent(id)}/confirm`, { client: opts.client ?? "unknown" });
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
}


/** Shared across separately loaded bundles, so a language file can register into the element. */
const REG_KEY = "__hmcLookupStrings";
type Registry = Record<string, Strings>;
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
    filled: (n, m) => `Filled ${n} ${n === 1 ? "field" : "fields"}.${list(m, "Not available:")}`,
    loadFail: "Couldn't load that church's details. You can type them in.",
    dataFrom: "Data from",
    clear: "Clear church",
    required: "Choose your church from the list.",
    shareTitle: "Share your fixes with Here's My Church?",
    shareBody: "Checked changes help every church app. Nothing is sent until you choose Share.",
    share: "Share",
    notNow: "Not now",
    goesLive: "Goes live",
    reviewed: "A moderator reviews it",
    soon: "Coming soon",
    st: { live: "Live now", in_review: "Sent for review", not_applied: "Already up to date", rejected: "Not accepted", try_again: "Couldn't send. Try again shortly.", coming_soon: "Coming soon" },
    shared: (n) => `Shared ${n} ${n === 1 ? "change" : "changes"}.`,
    sending: "Sending…",
    sandbox: "Demo only: nothing was sent.",
    confirmQ: "Details from Here's My Church. Still correct?",
    stillCorrect: "Still correct",
    done: "Done",
    thanks: "Thanks for confirming.",
    changedNote: (n) => `You changed ${n} ${n === 1 ? "detail" : "details"}. You can share ${n === 1 ? "it" : "them"} with Here's My Church below the church field.`,
  };

/** The languages with a strings file next to the element. */
export const LANGS = ["es", "fr", "de", "pt", "pl"];

/** Add or replace a language. Elements already on the page pick it up. */
export function registerStrings(lang: string, strings: Strings): void {
  registry()[lang] = strings;
  if (typeof document !== "undefined") document.dispatchEvent(new Event("hmc-strings"));
}

/** The strings for a language tag such as "es-MX", falling back to English. */
export function stringsFor(lang: string | null | undefined): Strings {
  const base = (lang ?? "").toLowerCase().split("-")[0]!;
  return registry()[base] ?? EN;
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

/** A record field as the text a form field should hold, or null when the directory has nothing. */
export function fieldValue(record: ChurchRecord, field: string): string | null {
  const v = field === "id" ? record.id : record.fields[field];
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "object") return (v as { raw?: string | null }).raw ?? null;
  return String(v);
}

// ── Search state ──

export interface SearchParams { region?: string; country?: string; near?: string; limit?: number; geo?: boolean }

export interface ControllerState {
  /** The text being searched, trimmed. */
  query: string;
  results: SearchResult[];
  /** Index of the highlighted result, or -1. */
  active: number;
  open: boolean;
  /** True while a search for the current query is in flight. */
  loading: boolean;
  /** Search failed; the results are empty. */
  error: boolean;
  /** The chosen church, or null. */
  selected: SearchResult | null;
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
  /** New results (or an error) are ready to render. Called before onChange opens the list. */
  onShow?: (state: ControllerState) => void;
  /** Results arrived and are shown. */
  onResults?: (detail: { query: string; results: SearchResult[]; settled: boolean }) => void;
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
  const state: ControllerState = { query: "", results: [], active: -1, open: false, loading: false, error: false, selected: null };
  let timers: ReturnType<typeof setTimeout>[] = [];
  let ctrl: AbortController | null = null;
  let seq = 0;
  const emit = () => opts.onChange?.(state);
  const clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; };

  async function run(q: string, settled: boolean): Promise<void> {
    ctrl?.abort();
    const mine = (ctrl = new AbortController());
    const n = ++seq;
    const p = (typeof opts.params === "function" ? opts.params() : opts.params) ?? {};
    state.loading = true;
    try {
      const res = await client().search(q, { settled, signal: mine.signal, region: p.region, country: p.country, near: p.near, limit: p.limit || 8, geo: p.geo !== false });
      if (n !== seq || (opts.text ? opts.text().trim() : state.query) !== q) return;
      show(res.results, false);
      opts.onResults?.({ query: q, results: state.results, settled });
    } catch (e) {
      if ((e as Error).name === "AbortError" || n !== seq) return;
      show([], true);
    }
  }

  /** The highlighted church keeps its place when settled results arrive. */
  function show(next: SearchResult[], error: boolean): void {
    const pinned = state.results[state.active];
    if (pinned) {
      const at = state.active;
      next = next.filter((r) => r.id !== pinned.id);
      next.splice(Math.min(at, next.length), 0, pinned);
      state.active = Math.min(at, next.length - 1);
    } else state.active = -1;
    state.results = next;
    state.error = error;
    state.loading = false;
    state.open = true;
    opts.onShow?.(state);
    emit();
  }

  return {
    get state(): Readonly<ControllerState> { return state; },
    get lookup(): Lookup { return client(); },
    /** The person typed. Debounces, then searches; long queries also get a settled search. */
    input(text: string): void {
      clearTimers();
      const q = text.trim();
      state.query = q;
      // Typing after a pick starts over: the old choice no longer matches what's in the box.
      if (state.selected && q !== state.selected.name) state.selected = null;
      if (q.length < MIN_QUERY) {
        ctrl?.abort();
        state.results = [];
        state.loading = false;
        state.open = false;
        state.active = -1;
        emit();
        return;
      }
      emit();
      timers.push(setTimeout(() => void run(q, false), DEBOUNCE_MS));
      if (q.length >= SETTLED_MIN) timers.push(setTimeout(() => void run(q, true), SETTLE_MS));
    },
    /** Move the highlight by one, wrapping. Opens the list if it has results. */
    move(dir: 1 | -1): void {
      const n = state.results.length;
      if (!state.open && n) state.open = true;
      if (!n) return emit();
      state.active = dir === 1 ? (state.active + 1) % n : state.active <= 0 ? n - 1 : state.active - 1;
      emit();
    },
    highlight(i: number): void { state.active = i; emit(); },
    open(): void { if (state.results.length) { state.open = true; emit(); } },
    close(): void { if (state.open) { state.open = false; emit(); } },
    /**
     * Choose a result (the highlighted one by default) and load its record. Resolves to the record,
     * or null when cancelled by onSelect. Rejects when the record can't load.
     */
    async choose(i = state.active): Promise<ChurchRecord | null> {
      const result = state.results[i];
      if (!result) return null;
      clearTimers();
      state.open = false;
      // A new search after choosing starts fresh, with nothing pinned.
      state.results = [];
      state.active = -1;
      emit();
      if (opts.onSelect?.(result) === false) return null;
      state.selected = result;
      state.query = result.name;
      emit();
      return client().getChurch(result.id);
    },
    /** Mark a church as chosen without searching, such as one saved earlier. */
    select(result: SearchResult | null): void { state.selected = result; if (result) state.query = result.name; emit(); },
    /** Forget the query, results and choice. */
    reset(): void {
      clearTimers();
      ctrl?.abort();
      Object.assign(state, { query: "", results: [], active: -1, open: false, loading: false, error: false, selected: null });
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
    if (element instanceof HTMLSelectElement && ![...element.options].some((o) => o.value === value)) continue;
    changes.push({ field, element, value });
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

/** Fields tagged data-hmc-field inside a scope (a form, by default the whole document). */
export function findTargets(scope: ParentNode = document): Map<string, FieldTarget> {
  const out = new Map<string, FieldTarget>();
  scope.querySelectorAll<FieldTarget>("[data-hmc-field]").forEach((el) => out.set(el.dataset.hmcField!, el));
  return out;
}

// ── Consent ──

export type ContributableRule = NonNullable<Meta["contributableFields"]>[string];

/** The contribution rule for a form field in a church's country, or null if it can't be shared. */
export function contributable(meta: Meta | null | undefined, field: string, country: string): ContributableRule | null {
  const rule = meta?.contributableFields?.[field === "street" ? "address" : field];
  if (!rule || (rule.countries !== "all" && !rule.countries.includes(country))) return null;
  return rule;
}

export interface ConsentRow { field: string; was: string; value: string }

/** Rows whose value changed from the record and hasn't already been sent as that value. */
export function consentDiff<T extends ConsentRow>(rows: T[], sent: Map<string, string> = new Map()): T[] {
  return rows.filter((r) => { const v = r.value.trim(); return v && v !== r.was && sent.get(r.field) !== v; });
}
