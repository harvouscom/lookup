// @heresmychurch/lookup core client. No dependencies.
import { devWarn } from "./dev.ts";

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
  /** The church has claimed its listing on Here's My Church. Others' changes go to the church first. */
  claimed?: boolean;
  attribution: string;
}

/** What happened to one contributed field. See the API docs for each status. */
export type FieldStatus = "live" | "in_review" | "not_applied" | "rejected" | "try_again" | "coming_soon";
export interface ContributionResult {
  churchId: string;
  sandbox?: boolean;
  /** reviewBy "church": the change is held for the church itself to review (a claimed listing). */
  results: { field: string; status: FieldStatus; message?: string; reviewBy?: "church" }[];
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
  /** `checks`: "automatic" fields are decided by Here's My Church's checks; "automatic-then-reviewer" ones go to a person when the checks can't decide; "reviewer" always does. */
  contributableFields: Record<string, { countries: "all" | string[]; review: "live" | "moderated"; checks?: "automatic" | "automatic-then-reviewer" | "reviewer"; status?: "coming_soon" }>;
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
