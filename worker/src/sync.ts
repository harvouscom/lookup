// Cron sync from the moderated HMC export. Each tick takes up to 8 regions, dirty first, then the
// longest unsynced, and applies only what changed: doc_hash decides D1 writes, embed_hash decides
// re-embedding. A region that shrinks by more than half keeps its rows, since that is more likely
// a bad read than real deletions.
import { exclusionReason, project, tokenize, type ExportChurch, type ProjectedChurch } from "./project.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";
import { EMBED_COLUMNS, upsertRows, type EmbedEnv, type EmbedRow } from "./embed.ts";
import { km } from "./rank.ts";

export const REGIONS_PER_TICK = 8;
export const SHRINK_GUARD = 0.5;
const NEAR_KM = 30;
const WRITE_BATCH = 50;
const EMBED_PER_TICK = 2000;

export interface SyncEnv extends EmbedEnv {
  DB: D1Database;
  HMC_API?: Fetcher;
  LOOKUP_INTERNAL_KEY?: string;
}

interface RegionListing { cc: string; abbrev: string; dirtyAt: number | null }
interface SyncState { region: string; synced_at: number | null; dirty_at: number | null }

export interface RegionResult {
  region: string; source: number; kept: number; inserted: number; updated: number; deleted: number;
  embedQueued: number; deletesSkipped: number; error?: string;
}

const API = "https://api.heresmychurch.com/internal/lookup";

async function hmc(env: SyncEnv, path: string): Promise<Response> {
  const init = { headers: { "x-lookup-key": env.LOOKUP_INTERNAL_KEY ?? "" } };
  return env.HMC_API ? env.HMC_API.fetch(`${API}${path}`, init) : fetch(`${API}${path}`, init);
}

/** Dirty regions first (written since we last synced), then never-synced, then oldest. */
export function pickRegions(listing: RegionListing[], state: Map<string, SyncState>, n = REGIONS_PER_TICK): RegionListing[] {
  const known = listing.filter((r) => REGIONS[r.abbrev]);
  const dirty = (r: RegionListing) => {
    const s = state.get(r.abbrev);
    return r.dirtyAt !== null && (!s?.synced_at || r.dirtyAt > (s.dirty_at ?? 0));
  };
  return [...known].sort((a, b) => {
    const d = Number(dirty(b)) - Number(dirty(a));
    if (d) return d;
    return (state.get(a.abbrev)?.synced_at ?? 0) - (state.get(b.abbrev)?.synced_at ?? 0) || (a.abbrev < b.abbrev ? -1 : 1);
  }).slice(0, n);
}

/** Corpus-derived nearest place for rows without a city, matching the index build. */
async function nearestPlaces(db: D1Database, rows: ExportChurch[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const need = rows.filter((r) => !r.city?.trim());
  if (!need.length) return out;
  const pad = 0.35;
  const lats = need.map((r) => r.lat), lngs = need.map((r) => r.lng);
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const lngPad = pad / Math.max(0.2, Math.cos((Math.max(Math.abs(minLat), Math.abs(maxLat)) * Math.PI) / 180));
  const { results } = await db.prepare("SELECT name, lat, lng FROM places WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?")
    .bind(minLat, maxLat, Math.min(...lngs) - lngPad, Math.max(...lngs) + lngPad).all<{ name: string; lat: number; lng: number }>();
  for (const r of need) {
    let best: string | null = null, bestKm = NEAR_KM;
    for (const p of results) {
      const d = km(r.lat, r.lng, p.lat, p.lng);
      if (d < bestKm) { bestKm = d; best = p.name; }
    }
    if (best) out.set(r.id, best);
  }
  return out;
}

const list = (v: string[]) => (v.length ? JSON.stringify(v) : null);

function churchStmt(db: D1Database, rid: number, d: ProjectedChurch): D1PreparedStatement {
  return db.prepare(`INSERT OR REPLACE INTO church (rowid,id,short_id,name,street,city,near,postal_code,region,country,lat,lng,phone,email,website,denomination,service_times,languages,ministries,pastor_name,last_verified,completeness,doc_hash,embed_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    rid, d.id, d.shortId, d.name, d.street, d.city, d.near, d.postalCode, d.region, d.country, d.lat, d.lng, d.phone, d.email,
    d.website, d.denomination, d.serviceTimes, list(d.languages), list(d.ministries), d.pastorName, d.lastVerified, d.completeness, d.docHash, d.embedHash);
}

export async function syncRegion(env: SyncEnv, cc: string, region: string): Promise<RegionResult> {
  const result: RegionResult = { region, source: 0, kept: 0, inserted: 0, updated: 0, deleted: 0, embedQueued: 0, deletesSkipped: 0 };
  const res = await hmc(env, `/region/${cc}/${region}`);
  if (!res.ok) throw new Error(`export ${cc}/${region}: ${res.status}`);
  const body = (await res.json()) as { count: number; churches: ExportChurch[] };
  if (body.count !== body.churches.length) throw new Error(`export ${cc}/${region}: count mismatch`);
  result.source = body.churches.length;

  const info = { regionName: REGIONS[region]?.n ?? region, countryName: COUNTRIES[cc] ?? cc };
  const kept = body.churches.filter((c) => !exclusionReason(c));
  const moved = body.churches.filter((c) => exclusionReason(c) === "relocated");
  const near = await nearestPlaces(env.DB, kept);
  const docs = new Map(kept.map((c) => [c.id, project(c, region, info, near.get(c.id) ?? null)]));
  result.kept = docs.size;

  const { results: current } = await env.DB.prepare("SELECT rowid AS rid, id, doc_hash, embed_hash FROM church WHERE region = ?").bind(region)
    .all<{ rid: number; id: string; doc_hash: string; embed_hash: string }>();
  const byId = new Map(current.map((r) => [r.id, r]));

  const stmts: D1PreparedStatement[] = [];
  const toEmbed: string[] = [];
  let nextRid = ((await env.DB.prepare("SELECT max(rowid) AS m FROM church").first<{ m: number }>())?.m ?? 0) + 1;
  for (const d of docs.values()) {
    const cur = byId.get(d.id);
    if (cur && cur.doc_hash === d.docHash) continue;
    // New rows go to the end. Rowid order is completeness order only as of the last full build.
    const rid = cur?.rid ?? nextRid++;
    stmts.push(churchStmt(env.DB, rid, d));
    stmts.push(env.DB.prepare("DELETE FROM church_fts WHERE rowid = ?").bind(rid));
    stmts.push(env.DB.prepare("INSERT INTO church_fts (rowid,name,loc,geo) VALUES (?,?,?,?)").bind(rid, tokenize(d.name).join(" "), tokenize(d.loc).join(" "), d.geo));
    if (cur) result.updated++; else result.inserted++;
    if (!cur || cur.embed_hash !== d.embedHash) toEmbed.push(d.id);
  }
  const gone = current.filter((r) => !docs.has(r.id));
  const deleteIds: string[] = [];
  if (gone.length && docs.size < current.length * SHRINK_GUARD) {
    result.deletesSkipped = gone.length;
  } else {
    for (const r of gone) {
      stmts.push(env.DB.prepare("DELETE FROM church WHERE rowid = ?").bind(r.rid));
      stmts.push(env.DB.prepare("DELETE FROM church_fts WHERE rowid = ?").bind(r.rid));
      deleteIds.push(r.id);
    }
    result.deleted = gone.length;
  }
  for (const m of moved) stmts.push(env.DB.prepare("INSERT OR REPLACE INTO moved (id, moved_to) VALUES (?, ?)").bind(m.id, m.relocatedTo!));
  // Queued in D1 with the row change, so a failed embed is retried by a later tick.
  for (const id of toEmbed) stmts.push(env.DB.prepare("INSERT OR IGNORE INTO embed_pending (id) VALUES (?)").bind(id));
  for (const id of deleteIds) stmts.push(env.DB.prepare("DELETE FROM embed_pending WHERE id = ?").bind(id));
  for (let i = 0; i < stmts.length; i += WRITE_BATCH) await env.DB.batch(stmts.slice(i, i + WRITE_BATCH));
  result.embedQueued = toEmbed.length;

  if (deleteIds.length) for (let i = 0; i < deleteIds.length; i += 500) await env.VEC.deleteByIds(deleteIds.slice(i, i + 500));
  return result;
}

/** Embed what's queued. Returns how many were embedded. */
export async function drainEmbeds(env: SyncEnv, max = EMBED_PER_TICK): Promise<number> {
  const { results } = await env.DB.prepare(`SELECT ${EMBED_COLUMNS} FROM church WHERE id IN (SELECT id FROM embed_pending LIMIT ?)`).bind(max).all<EmbedRow>();
  const { results: orphaned } = await env.DB.prepare("SELECT id FROM embed_pending WHERE id NOT IN (SELECT id FROM church) LIMIT ?").bind(max).all<{ id: string }>();
  let done = 0;
  for (let i = 0; i < results.length; i += 200) {
    const chunk = results.slice(i, i + 200);
    done += await upsertRows(env, chunk);
    await env.DB.batch(chunk.map((r) => env.DB.prepare("DELETE FROM embed_pending WHERE id = ?").bind(r.id)));
  }
  if (orphaned.length) await env.DB.batch(orphaned.map((r) => env.DB.prepare("DELETE FROM embed_pending WHERE id = ?").bind(r.id)));
  return done;
}

export interface TickResult { regions: RegionResult[]; embedded: number; startedAt: number; ms: number }

export async function tick(env: SyncEnv, only?: string[]): Promise<TickResult> {
  const startedAt = Date.now();
  const res = await hmc(env, "/regions");
  if (!res.ok) throw new Error(`regions: ${res.status}`);
  const { regions: listing } = (await res.json()) as { regions: RegionListing[] };
  const { results: rows } = await env.DB.prepare("SELECT region, synced_at, dirty_at FROM sync_state").all<SyncState>();
  const state = new Map(rows.map((r) => [r.region, r]));
  const chosen = only ? listing.filter((r) => only.includes(r.abbrev)) : pickRegions(listing, state);
  const out: RegionResult[] = [];
  for (const r of chosen) {
    const t0 = Date.now();
    let result: RegionResult;
    try {
      result = await syncRegion(env, r.cc, r.abbrev);
    } catch (e) {
      result = { region: r.abbrev, source: 0, kept: 0, inserted: 0, updated: 0, deleted: 0, embedQueued: 0, deletesSkipped: 0, error: String((e as Error).message ?? e).slice(0, 200) };
    }
    // A failed region still gets a timestamp so it can't block the rest, but keeps its old dirty marker.
    await env.DB.prepare(`INSERT INTO sync_state (region, cc, synced_at, dirty_at, last_ms, last_result) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(region) DO UPDATE SET synced_at = excluded.synced_at, dirty_at = CASE WHEN ? IS NULL THEN excluded.dirty_at ELSE sync_state.dirty_at END, last_ms = excluded.last_ms, last_result = excluded.last_result`)
      .bind(r.abbrev, r.cc, t0, r.dirtyAt, Date.now() - t0, JSON.stringify(result), result.error ?? null).run();
    out.push(result);
  }
  let embedded = 0;
  try { embedded = await drainEmbeds(env); } catch { /* retried next tick */ }
  return { regions: out, embedded, startedAt, ms: Date.now() - startedAt };
}
