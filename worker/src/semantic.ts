// The AI path: embed a settled query, ask Vectorize, then join back to D1 so a stale vector can
// never surface a row that has since been excluded or changed region.
import { cellsAround } from "./project.ts";
import { embedTexts, type EmbedEnv } from "./embed.ts";

export const SEMANTIC_TOP_K = 30;
export const SEMANTIC_TIMEOUT_MS = 800;
/** Cosine scores below this are noise for bge-m3 on short names. */
export const MIN_SCORE = 0.45;

export interface SemanticScope {
  country: string | null;
  region: string | null;
  near: { lat: number; lng: number } | null;
}

export function vectorFilter(scope: SemanticScope): VectorizeVectorMetadataFilter | undefined {
  const f: VectorizeVectorMetadataFilter = {};
  if (scope.country) f.cc = scope.country;
  if (scope.region) f.region = scope.region;
  if (scope.near) f.g3 = { $in: cellsAround(scope.near.lat, scope.near.lng, 3) };
  return Object.keys(f).length ? f : undefined;
}

export async function semanticIds(env: EmbedEnv, text: string, scope: SemanticScope): Promise<{ id: string; score: number }[]> {
  const [vector] = await embedTexts(env.AI, [text]);
  const res = await env.VEC.query(vector!, { topK: SEMANTIC_TOP_K, filter: vectorFilter(scope), returnValues: false, returnMetadata: "none" });
  return res.matches.filter((m) => m.score >= MIN_SCORE).map((m) => ({ id: m.id, score: m.score }));
}

export class Timeout extends Error {}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Timeout(`timed out after ${ms} ms`)), ms); })])
    .finally(() => clearTimeout(timer));
}
