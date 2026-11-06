// Contributions and confirmations: people's corrections flow back to Here's My Church through its
// internal Lookup routes. Every field gets its own status so the widget can say exactly what happened:
//   live         applied now (fields that go live on one vote)
//   in_review    waits for a Here's My Church moderator
//   not_applied  accepted, but the stored value didn't change (consensus kept the old one)
//   rejected     Here's My Church refused it (a 4xx), with its reason
//   try_again    a temporary problem (maintenance, rate limit, outage): nothing was lost or refused
//   coming_soon  a field Lookup will accept once Here's My Church does (name, until it deploys)
import { CONTRIBUTABLE_FIELDS } from "./record.ts";

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
  name: "name", street: "address", address: "address", phone: "phone", website: "website",
  denomination: "denomination", serviceTimes: "serviceTimes", languages: "languages", ministries: "ministries",
};

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
export async function statusFrom(res: Response): Promise<{ status: FieldStatus; message?: string }> {
  if (res.ok) {
    const b = (await res.json()) as { applied?: boolean; needsModeration?: boolean };
    return { status: b.needsModeration ? "in_review" : b.applied ? "live" : "not_applied" };
  }
  if (res.status === 503 || res.status === 429 || res.status >= 500) {
    return { status: "try_again", message: res.status === 429 ? "Too many changes right now. Try again later." : "Here's My Church is busy for a moment. Try again shortly." };
  }
  return { status: "rejected", message: await errorText(res) };
}

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
  const col: Record<string, string> = { name: "name", street: "street", address: "street", phone: "phone", website: "website", denomination: "denomination", serviceTimes: "service_times", languages: "languages", ministries: "ministries" };
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

const reply = (body: unknown, status = 200) => ({ body, status });
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

  // Validate everything first, so a bad field can't leave half a batch sent.
  const plan: { field: string; hmcField: Contributable; value: string; result?: FieldResult }[] = [];
  for (const c of body.changes as { field?: unknown; value?: unknown }[]) {
    const field = String(c?.field ?? "");
    const hmcField = TO_HMC[field];
    const value = asText(c?.value);
    if (!hmcField) { plan.push({ field, hmcField: "name", value: "", result: { field, status: "rejected", message: "This field can't be contributed through Lookup" } }); continue; }
    const rule = CONTRIBUTABLE_FIELDS[hmcField];
    if (hmcField === "name" && !nameOpen(env)) { plan.push({ field, hmcField, value: "", result: { field, status: "coming_soon", message: "Name corrections are coming soon. Nothing was sent for this field." } }); continue; }
    if (rule.countries !== "all" && !(rule.countries as readonly string[]).includes(country)) {
      plan.push({ field, hmcField, value: "", result: { field, status: "rejected", message: `${field} corrections aren't accepted for this country yet` } }); continue;
    }
    if (!value) { plan.push({ field, hmcField, value: "", result: { field, status: "rejected", message: "A value is required" } }); continue; }
    if (value.length > MAX_VALUE) { plan.push({ field, hmcField, value: "", result: { field, status: "rejected", message: `Value is too long (max ${MAX_VALUE} characters)` } }); continue; }
    if (value === currentValue(row, field)) { plan.push({ field, hmcField, value, result: { field, status: "not_applied", message: "That's already the listed value" } }); continue; }
    plan.push({ field, hmcField, value });
  }

  const toSend = plan.filter((p) => !p.result);
  if (toSend.length && !sandbox && !(await underDailyCap(env, toSend.length))) {
    for (const p of toSend) p.result = { field: p.field, status: "try_again", message: "Lookup has reached today's limit. Try again tomorrow." };
  }

  const hash = sandbox ? "" : await ipHash(ip, env.LOOKUP_INTERNAL_KEY ?? "");
  for (const p of plan) {
    if (p.result) continue;
    const review = CONTRIBUTABLE_FIELDS[p.hmcField].review;
    // The demo client is checked like any other but never reaches Here's My Church.
    if (sandbox) { p.result = { field: p.field, status: review === "moderated" ? "in_review" : "live" }; continue; }
    try {
      const res = await postHmc(env, "/suggestions", { client, ipHash: hash, churchId: id, field: p.hmcField, value: p.value }, wait);
      p.result = { field: p.field, ...(await statusFrom(res)) };
    } catch {
      p.result = { field: p.field, status: "try_again", message: "Couldn't reach Here's My Church. Try again shortly." };
    }
  }
  return reply({ churchId: id, ...(sandbox ? { sandbox: true } : {}), results: plan.map((p) => p.result!) });
}

/** POST /v1/churches/:id/confirm  { client }  "Still correct": bumps the church's last-verified date. */
export async function confirm(env: ContributeEnv, id: string, ip: string, input: unknown, wait = sleep): Promise<Reply> {
  const body = (input ?? {}) as { client?: unknown };
  const denied = await guard(env, ip, body.client);
  if (denied) return denied;
  const client = body.client as string;
  if (!(await churchRow(env, id))) return reply({ error: "Church not found" }, 404);
  if (client === SANDBOX_CLIENT) return reply({ churchId: id, sandbox: true, status: "confirmed" });
  try {
    const res = await postHmc(env, "/confirm", { client, ipHash: await ipHash(ip, env.LOOKUP_INTERNAL_KEY ?? ""), churchId: id }, wait);
    if (res.ok) {
      const b = (await res.json()) as Record<string, unknown>;
      return reply({ churchId: id, status: "confirmed", ...(typeof b.lastVerified === "number" ? { lastVerified: b.lastVerified } : {}) });
    }
    const s = await statusFrom(res);
    return reply({ churchId: id, status: s.status, message: s.message });
  } catch {
    return reply({ churchId: id, status: "try_again", message: "Couldn't reach Here's My Church. Try again shortly." });
  }
}
