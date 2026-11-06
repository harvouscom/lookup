// Pure projection from an HMC export row to what Lookup stores. No I/O, so it is shared by the
// build scripts and the Worker, and tested on its own.

export interface ExportChurch {
  id: string;
  shortId?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country: string;
  lat: number;
  lng: number;
  denomination?: string;
  website?: string;
  serviceTimes?: string;
  languages?: string[];
  ministries?: string[];
  pastorName?: string;
  phone?: string;
  email?: string;
  lastVerified?: number;
  listingStatus?: string;
  relocatedTo?: string;
  relocatedFrom?: string;
}

export interface RegionInfo {
  regionName: string;
  countryName: string;
}

export interface ProjectedChurch {
  id: string;
  shortId: string | null;
  name: string;
  street: string | null;
  city: string | null;
  near: string | null;
  postalCode: string | null;
  region: string;
  country: string;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  denomination: string | null;
  serviceTimes: string | null;
  languages: string[];
  ministries: string[];
  pastorName: string | null;
  lastVerified: number | null;
  completeness: number;
  loc: string;
  geo: string;
  docHash: string;
  embedHash: string;
}

export const COMPLETENESS_WEIGHTS = {
  street: 20,
  city: 10,
  website: 15,
  phone: 15,
  serviceTimes: 25,
  denomination: 5,
  languages: 5,
  ministries: 5,
} as const;

// ── Text ──

/** Letters NFD can't reduce. `remove_diacritics` leaves these alone too, so `kosciol` would miss `kościół`. */
const FOLD: Record<string, string> = { "ł": "l", "ß": "ss", "ø": "o", "đ": "d", "æ": "ae", "œ": "oe", "ı": "i", "þ": "th", "ð": "d", "ħ": "h" };

/** Apply to indexed text and to queries, so both sides always agree. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/['\u2019\u02BC`]s\b/g, "s") // Mary's -> marys, so `mary` still prefix-matches it
    .replace(/[łßøđæœıþðħ]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function tokenize(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// ── Exclusions ──

export type ExclusionReason = "unnamed" | "no-geo" | "pending-reverify" | "relocated";

export function exclusionReason(c: ExportChurch): ExclusionReason | null {
  const name = c.name?.trim();
  if (!name || /^(unnamed|unknown)\b/i.test(name)) return "unnamed";
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || (c.lat === 0 && c.lng === 0)) return "no-geo";
  if (c.listingStatus === "pending_reverify") return "pending-reverify";
  if (c.relocatedTo) return "relocated";
  return null;
}

// ── Field cleanup ──

/** Stored addresses often end in the postcode ("5 Kirchenplatz, 8330"), or are only the postcode. */
export function stripPostcode(address: string | undefined, postcode: string | undefined): string | null {
  const a = address?.trim();
  if (!a) return null;
  const p = postcode?.trim();
  if (!p) return a;
  if (a === p) return null;
  if (a.endsWith(p)) {
    const rest = a.slice(0, -p.length).replace(/[\s,]+$/, "");
    return rest || null;
  }
  return a;
}

const LONG_RANGE_MINUTES = 240;

/**
 * Stored rows don't record whether a value came from OSM `opening_hours`, so detect it by shape:
 * no clock time ("24/7", "closed", "by appointment"), or a range of four hours or more, which is a
 * building's open hours rather than a service. Shorter ranges like "Su 09:30-11:00" are kept.
 */
export function isOfficeHours(value: string): boolean {
  const hasClock = /\d{1,2}[:.]\d{2}|\d\s*(am|pm|uhr)\b/i.test(value);
  if (!hasClock) return true;
  for (const m of value.matchAll(/(\d{1,2})[:.](\d{2})\s*(?:-|–|to)\s*(\d{1,2})[:.](\d{2})/g)) {
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    if (end < start || end - start >= LONG_RANGE_MINUTES) return true;
  }
  return false;
}

export function cleanServiceTimes(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || isOfficeHours(v)) return null;
  return v;
}

const clean = (v: string | undefined | null): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

// ── Geohash ──

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohash(lat: number, lng: number, precision: number): string {
  let latLo = -90, latHi = 90, lngLo = -180, lngHi = 180;
  let out = "", bit = 0, ch = 0, even = true;
  while (out.length < precision) {
    if (even) {
      const m = (lngLo + lngHi) / 2;
      if (lng >= m) { ch = ch * 2 + 1; lngLo = m; } else { ch *= 2; lngHi = m; }
    } else {
      const m = (latLo + latHi) / 2;
      if (lat >= m) { ch = ch * 2 + 1; latLo = m; } else { ch *= 2; latHi = m; }
    }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

/** The cell containing the point plus its eight neighbours. */
export function cellsAround(lat: number, lng: number, precision: number): string[] {
  const bits = precision * 5;
  const dLat = 180 / 2 ** Math.floor(bits / 2);
  const dLng = 360 / 2 ** Math.ceil(bits / 2);
  const out = new Set<string>();
  for (const a of [-1, 0, 1]) {
    for (const b of [-1, 0, 1]) {
      const la = Math.max(-89.999, Math.min(89.999, lat + a * dLat));
      const lo = ((lng + b * dLng + 540) % 360) - 180;
      out.add(geohash(la, lo, precision));
    }
  }
  return [...out];
}

export function geoText(lat: number, lng: number, country: string, region: string): string {
  return `g3${geohash(lat, lng, 3)} g4${geohash(lat, lng, 4)} cc${country.toLowerCase()} r${region.toLowerCase()}`;
}

// ── Location text ──

/** Two-letter codes left out of `loc`: stopwords, and `mt`, which is also "mount". */
const LOC_CODE_SKIP = new Set(["in", "on", "de", "la", "mt"]);
const AU_SHORT: Record<string, string> = { AUNSW: "nsw", AUQLD: "qld", AUVIC: "vic", AUTAS: "tas", AUWA: "wa", AUSA: "sa", AUNT: "nt" };

/** The short code people type for a region ("tx", "nsw"), or null when it would collide with a word. */
export function regionToken(region: string, country: string): string | null {
  if ((country === "US" || country === "CA") && /^[A-Z]{2}$/.test(region)) {
    const t = region.toLowerCase();
    return LOC_CODE_SKIP.has(t) ? null : t;
  }
  return AU_SHORT[region] ?? null;
}

/** Postcode tokens: a US ZIP's first five digits; elsewhere each part of 3+ characters and the parts joined. */
export function postalTokens(postalCode: string | null | undefined, country: string): string[] {
  const p = postalCode?.trim();
  if (!p) return [];
  if (country === "US") { const m = p.match(/^\d{5}/); return m ? [m[0]] : []; }
  const parts = tokenize(p);
  const out = new Set(parts.filter((t) => t.length >= 3));
  if (parts.length > 1 && parts.join("").length >= 3) out.add(parts.join(""));
  return [...out];
}

/** What the `loc` column holds: place, postcode, region name and code, country. */
export function locText(p: { city: string | null; near: string | null; postalCode: string | null; region: string; country: string }, info: RegionInfo): string {
  const place = p.city ?? p.near ?? "";
  return [place, ...postalTokens(p.postalCode, p.country), info.regionName, regionToken(p.region, p.country), info.countryName].filter(Boolean).join(" ");
}

/** One church_fts row. Every writer (build, sync, reindex, tests) goes through this, so they always agree. */
export function ftsRow(p: { name: string; city: string | null; near: string | null; postalCode: string | null; region: string; country: string; lat: number; lng: number }, info: RegionInfo): { name: string; loc: string; geo: string } {
  return { name: tokenize(p.name).join(" "), loc: tokenize(locText(p, info)).join(" "), geo: geoText(p.lat, p.lng, p.country, p.region) };
}

// ── Hashes ──

/** cyrb53-style 64-bit string hash. Only used to detect changed rows, so it needn't be cryptographic. */
export function hash64(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** The text bge-m3 embeds. The spike's A/B kept this form: name, denomination, place. */
export function embedText(p: { name: string; denomination: string | null; city: string | null; near: string | null }, info: RegionInfo): string {
  const denom = p.denomination ? `${p.denomination}. ` : "";
  const place = p.city ? `${p.city}, ` : p.near ? `near ${p.near}, ` : "";
  return `${p.name}. ${denom}${place}${info.regionName}, ${info.countryName}.`;
}

// ── Projection ──

export function completeness(p: {
  street: string | null; city: string | null; website: string | null; phone: string | null;
  serviceTimes: string | null; denomination: string | null; languages: string[]; ministries: string[];
}): number {
  const w = COMPLETENESS_WEIGHTS;
  return (p.street ? w.street : 0) + (p.city ? w.city : 0) + (p.website ? w.website : 0) + (p.phone ? w.phone : 0) +
    (p.serviceTimes ? w.serviceTimes : 0) + (p.denomination ? w.denomination : 0) +
    (p.languages.length ? w.languages : 0) + (p.ministries.length ? w.ministries : 0);
}

const stringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];

/**
 * @param region the region the row was exported under. A few stored rows have no `state`.
 * @param near corpus-derived nearest place for rows without a city. Search only; it never fills `city`.
 */
export function project(c: ExportChurch, region: string, info: RegionInfo, near: string | null = null): ProjectedChurch {
  const denomination = clean(c.denomination);
  const city = clean(c.city);
  const base = {
    id: c.id,
    shortId: clean(c.shortId),
    name: c.name.trim(),
    street: stripPostcode(c.address, c.postcode),
    city,
    near: city ? null : near,
    postalCode: clean(c.postcode),
    region,
    country: c.country,
    lat: c.lat,
    lng: c.lng,
    phone: clean(c.phone),
    email: clean(c.email),
    website: clean(c.website),
    denomination: denomination && denomination.toLowerCase() !== "unknown" ? denomination : null,
    serviceTimes: cleanServiceTimes(c.serviceTimes),
    languages: stringList(c.languages),
    ministries: stringList(c.ministries),
    pastorName: clean(c.pastorName),
    lastVerified: Number.isFinite(c.lastVerified) ? (c.lastVerified as number) : null,
  };
  return {
    ...base,
    completeness: completeness(base),
    loc: locText(base, info),
    geo: geoText(c.lat, c.lng, c.country, region),
    docHash: hash64(JSON.stringify(base)),
    embedHash: hash64(embedText(base, info)),
  };
}
