// hmc-lookup Worker. Lexical search, the autofill record and metadata.
// Queries are never logged: invocation logs are off, and request location stays in memory.
import { COMPLETENESS_WEIGHTS, CONTRIBUTABLE_FIELDS, RECORD_FIELDS, toRecord, type ChurchRow } from "./record.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";
import { search } from "./search.ts";

export interface Env {
  DB: D1Database;
  RL_SEARCH?: RateLimit;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
}

export const ATTRIBUTION = "Church data from OpenStreetMap contributors (ODbL) and Here's My Church contributors.";
const MAX_QUERY = 120;
const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 8;
const CACHE_SECONDS = { search: 300, church: 300, meta: 3600 };

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...headers },
  });
}
const fail = (status: number, error: string, headers: Record<string, string> = {}) =>
  json({ error, attribution: ATTRIBUTION }, status, { "cache-control": "no-store", ...headers });

const round = (v: number) => Math.round(v * 10) / 10;

function number(url: URL, name: string, min: number, max: number): number | null | "invalid" {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= min && v <= max ? v : "invalid";
}

export const isOverload = (e: unknown): boolean => /overloaded|too many|database is locked|busy/i.test(String((e as Error)?.message ?? e));

async function cached(request: Request, env: Env, ctx: ExecutionContext, key: string, seconds: number, produce: () => Promise<Response>): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  // Keyed by deployed version, so a ranking change can't serve results from the previous one.
  const version = env.CF_VERSION_METADATA?.id ?? "dev";
  const req = new Request(`https://${new URL(request.url).hostname}/__cache/${version}${key}`);
  const hit = await cache.match(req);
  if (hit) {
    const out = new Response(hit.body, hit);
    out.headers.set("x-lookup-cache", "hit");
    return out;
  }
  const res = await produce();
  if (res.status === 200) {
    res.headers.set("cache-control", `public, max-age=${Math.min(seconds, 60)}, s-maxage=${seconds}`);
    ctx.waitUntil(cache.put(req, res.clone()));
  }
  res.headers.set("x-lookup-cache", "miss");
  return res;
}

async function handleSearch(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length > MAX_QUERY) return fail(400, "q is too long");
  const lat = number(url, "lat", -90, 90), lng = number(url, "lng", -180, 180), limitRaw = number(url, "limit", 1, MAX_LIMIT);
  if (lat === "invalid" || lng === "invalid" || limitRaw === "invalid") return fail(400, "lat, lng or limit is out of range");
  if ((lat === null) !== (lng === null)) return fail(400, "lat and lng must be sent together");
  const limit = limitRaw ?? DEFAULT_LIMIT;
  const country = url.searchParams.get("country")?.toUpperCase() || null;
  const region = url.searchParams.get("region")?.toUpperCase() || null;
  if (country && !COUNTRIES[country]) return fail(400, "unknown country");
  if (region && !REGIONS[region]) return fail(400, "unknown region");
  const near = url.searchParams.get("near")?.slice(0, MAX_QUERY) || null;

  const base = { attribution: ATTRIBUTION };
  if (q.length < 2 && !near) return json({ query: q, results: [], place: null, corrected: null, degraded: false, ...base });

  const cf = (request as unknown as { cf?: IncomingRequestCfProperties }).cf;
  const useGeo = url.searchParams.get("geo") !== "off";
  const cfLat = useGeo && cf?.latitude ? Number(cf.latitude) : null;
  const cfLng = useGeo && cf?.longitude ? Number(cf.longitude) : null;
  // Rounded to about 10 km before use, for privacy and so nearby people share cache entries.
  const user = useGeo && lat === null
    ? { lat: cfLat === null || Number.isNaN(cfLat) ? null : round(cfLat), lng: cfLng === null || Number.isNaN(cfLng) ? null : round(cfLng), country: (cf?.country as string | undefined) ?? null }
    : null;
  const key = new URLSearchParams({ q, l: String(limit) });
  if (near) key.set("near", near);
  if (country) key.set("c", country);
  if (region) key.set("r", region);
  if (lat !== null) key.set("at", `${round(lat)},${round(lng as number)}`);
  if (user) key.set("u", `${user.lat},${user.lng},${user.country}`);

  return cached(request, env, ctx, `/v1/search?${key}`, CACHE_SECONDS.search, async () => {
    const started = Date.now();
    const session = env.DB.withSession("first-unconstrained");
    const r = await search(session, {
      q, near, country, region, limit, user,
      lat: lat === null ? null : round(lat),
      lng: lng === null ? null : round(lng as number),
    });
    return json({ query: q, results: r.results, place: r.place, corrected: r.corrected, degraded: r.degraded, ...base }, 200, {
      "server-timing": `d1;dur=${r.timing.d1Ms};desc="${r.timing.statements} statements", total;dur=${Date.now() - started}`,
    });
  });
}

async function handleChurch(request: Request, env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  if (id.length > 80) return fail(404, "not found");
  return cached(request, env, ctx, `/v1/churches/${encodeURIComponent(id)}`, CACHE_SECONDS.church, async () => {
    const session = env.DB.withSession("first-unconstrained");
    const row = await session.prepare("SELECT * FROM church WHERE id = ?").bind(id).first<ChurchRow>();
    if (row) return json({ ...toRecord(row), attribution: ATTRIBUTION });
    const moved = await session.prepare("SELECT moved_to FROM moved WHERE id = ?").bind(id).first<{ moved_to: string }>();
    if (moved) return json({ id, movedTo: moved.moved_to, attribution: ATTRIBUTION });
    return fail(404, "not found");
  });
}

async function handleMeta(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return cached(request, env, ctx, "/v1/meta", CACHE_SECONDS.meta, async () => {
    const row = await env.DB.prepare("SELECT value FROM lookup_meta WHERE key = 'build'").first<{ value: string }>();
    const build = row ? JSON.parse(row.value) : null;
    return json({
      fields: RECORD_FIELDS,
      contributableFields: CONTRIBUTABLE_FIELDS,
      completenessWeights: COMPLETENESS_WEIGHTS,
      counts: build?.counts ?? null,
      fieldFill: build?.fill ?? null,
      builtAt: build?.builtAt ?? null,
      attribution: ATTRIBUTION,
    });
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "method not allowed", { allow: "GET, OPTIONS" });

    const path = url.pathname.replace(/\/+$/, "");
    const churchMatch = path.match(/^\/v1\/churches\/([^/]+)$/);
    if (path !== "/v1/search" && path !== "/v1/meta" && !churchMatch) return fail(404, "not found");

    if (env.RL_SEARCH) {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.RL_SEARCH.limit({ key: ip });
      if (!success) return fail(429, "too many requests", { "retry-after": "60" });
    }
    try {
      if (path === "/v1/search") return await handleSearch(request, env, ctx, url);
      if (path === "/v1/meta") return await handleMeta(request, env, ctx);
      return await handleChurch(request, env, ctx, decodeURIComponent(churchMatch![1]!));
    } catch (e) {
      if (isOverload(e)) return fail(503, "overloaded", { "retry-after": "2" });
      return fail(500, "search is unavailable");
    }
  },
} satisfies ExportedHandler<Env>;
