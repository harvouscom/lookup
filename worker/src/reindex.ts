// Rewrite church_fts from the church table for a rowid range, so a change to what the index holds
// (postcodes and region codes in `loc`) reaches every row without a reload. Sync only rewrites rows
// whose content changed, and `loc` isn't part of that hash.
import { ftsRow } from "./project.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";

/** Rows per INSERT: four columns each, under D1's 100 bound parameters per statement. */
const ROWS_PER_INSERT = 25;

interface Row { rowid: number; name: string; city: string | null; near: string | null; postal_code: string | null; region: string; country: string; lat: number; lng: number }

/** One batch, so one transaction: searches never see the range half written. */
export async function reindexRange(db: D1Database, from: number, to: number): Promise<{ rows: number; maxRowid: number | null }> {
  const { results } = await db.prepare("SELECT rowid, name, city, near, postal_code, region, country, lat, lng FROM church WHERE rowid >= ? AND rowid < ?").bind(from, to).all<Row>();
  const max = await db.prepare("SELECT max(rowid) AS m FROM church").first<{ m: number | null }>();
  // Deleting the whole range also clears index rows whose church is gone.
  const stmts: D1PreparedStatement[] = [db.prepare("DELETE FROM church_fts WHERE rowid >= ? AND rowid < ?").bind(from, to)];
  for (let i = 0; i < results.length; i += ROWS_PER_INSERT) {
    const chunk = results.slice(i, i + ROWS_PER_INSERT);
    const values = chunk.flatMap((r) => {
      const f = ftsRow({ name: r.name, city: r.city, near: r.near, postalCode: r.postal_code, region: r.region, country: r.country, lat: r.lat, lng: r.lng },
        { regionName: REGIONS[r.region]?.n ?? r.region, countryName: COUNTRIES[r.country] ?? r.country });
      return [r.rowid, f.name, f.loc, f.geo];
    });
    stmts.push(db.prepare(`INSERT INTO church_fts (rowid,name,loc,geo) VALUES ${chunk.map(() => "(?,?,?,?)").join(",")}`).bind(...values));
  }
  await db.batch(stmts);
  return { rows: results.length, maxRowid: max?.m ?? null };
}
