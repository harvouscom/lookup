import { project, tokenize, type ExportChurch } from "../src/project.ts";
import { deletions1 } from "../src/vocab.ts";
import { REGIONS } from "../src/regions.generated.ts";
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

/** Search cases: abbreviations, lowercase codes, city nicknames, ranking near a place. Only the API tests load them. */
export const searchRows: typeof rows = [
  { name: "First Baptist Church Sanctuary", region: "TX", city: "Austin", lat: 30.29, lng: -97.74 },
  { name: "First Baptist Church", region: "TX", city: "Round Rock", lat: 30.51, lng: -97.68, address: "1 Main", website: "https://fbc.example", serviceTimes: "Sun 10:30 AM" },
  { name: "First United Methodist Church", region: "TX", city: "Austin", lat: 30.27, lng: -97.74 },
  { name: "Grace UMC", region: "TX", city: "Austin", lat: 30.3, lng: -97.75 },
  { name: "First Presbyterian Church", region: "TX", city: "Austin", lat: 30.27, lng: -97.73 },
  { name: "Calvary Chapel", region: "FL", city: "Pinellas Park", lat: 27.84, lng: -82.7, address: "1 Main", website: "https://cc.example" },
  { name: "Calvary Chapel West Boca", region: "FL", city: "Boca Raton", lat: 26.37, lng: -80.2 },
  { name: "First Baptist Church of Dallas", region: "GA", city: "Dallas", lat: 33.92, lng: -84.84 },
  { name: "Bethel AME Church", region: "GA", city: "Atlanta", lat: 33.75, lng: -84.39 },
  { name: "The Church of Jesus Christ of Latter-day Saints", region: "UT", city: "Provo", lat: 40.23, lng: -111.66 },
  { name: "Saddleback Church", region: "CA", city: "Lake Forest", lat: 33.65, lng: -117.69 },
  { name: "Lake Forest Community Church", region: "CA", city: "Lake Forest", lat: 33.64, lng: -117.68 },
  { name: "Mission Lutheran", region: "CA", city: "Lake Forest", lat: 33.66, lng: -117.7 },
  { name: "Holy Trinity Catholic Church", region: "AB", city: "Spruce Grove", lat: 53.54, lng: -113.9, country: "CA", countryName: "Canada" },
  { name: "St. Patrick's Cathedral", region: "NY", city: "New York", lat: 40.76, lng: -73.98 },
  { name: "St Patrick's Cathedral", region: "IED", city: "Dublin", lat: 53.34, lng: -6.27, country: "IE", countryName: "Ireland", address: "1 Main", website: "https://sp.example", serviceTimes: "Sun 10:30 AM" },
  { name: "San Juan Txiki", region: "ESSS", city: "Donostia", lat: 43.31, lng: -1.98, country: "ES", countryName: "Spain" },
  { name: "Grace Church", region: "CO", city: "Denver", lat: 39.74, lng: -104.99 },
].map((r) => ({ country: "US", countryName: "United States", regionName: REGIONS[r.region]?.n ?? r.region, ...r }));

export async function seed(db: D1Database, withSearchCases = false) {
  const all = withSearchCases ? [...rows, ...searchRows] : rows;
  for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run();
  const df = new Map<string, number>();
  const places = new Map<string, { name: string; region: string; country: string; lat: number; lng: number; n: number }>();
  for (const [i, r] of all.entries()) {
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
  await db.prepare("INSERT INTO lookup_meta (key,value) VALUES ('build', ?)").bind(JSON.stringify({ counts: { churches: all.length }, fill: {}, builtAt: "now" })).run();

}
