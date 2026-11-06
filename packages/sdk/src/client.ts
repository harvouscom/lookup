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

export interface ChurchRecord {
  id: string;
  /** Only with { follow: false }: this listing merged into another. Load that ID instead. */
  movedTo?: string;
  /** The ID you asked for, when it merged into this church. Store this record's `id` instead. */
  movedFrom?: string;
  fields: Record<string, unknown> & { name: string; serviceTimes: { raw: string | null } };
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
  /** A stable reason: invalid, not_found, rate_limited, overloaded, unavailable, … */
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
}

export function createLookup(opts: LookupOptions = {}) {
  const base = (opts.baseUrl ?? "https://lookup.heresmychurch.com").replace(/\/+$/, "") + "/v1";
  const f = opts.fetch ?? fetch.bind(globalThis);

  async function get<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
    const res = await f(base + path, { signal, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new LookupError(res.status, body.error ?? res.statusText, Number(res.headers.get("retry-after")) || undefined, body.code);
    return body;
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
