// Shared helpers for the Milestone 1 spike. Pure; no I/O.
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohash(lat, lng, precision) {
  let [latLo, latHi, lngLo, lngHi] = [-90, 90, -180, 180];
  let out = "", bit = 0, ch = 0, even = true;
  while (out.length < precision) {
    if (even) { const m = (lngLo + lngHi) / 2; if (lng >= m) { ch = ch * 2 + 1; lngLo = m; } else { ch *= 2; lngHi = m; } }
    else { const m = (latLo + latHi) / 2; if (lat >= m) { ch = ch * 2 + 1; latLo = m; } else { ch *= 2; latHi = m; } }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

function cellSize(precision) {
  const bits = precision * 5, lngBits = Math.ceil(bits / 2), latBits = Math.floor(bits / 2);
  return { dLat: 180 / 2 ** latBits, dLng: 360 / 2 ** lngBits };
}

/** The cell containing the point plus its eight neighbours. */
export function cells(lat, lng, precision) {
  const { dLat, dLng } = cellSize(precision);
  const out = new Set();
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) out.add(geohash(lat + a * dLat, lng + b * dLng, precision));
  return [...out];
}

const REGION_NAMES = { TX: "Texas", DEBY: "Bayern Bavaria", PLWP: "Wielkopolskie" };

const COMPLETENESS = { street: 20, city: 10, website: 15, phone: 15, serviceTimes: 25, denomination: 5, languages: 5, ministries: 5 };

export function completeness(c) {
  let s = 0;
  if (c.address) s += COMPLETENESS.street;
  if (c.city) s += COMPLETENESS.city;
  if (c.website) s += COMPLETENESS.website;
  if (c.phone) s += COMPLETENESS.phone;
  if (c.serviceTimes) s += COMPLETENESS.serviceTimes;
  if (c.denomination && c.denomination !== "Unknown") s += COMPLETENESS.denomination;
  if (c.languages?.length) s += COMPLETENESS.languages;
  if (c.ministries?.length) s += COMPLETENESS.ministries;
  return s;
}

export const isExcluded = (c) =>
  !c.name || /^(unnamed|unknown)\b/i.test(c.name.trim()) || !Number.isFinite(c.lat) || !Number.isFinite(c.lng) ||
  (c.lat === 0 && c.lng === 0) || c.listingStatus === "pending_reverify";

function km(aLat, aLng, bLat, bLng) {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180), y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111.32;
}

/** Fill `near` on city-less rows using the nearest corpus-derived city centroid within 30 km. */
export function addNearestPlace(rows) {
  const sums = new Map();
  for (const r of rows) if (r.city) {
    const k = `${r.state}|${r.city}`, s = sums.get(k) ?? { name: r.city, lat: 0, lng: 0, n: 0 };
    s.lat += r.lat; s.lng += r.lng; s.n++; sums.set(k, s);
  }
  const buckets = new Map();
  for (const s of sums.values()) {
    s.lat /= s.n; s.lng /= s.n;
    const k = geohash(s.lat, s.lng, 3);
    (buckets.get(k) ?? buckets.set(k, []).get(k)).push(s);
  }
  for (const r of rows) {
    if (r.city) continue;
    let best = null, bestKm = 30;
    for (const k of cells(r.lat, r.lng, 3)) for (const s of buckets.get(k) ?? []) {
      const d = km(r.lat, r.lng, s.lat, s.lng);
      if (d < bestKm) { bestKm = d; best = s.name; }
    }
    if (best) r.near = best;
  }
  return sums.size;
}

export const locText = (r) => [r.city || r.near || "", REGION_NAMES[r.state] ?? ""].filter(Boolean).join(" ");

export const geoText = (r) =>
  `g3${geohash(r.lat, r.lng, 3)} g4${geohash(r.lat, r.lng, 4)} cc${r.country.toLowerCase()} r${r.state.toLowerCase()}`;

/** `{name loc} : "first" AND {name loc} : "bapt"* AND geo : (...)`. Only the last token is a prefix. */
export function buildMatch(text, geoTokens, { allPrefix = false } = {}) {
  const toks = text.toLowerCase().split(/\s+/).filter(Boolean).map((t) => t.replace(/"/g, ""));
  const parts = toks.map((t, i) => `{name loc} : "${t}"${allPrefix || i === toks.length - 1 ? "*" : ""}`);
  parts.push(`geo : (${geoTokens.join(" OR ")})`);
  return parts.join(" AND ");
}

const FOLD = { "ł": "l", "ß": "ss", "ø": "o", "đ": "d", "æ": "ae", "œ": "oe", "ı": "i", "þ": "th", "ð": "d" };
/** Letters unicode61 remove_diacritics does not reduce. Apply to both indexed text and queries. */
export const fold = (s) => s.toLowerCase().replace(/[łßøđæœıþð]/g, (c) => FOLD[c]);

export const RUNG_SQL = `SELECT c.rowid AS rid, c.id, c.name, c.city, c.region, c.country, c.lat, c.lng, c.denomination, c.completeness
FROM (SELECT rowid FROM church_fts WHERE church_fts MATCH ?1 ORDER BY rowid LIMIT 60) h
JOIN church c ON c.rowid = h.rowid`;

/** Three rungs: nearby g4 cells, wider g3 cells, country. */
export function threeRungs(text, loc, opts = {}) {
  const sql = RUNG_SQL.replaceAll("church_fts", opts.table ?? "church_fts");
  if (opts.fold) text = fold(text);
  return [
    { rung: "nearby", sql, params: [buildMatch(text, cells(loc.lat, loc.lng, 4).map((c) => "g4" + c), opts)] },
    { rung: "wider", sql, params: [buildMatch(text, cells(loc.lat, loc.lng, 3).map((c) => "g3" + c), opts)] },
    { rung: "country", sql, params: [buildMatch(text, ["cc" + loc.cc], opts)] },
  ];
}
