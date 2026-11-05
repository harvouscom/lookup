// Builds FTS5 MATCH expressions. Tokens come from `tokenize`, so they hold only letters and numbers.
import { cellsAround } from "./project.ts";
import { variants } from "./parse.ts";

export const RUNG_LIMIT = 60;

export const RUNG_SQL = `SELECT c.rowid AS rid, c.id, c.name, c.street, c.city, c.near, c.region, c.country, c.lat, c.lng, c.denomination, c.completeness
FROM (SELECT rowid FROM church_fts WHERE church_fts MATCH ?1 ORDER BY rowid LIMIT ${RUNG_LIMIT}) h
JOIN church c ON c.rowid = h.rowid`;

function tokenTerm(token: string, prefix: boolean): string {
  const terms = variants(token).map((v) => `"${v}"${prefix && v === token ? "*" : ""}`);
  return terms.length > 1 ? `{name loc} : (${terms.join(" OR ")})` : `{name loc} : ${terms[0]}`;
}

/** Every token required. The last one is a prefix unless the caller knows it is complete. */
export function allTokens(tokens: string[], lastIsPrefix: boolean): string | null {
  if (!tokens.length) return null;
  return tokens.map((t, i) => tokenTerm(t, lastIsPrefix && i === tokens.length - 1)).join(" AND ");
}

/** Any token matches. Used only for the partial band. */
export function anyToken(tokens: string[], lastIsPrefix: boolean): string | null {
  if (!tokens.length) return null;
  const terms = tokens.flatMap((t, i) => variants(t).map((v) => `"${v}"${lastIsPrefix && i === tokens.length - 1 && v === t ? "*" : ""}`));
  return `{name loc} : (${terms.join(" OR ")})`;
}

export const geoAny = (geoTokens: string[]) => `geo : (${geoTokens.join(" OR ")})`;

export function combine(...parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter(Boolean) as string[];
  if (!kept.length) return null;
  return kept.map((p) => (kept.length > 1 && p.includes(" OR ") && !p.startsWith("{") && !p.startsWith("geo") ? `(${p})` : p)).join(" AND ");
}

export interface Scope {
  center: { lat: number; lng: number } | null;
  /** Soft: a rung of its own, with wider rungs after it. */
  region: string | null;
  country: string | null;
  /** Hard: added to every rung. */
  filter: string | null;
}

/** Nearby cells, wider cells, then region and country. Global when there is nothing to scope by. */
export function rungs(text: string | null, scope: Scope): string[] {
  const out: string[] = [];
  const add = (geo: string | null) => {
    const m = combine(text, geo, scope.filter);
    if (m) out.push(m);
  };
  if (scope.center) {
    add(geoAny(cellsAround(scope.center.lat, scope.center.lng, 4).map((c) => "g4" + c)));
    add(geoAny(cellsAround(scope.center.lat, scope.center.lng, 3).map((c) => "g3" + c)));
  }
  if (scope.region) add(geoAny(["r" + scope.region.toLowerCase()]));
  if (scope.country) add(geoAny(["cc" + scope.country.toLowerCase()]));
  if (!out.length) add(null);
  return out;
}
