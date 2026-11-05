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

export class LookupError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) {
    super(message);
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

  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await f(base + path, { signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new LookupError(res.status, body.error ?? res.statusText, Number(res.headers.get("retry-after")) || undefined);
    return body;
  }

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
  };
}

export type Lookup = ReturnType<typeof createLookup>;
