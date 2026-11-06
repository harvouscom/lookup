// @heresmychurch/lookup/core: the headless engine behind <church-lookup>, for building your own UI
// (the shadcn registry components use it). No rendering and no side effects on import: nothing is
// registered, and timers only run while a search is pending.
import { createLookup, type ChurchRecord, type Lookup, type Meta, type SearchResult } from "./client.ts";
import { setNativeValue, type FieldTarget } from "./dom.ts";

export * from "./client.ts";
export { setNativeValue, type FieldTarget };
export { EN, LANGS, registerStrings, stringsFor, type Strings } from "./strings.ts";

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
