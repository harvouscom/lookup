// Contributions and confirmations: people's corrections flow back to Here's My Church through its
// internal Lookup routes. Every field gets its own status so the widget can say exactly what happened:
//   live         applied now (fields that go live on one vote)
//   in_review    waits for a Here's My Church moderator
//   not_applied  accepted, but the stored value didn't change (consensus kept the old one)
//   rejected     Here's My Church refused it (a 4xx), with its reason
//   try_again    a temporary problem (maintenance, rate limit, outage): nothing was lost or refused
//   coming_soon  a field Lookup will accept once Here's My Church does (name, until it deploys)
// A change that goes live comes back with the updated church, which is written straight into D1 so
// search and the record show it before the next sync. Adding a church works the same way.
import type { ExportChurch } from "./project.ts";
import { tokenize } from "./project.ts";
import { CONTRIBUTABLE_FIELDS } from "./record.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";
import { locationLabel } from "./search.ts";
import { writeChurch } from "./sync.ts";

export interface ContributeEnv {
  DB: D1Database;
  HMC_API?: Fetcher;
  RL_CONTRIB?: RateLimit;
  LOOKUP_INTERNAL_KEY?: string;
  /** Kill switch: anything but "true" pauses contributions and confirmations. */
  CONTRIBUTIONS_ENABLED?: string;
  /** "true" once Here's My Church accepts name suggestions. */
  NAME_CONTRIBUTIONS?: string;
  /** Contributions accepted per UTC day across everyone. Defaults to 2000. */
  CONTRIBUTIONS_DAILY_CAP?: string;
  /** Kill switch for adding churches. Anything but "true" pauses it. */
  ADD_ENABLED?: string;
}

export type FieldStatus = "live" | "in_review" | "not_applied" | "rejected" | "try_again" | "coming_soon";
export interface FieldResult { field: string; status: FieldStatus; message?: string }

const HMC = "https://api.heresmychurch.com/internal/lookup";
const CLIENT_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const SANDBOX_CLIENT = "lookup-demo";
const MAX_CHANGES = 8;
const MAX_VALUE = 600;
const MAX_RETRY_WAIT_MS = 8000;
const DEFAULT_DAILY_CAP = 2000;

type Contributable = keyof typeof CONTRIBUTABLE_FIELDS;
/** Record field names (what the widget fills) to Here's My Church's field names. */
const TO_HMC: Record<string, Contributable> = {
  name: "name", street: "address", city: "address", postalCode: "address", address: "address", phone: "phone", website: "website",
  denomination: "denomination", serviceTimes: "serviceTimes", languages: "languages", ministries: "ministries",
  email: "email", pastorName: "pastorName", reportClosed: "reportClosed", reportDuplicate: "reportDuplicate", reportRelocated: "reportRelocated",
};
/** The record fields that make up one address. They're sent to Here's My Church as one change. */
const ADDRESS_PARTS = { street: "street", city: "city", postalCode: "postal_code" } as const;
type AddressPart = keyof typeof ADDRESS_PARTS;

export const nameOpen = (env: ContributeEnv) => env.NAME_CONTRIBUTIONS === "true";

/** The contributable-field table for /v1/meta, with name marked coming soon until it's accepted. */
export function contributableFields(env: ContributeEnv) {
  const out: Record<string, { countries: "all" | readonly string[]; review: string; status?: "coming_soon" }> = {};
  for (const [k, v] of Object.entries(CONTRIBUTABLE_FIELDS)) out[k] = k === "name" && !nameOpen(env) ? { ...v, status: "coming_soon" } : { ...v };
  return out;
}

/** A salted, one-way hash of the visitor's IP, so Here's My Church counts people, never stores IPs. */
export async function ipHash(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`lookup-ip:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip)));
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST to Here's My Church, retrying once on its maintenance 503 after honoring Retry-After. */
export async function postHmc(env: ContributeEnv, path: string, body: unknown, wait = sleep): Promise<Response> {
  const send = () => {
    const init = { method: "POST", headers: { "content-type": "application/json", "x-lookup-key": env.LOOKUP_INTERNAL_KEY ?? "" }, body: JSON.stringify(body) };
    return env.HMC_API ? env.HMC_API.fetch(`${HMC}${path}`, init) : fetch(`${HMC}${path}`, init);
  };
  const first = await send();
  if (first.status !== 503) return first;
  const after = Number(first.headers.get("retry-after"));
  await wait(Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 2000, MAX_RETRY_WAIT_MS));
  return send();
}

async function errorText(res: Response): Promise<string> {
  try { const b = (await res.json()) as { error?: string }; return b.error ?? `HTTP ${res.status}`; } catch { return `HTTP ${res.status}`; }
}

/** Map one Here's My Church response to a field status. 503 and 429 are never "rejected". */
export async function statusFrom(res: Response): Promise<{ status: FieldStatus; message?: string; church?: ExportChurch }> {
  if (res.ok) {
    const b = (await res.json().catch(() => ({}))) as { applied?: boolean; needsModeration?: boolean; church?: ExportChurch };
    const status: FieldStatus = b.needsModeration ? "in_review" : b.applied ? "live" : "not_applied";
    return { status, ...(status === "live" && isExport(b.church) ? { church: b.church } : {}) };
  }
  if (res.status === 503 || res.status === 429 || res.status >= 500) {
    return { status: "try_again", message: res.status === 429 ? "Too many changes right now. Try again later." : "Here's My Church is busy for a moment. Try again shortly." };
  }
  return { status: "rejected", message: await errorText(res) };
}

const isExport = (c: unknown): c is ExportChurch =>
  Boolean(c) && typeof (c as ExportChurch).id === "string" && typeof (c as ExportChurch).name === "string" && typeof (c as ExportChurch).country === "string";

/** Lists and service times arrive as strings or arrays; Here's My Church takes one string. */
function asText(v: unknown): string | null {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(", ") || null;
  if (v && typeof v === "object" && "raw" in v) return asText((v as { raw: unknown }).raw);
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

/** The current stored value of a field, to tell a real change from the same value sent again. */
function currentValue(row: Record<string, unknown>, field: string): string | null {
  const col: Record<string, string> = { name: "name", street: "street", address: "street", city: "city", postalCode: "postal_code", phone: "phone", email: "email", website: "website", denomination: "denomination", serviceTimes: "service_times", languages: "languages", ministries: "ministries", pastorName: "pastor_name" };
  const v = row[col[field] ?? field];
  if (typeof v === "string" && v.startsWith("[")) { try { return asText(JSON.parse(v)); } catch { /* plain text */ } }
  return asText(v);
}

/** A global daily cap, counted in D1 so it holds across every Worker instance. */
async function underDailyCap(env: ContributeEnv, n: number): Promise<boolean> {
  const cap = Number(env.CONTRIBUTIONS_DAILY_CAP) || DEFAULT_DAILY_CAP;
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS contrib_daily (day TEXT PRIMARY KEY, n INTEGER NOT NULL)").run();
  const row = await env.DB.prepare("INSERT INTO contrib_daily (day, n) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET n = n + excluded.n RETURNING n").bind(day, n).first<{ n: number }>();
  return (row?.n ?? 0) <= cap;
}

/** `purge` lists church IDs whose cached record is now stale. */
const reply = (body: unknown, status = 200, purge: string[] = []) => ({ body, status, purge });
type Reply = ReturnType<typeof reply>;

async function guard(env: ContributeEnv, ip: string, client: unknown): Promise<Reply | null> {
  if (env.CONTRIBUTIONS_ENABLED !== "true") return reply({ error: "Contributions are paused. Nothing was sent.", retryable: true }, 503);
  if (typeof client !== "string" || !CLIENT_RE.test(client)) return reply({ error: "client must be 2-40 lowercase letters, numbers or hyphens" }, 400);
  if (client !== SANDBOX_CLIENT && !env.LOOKUP_INTERNAL_KEY) return reply({ error: "Contributions are paused. Nothing was sent.", retryable: true }, 503);
  if (env.RL_CONTRIB && !(await env.RL_CONTRIB.limit({ key: ip })).success) return reply({ error: "Too many changes. Try again in a minute.", retryable: true }, 429);
  return null;
}

async function churchRow(env: ContributeEnv, id: string): Promise<Record<string, unknown> | null> {
  if (!id || id.length > 80) return null;
  return env.DB.prepare("SELECT * FROM church WHERE id = ?").bind(id).first<Record<string, unknown>>();
}

/**
 * Street, city and postal code (sent separately, or together as `address`) become one address
 * change in Here's My Church's structured form. Parts left out keep their listed values.
 */
function addressValue(row: Record<string, unknown>, parts: Partial<Record<AddressPart, string>>): string {
  const pick = (k: AddressPart) => parts[k] ?? asText(row[ADDRESS_PARTS[k]]) ?? "";
  return JSON.stringify({ address: pick("street"), city: pick("city"), state: String(row.region ?? ""), postcode: pick("postalCode"), country: String(row.country ?? "") });
}

function addressParts(v: unknown): Partial<Record<AddressPart, string>> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const out: Partial<Record<AddressPart, string>> = {};
    for (const k of Object.keys(ADDRESS_PARTS) as AddressPart[]) { const t = asText(o[k]); if (t !== null) out[k] = t; }
    return Object.keys(out).length ? out : null;
  }
  const t = asText(v);
  return t ? { street: t } : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Write a church Here's My Church sent back into D1. A failure here is caught by the next sync. */
async function writeBack(env: ContributeEnv, church: ExportChurch | undefined, region: string): Promise<boolean> {
  if (!church) return false;
  try { await writeChurch(env, church, region); return true; } catch { return false; }
}

/** POST /v1/churches/:id/contributions  { client, changes: [{ field, value }] } */
export async function contribute(env: ContributeEnv, id: string, ip: string, input: unknown, wait = sleep): Promise<Reply> {
  const body = (input ?? {}) as { client?: unknown; changes?: unknown };
  const denied = await guard(env, ip, body.client);
  if (denied) return denied;
  const client = body.client as string;
  if (!Array.isArray(body.changes) || !body.changes.length) return reply({ error: "changes must list at least one { field, value }" }, 400);
  if (body.changes.length > MAX_CHANGES) return reply({ error: `At most ${MAX_CHANGES} changes at once` }, 400);
  const row = await churchRow(env, id);
  if (!row) return reply({ error: "Church not found" }, 404);
  const country = String(row.country ?? "");
  const sandbox = client === SANDBOX_CLIENT;

  // Validate everything first, so a bad field can't leave half a batch sent. Address parts share one send.
  type Plan = { fields: string[]; hmcField: Contributable; value: string; result?: Omit<FieldResult, "field"> };
  const plan: Plan[] = [];
  let address: (Plan & { parts: Partial<Record<AddressPart, string>> }) | null = null;
  const order: Plan[] = [];
  for (const c of body.changes as { field?: unknown; value?: unknown }[]) {
    const field = String(c?.field ?? "");
    const hmcField = TO_HMC[field];
    const fail = (status: FieldStatus, message?: string) => { const p: Plan = { fields: [field], hmcField: hmcField ?? "name", value: "", result: { status, ...(message ? { message } : {}) } }; plan.push(p); order.push(p); };
    if (!hmcField) { fail("rejected", "This field can't be contributed through Lookup"); continue; }
    const rule = CONTRIBUTABLE_FIELDS[hmcField];
    if (hmcField === "name" && !nameOpen(env)) { fail("coming_soon", "Name corrections are coming soon. Nothing was sent for this field."); continue; }
    if (rule.countries !== "all" && !(rule.countries as readonly string[]).includes(country)) { fail("rejected", `${field} corrections aren't accepted for this country yet`); continue; }
    if (hmcField === "address") {
      const parts = field === "address" ? addressParts(c?.value) : (() => { const t = asText(c?.value); return t ? { [field as AddressPart]: t } : null; })();
      if (!parts) { fail("rejected", "A value is required"); continue; }
      if (Object.values(parts).some((v) => v!.length > MAX_VALUE)) { fail("rejected", `Value is too long (max ${MAX_VALUE} characters)`); continue; }
      if (!address) { address = { fields: [], hmcField, value: "", parts: {} }; plan.push(address); }
      address.fields.push(field);
      Object.assign(address.parts, parts);
      order.push(address);
      continue;
    }
    const value = asText(c?.value);
    if (!value) { fail("rejected", "A value is required"); continue; }
    if (value.length > MAX_VALUE) { fail("rejected", `Value is too long (max ${MAX_VALUE} characters)`); continue; }
    if (hmcField === "email" && !EMAIL_RE.test(value)) { fail("rejected", "That doesn't look like an email address"); continue; }
    if (value === currentValue(row, field)) { fail("not_applied", "That's already the listed value"); continue; }
    const p: Plan = { fields: [field], hmcField, value };
    plan.push(p);
    order.push(p);
  }
  if (address) {
    const a = address;
    const same = (Object.keys(a.parts) as AddressPart[]).every((k) => a.parts[k] === (asText(row[ADDRESS_PARTS[k]]) ?? ""));
    if (same) a.result = { status: "not_applied", message: "That's already the listed address" };
    else a.value = addressValue(row, a.parts);
  }

  const toSend = plan.filter((p) => !p.result);
  if (toSend.length && !sandbox && !(await underDailyCap(env, toSend.length))) {
    for (const p of toSend) p.result = { status: "try_again", message: "Lookup has reached today's limit. Try again tomorrow." };
  }

  const hash = sandbox ? "" : await ipHash(ip, env.LOOKUP_INTERNAL_KEY ?? "");
  let latest: ExportChurch | undefined;
  for (const p of plan) {
    if (p.result) continue;
    const review = CONTRIBUTABLE_FIELDS[p.hmcField].review;
    // The demo client is checked like any other but never reaches Here's My Church.
    if (sandbox) { p.result = { status: review === "moderated" ? "in_review" : "live" }; continue; }
    try {
      const res = await postHmc(env, "/suggestions", { client, ipHash: hash, churchId: id, field: p.hmcField, value: p.value }, wait);
      const { church, ...status } = await statusFrom(res);
      p.result = status;
      if (church) latest = church;
    } catch {
      p.result = { status: "try_again", message: "Couldn't reach Here's My Church. Try again shortly." };
    }
  }
  // Each answer carries the whole church, so the last one has every change that went live.
  const updated = await writeBack(env, latest, String(row.region));
  const seen = new Set<Plan>();
  const results: FieldResult[] = [];
  for (const p of order) {
    if (seen.has(p)) continue;
    seen.add(p);
    // An address sent from several parts reports once, as "address", unless only one part came in.
    results.push({ field: p.fields.length > 1 ? "address" : p.fields[0]!, ...p.result! });
  }
  return reply({ churchId: id, ...(sandbox ? { sandbox: true } : {}), ...(updated ? { updated: true } : {}), results }, 200, updated ? [id] : []);
}

/** POST /v1/churches/:id/confirm  { client }  "Still correct": bumps the church's last-verified date. */
export async function confirm(env: ContributeEnv, id: string, ip: string, input: unknown, wait = sleep): Promise<Reply> {
  const body = (input ?? {}) as { client?: unknown };
  const denied = await guard(env, ip, body.client);
  if (denied) return denied;
  const client = body.client as string;
  const row = await churchRow(env, id);
  if (!row) return reply({ error: "Church not found" }, 404);
  if (client === SANDBOX_CLIENT) return reply({ churchId: id, sandbox: true, status: "confirmed" });
  try {
    const res = await postHmc(env, "/confirm", { client, ipHash: await ipHash(ip, env.LOOKUP_INTERNAL_KEY ?? ""), churchId: id }, wait);
    if (res.ok) {
      const b = (await res.json().catch(() => ({}))) as { lastVerified?: unknown; church?: unknown };
      const lastVerified = typeof b.lastVerified === "number" ? b.lastVerified : undefined;
      let updated = await writeBack(env, isExport(b.church) ? b.church : undefined, String(row.region));
      if (!updated && lastVerified !== undefined) {
        try { await env.DB.prepare("UPDATE church SET last_verified = ? WHERE id = ?").bind(lastVerified, id).run(); updated = true; } catch { /* next sync */ }
      }
      return reply({ churchId: id, status: "confirmed", ...(lastVerified !== undefined ? { lastVerified } : {}) }, 200, updated ? [id] : []);
    }
    const s = await statusFrom(res);
    return reply({ churchId: id, status: s.status, message: s.message });
  } catch {
    return reply({ churchId: id, status: "try_again", message: "Couldn't reach Here's My Church. Try again shortly." });
  }
}

// ── Adding a church ──

export type AddStatus = "live" | "similar" | "rejected" | "try_again";

/** The fields an add takes, as record field names. Name, city and region (or country) are required. */
const ADD_FIELDS = ["name", "street", "city", "postalCode", "phone", "email", "website", "denomination", "serviceTimes", "languages", "ministries", "pastorName"] as const;
const MAX_SIMILAR = 5;
const fold = (s: string) => tokenize(s).join(" ");

/** A country from its code or name: "US", "us" or "United States". */
export function countryCode(v: unknown): string | null {
  const t = asText(v);
  if (!t) return null;
  if (COUNTRIES[t.toUpperCase()]) return t.toUpperCase();
  const f = fold(t);
  return Object.keys(COUNTRIES).find((cc) => fold(COUNTRIES[cc]!) === f) ?? null;
}

/** A region from its code or name, within a country when one is known: "TX", "tx" or "Texas". */
export function regionCode(v: unknown, country: string | null): string | null {
  const t = asText(v);
  if (!t) return null;
  const ok = (code: string) => !country || REGIONS[code]!.cc === country;
  const up = t.toUpperCase();
  if (REGIONS[up] && ok(up)) return up;
  // Some region codes carry the country in front, as PLWP does.
  if (country && REGIONS[country + up]?.cc === country) return country + up;
  const f = fold(t);
  return Object.keys(REGIONS).find((code) => ok(code) && fold(REGIONS[code]!.n) === f) ?? null;
}

interface SimilarRow { id: string; name: string; street: string | null; city: string | null; near: string | null; region: string; country: string; lat: number; lng: number; denomination: string | null; completeness: number }

/** Shaped like a search result, so the widget can show and pick it the same way. */
function asResult(r: SimilarRow) {
  const c = { ...r, regionName: REGIONS[r.region]?.n ?? r.region, countryName: COUNTRIES[r.country] ?? r.country };
  const loc = locationLabel(c);
  return {
    id: r.id, name: r.name, label: `${r.name}, ${loc}`, locationLabel: loc, street: r.street, city: r.city, nearestPlace: r.city ? null : r.near,
    region: r.region, regionName: c.regionName, country: r.country, countryName: c.countryName, latitude: r.lat, longitude: r.lng,
    denomination: r.denomination, completeness: r.completeness, distanceKm: null, band: 0, source: "lexical" as const,
  };
}

const SIMILAR_COLUMNS = "id, name, street, city, near, region, country, lat, lng, denomination, completeness";

/** Here's My Church's candidates, as Lookup knows them where it can, else as Here's My Church sent them. */
async function similarResults(env: ContributeEnv, list: unknown[], region: string, country: string) {
  const items = list.filter((x): x is Record<string, unknown> => Boolean(x) && typeof (x as { id?: unknown }).id === "string").slice(0, MAX_SIMILAR);
  if (!items.length) return [];
  const ids = items.map((x) => String(x.id));
  const { results } = await env.DB.prepare(`SELECT ${SIMILAR_COLUMNS} FROM church WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<SimilarRow>();
  const known = new Map(results.map((r) => [r.id, r]));
  return items.map((x) => {
    const r = known.get(String(x.id));
    if (r) return asResult(r);
    const s = (k: string) => asText(x[k]);
    return asResult({
      id: String(x.id), name: s("name") ?? "", street: s("address"), city: s("city"), near: null,
      region: regionCode(x.state, country) ?? region, country: countryCode(x.country) ?? country,
      lat: Number(x.lat) || 0, lng: Number(x.lng) || 0, denomination: s("denomination"), completeness: 0,
    });
  });
}

/** The demo's duplicate check, from Lookup's own index: every word of the name, in the same region. */
async function localSimilar(env: ContributeEnv, name: string, region: string) {
  const words = tokenize(name).filter((w) => w.length > 1).slice(0, 8);
  if (!words.length) return [];
  const match = [...words.map((w) => `name:"${w}"`), `geo:"r${region.toLowerCase()}"`].join(" AND ");
  const { results } = await env.DB.prepare(`SELECT ${SIMILAR_COLUMNS} FROM church WHERE rowid IN (SELECT rowid FROM church_fts WHERE church_fts MATCH ? LIMIT ${MAX_SIMILAR})`).bind(match).all<SimilarRow>();
  return results.map(asResult);
}

/**
 * POST /v1/churches  { client, church: { name, street, city, region, postalCode, country, … }, confirmAdd? }
 * Adds a church to Here's My Church. It goes live at once unless it looks like one already listed:
 * then the answer is "similar", with candidates, and sending again with confirmAdd: true adds it anyway.
 */
export async function addChurch(env: ContributeEnv, ip: string, input: unknown, wait = sleep): Promise<Reply> {
  const body = (input ?? {}) as { client?: unknown; church?: unknown; confirmAdd?: unknown };
  if (env.ADD_ENABLED !== "true") return reply({ error: "Adding churches is paused. Nothing was sent.", retryable: true }, 503);
  const denied = await guard(env, ip, body.client);
  if (denied) return denied;
  const client = body.client as string;
  if (!body.church || typeof body.church !== "object" || Array.isArray(body.church)) return reply({ error: "church must be an object with at least name, city and region" }, 400);
  const c = body.church as Record<string, unknown>;
  const rejected = (message: string) => reply({ status: "rejected" satisfies AddStatus, message });

  const name = asText(c.name);
  const city = asText(c.city);
  let country = countryCode(c.country);
  if (asText(c.country) && !country) return rejected("Unknown country");
  const region = regionCode(c.region, country);
  if (!region) return rejected(asText(c.region) ? "Unknown region for that country" : "A region is required");
  country ??= REGIONS[region]!.cc;
  if (!name || name.length < 3) return rejected("A church name is required");
  if (!city) return rejected("A city is required");
  const church: Record<string, unknown> = { country, region };
  for (const k of ADD_FIELDS) {
    const v = asText(c[k]);
    if (v === null) continue;
    if (v.length > MAX_VALUE) return rejected(`${k} is too long (max ${MAX_VALUE} characters)`);
    church[k] = k === "languages" || k === "ministries" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v;
  }
  if (typeof church.email === "string" && !EMAIL_RE.test(church.email)) return rejected("That doesn't look like an email address");
  const lat = Number(c.latitude), lng = Number(c.longitude);
  if (c.latitude != null && c.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) Object.assign(church, { latitude: lat, longitude: lng });
  const confirmAdd = body.confirmAdd === true;

  // The demo client is checked like any other and gets a duplicate check, but nothing is added.
  if (client === SANDBOX_CLIENT) {
    const similar = confirmAdd ? [] : await localSimilar(env, name, region);
    if (similar.length) return reply({ status: "similar" satisfies AddStatus, sandbox: true, similar });
    return reply({ status: "live" satisfies AddStatus, sandbox: true, id: null });
  }
  if (!(await underDailyCap(env, 1))) return reply({ status: "try_again" satisfies AddStatus, message: "Lookup has reached today's limit. Try again tomorrow." });

  const hmcChurch = {
    name, address: church.street ?? "", city, state: region, postcode: church.postalCode ?? "", country,
    phone: church.phone, email: church.email, website: church.website, denomination: church.denomination,
    serviceTimes: church.serviceTimes, languages: church.languages, ministries: church.ministries, pastorName: church.pastorName,
    lat: church.latitude, lng: church.longitude,
  };
  try {
    const res = await postHmc(env, "/churches", { client, ipHash: await ipHash(ip, env.LOOKUP_INTERNAL_KEY ?? ""), church: hmcChurch, ...(confirmAdd ? { confirmAdd: true } : {}) }, wait);
    if (!res.ok) {
      const s = await statusFrom(res);
      return reply({ status: (s.status === "try_again" ? "try_again" : "rejected") satisfies AddStatus, message: s.message });
    }
    const b = (await res.json().catch(() => ({}))) as { needsConfirmation?: boolean; similar?: unknown[]; church?: unknown; id?: unknown };
    if (b.needsConfirmation) return reply({ status: "similar" satisfies AddStatus, similar: await similarResults(env, Array.isArray(b.similar) ? b.similar : [], region, country) });
    const added = isExport(b.church) ? b.church : undefined;
    const id = added?.id ?? (typeof b.id === "string" ? b.id : null);
    const written = await writeBack(env, added, region);
    return reply({ status: "live" satisfies AddStatus, id }, 200, written && id ? [id] : []);
  } catch {
    return reply({ status: "try_again" satisfies AddStatus, message: "Couldn't reach Here's My Church. Try again shortly." });
  }
}
