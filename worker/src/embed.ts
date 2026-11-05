// Embedding and vector upkeep, shared by the backfill route and the cron sync.
import { embedText, geohash } from "./project.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";

export const EMBED_MODEL = "@cf/baai/bge-m3";
export const EMBED_DIMENSIONS = 1024;
const AI_BATCH = 50;
const UPSERT_BATCH = 500;

export interface EmbedEnv {
  AI: Ai;
  VEC: VectorizeIndex;
}

export interface EmbedRow {
  id: string; name: string; denomination: string | null; city: string | null; near: string | null;
  region: string; country: string; lat: number; lng: number; embed_hash: string;
}

export const textFor = (r: EmbedRow): string =>
  embedText(r, { regionName: REGIONS[r.region]?.n ?? r.region, countryName: COUNTRIES[r.country] ?? r.country });

export async function embedTexts(ai: Ai, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += AI_BATCH) {
    const res = (await ai.run(EMBED_MODEL, { text: texts.slice(i, i + AI_BATCH) })) as { data?: number[][] };
    if (!res.data || res.data.length !== Math.min(AI_BATCH, texts.length - i)) throw new Error("embedding response was incomplete");
    for (const v of res.data) {
      if (v.length !== EMBED_DIMENSIONS) throw new Error(`expected ${EMBED_DIMENSIONS} dimensions, got ${v.length}`);
      out.push(v);
    }
  }
  return out;
}

/** Embed rows and upsert them. Metadata carries the filters plus the hash, so a later sync can tell what's stale. */
export async function upsertRows(env: EmbedEnv, rows: EmbedRow[]): Promise<number> {
  if (!rows.length) return 0;
  const vectors = await embedTexts(env.AI, rows.map(textFor));
  const items: VectorizeVector[] = rows.map((r, i) => ({
    id: r.id,
    values: vectors[i]!,
    metadata: { cc: r.country, region: r.region, g3: geohash(r.lat, r.lng, 3), eh: r.embed_hash },
  }));
  for (let i = 0; i < items.length; i += UPSERT_BATCH) await env.VEC.upsert(items.slice(i, i + UPSERT_BATCH));
  return items.length;
}

export const EMBED_COLUMNS = "id, name, denomination, city, near, region, country, lat, lng, embed_hash";
