import { project, tokenize, type ExportChurch } from "../src/project.ts";
import { deletions1 } from "../src/vocab.ts";
import schema from "../schema.sql?raw";

const DALLAS = { lat: 32.78, lng: -96.8 };
export const rows: (Partial<ExportChurch> & { name: string; region: string; regionName: string; countryName: string; near?: string })[] = [
  { name: "Grace Community Church", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS, website: "https://grace.example", address: "1 Main, 75201", postcode: "75201", serviceTimes: "Sun 10:30 AM" },
  { name: "Grace Bible Chapel", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Plano", lat: 33.02, lng: -96.7 },
  { name: "First Baptist Church", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS },
  { name: "First Baptist Church", region: "IN", regionName: "Indiana", countryName: "United States", country: "US", city: "Fort Wayne", lat: 41.08, lng: -85.14 },
  { name: "Saint Mary's Catholic Church", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS },
  { name: "Kościół pw. Świętego Jana", region: "PLWP", regionName: "Wielkopolskie", countryName: "Poland", country: "PL", city: "Wrocław", lat: 51.1, lng: 17.03 },
  { name: "Evangelische Kirche München", region: "DEBY", regionName: "Bayern", countryName: "Germany", country: "DE", city: "München", lat: 48.13, lng: 11.58 },
  { name: "Church at the Cross", region: "TX", regionName: "Texas", countryName: "United States", country: "US", city: "Dallas", ...DALLAS },
];

export async function seed(db: D1Database) {
  for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run();
  const df = new Map<string, number>();
  const places = new Map<string, { name: string; region: string; country: string; lat: number; lng: number; n: number }>();
  for (const [i, r] of rows.entries()) {
    const p = project({ id: `R-${i}`, country: r.country!, lat: r.lat!, lng: r.lng!, ...r } as ExportChurch, r.region, r);
    await db.prepare("INSERT INTO church (rowid,id,name,street,city,postal_code,region,country,lat,lng,website,service_times,completeness,doc_hash,embed_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(i + 1, p.id, p.name, p.street, p.city, p.postalCode, p.region, p.country, p.lat, p.lng, p.website, p.serviceTimes, p.completeness, p.docHash, p.embedHash).run();
    await db.prepare("INSERT INTO church_fts (rowid,name,loc,geo) VALUES (?,?,?,?)").bind(i + 1, tokenize(p.name).join(" "), tokenize(p.loc).join(" "), p.geo).run();
    for (const t of new Set(tokenize(p.name))) df.set(t, (df.get(t) ?? 0) + 1);
    const key = tokenize(p.city!).join(" ");
    places.set(`${key}|${p.region}`, { name: p.city!, region: p.region, country: p.country, lat: p.lat, lng: p.lng, n: (places.get(`${key}|${p.region}`)?.n ?? 0) + 1 });
  }
  for (const [id, pl] of places) {
    await db.prepare("INSERT INTO places (key,name,region,country,lat,lng,n) VALUES (?,?,?,?,?,?,?)").bind(id.split("|")[0], pl.name, pl.region, pl.country, pl.lat, pl.lng, pl.n).run();
  }
  let id = 1;
  for (const [t, c] of df) {
    await db.prepare("INSERT INTO vocab (id,token,df) VALUES (?,?,?)").bind(id, t, c).run();
    for (const d of new Set([t, ...deletions1(t)])) await db.prepare("INSERT OR IGNORE INTO vocab_del (del,id) VALUES (?,?)").bind(d, id).run();
    id++;
  }
  await db.prepare("INSERT INTO moved (id,moved_to) VALUES ('OLD-1','R-0')").run();
  await db.prepare("INSERT INTO lookup_meta (key,value) VALUES ('build', ?)").bind(JSON.stringify({ counts: { churches: rows.length }, fill: {}, builtAt: "now" })).run();

}
