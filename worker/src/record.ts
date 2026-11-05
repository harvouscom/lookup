// The autofill record. Every key in `fields` is always present, null or [] when empty, so hosts can
// map fields without checking which ones exist.
import { COMPLETENESS_WEIGHTS } from "./project.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";
import { parseServiceTimes } from "./service-times.ts";

export interface ChurchRow {
  id: string; name: string; street: string | null; city: string | null; near: string | null; postal_code: string | null;
  region: string; country: string; lat: number; lng: number; phone: string | null; email: string | null; website: string | null;
  denomination: string | null; service_times: string | null; languages: string | null; ministries: string | null;
  pastor_name: string | null; last_verified: number | null; completeness: number;
}

const list = (v: string | null): string[] => {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
};

export function toRecord(r: ChurchRow) {
  const serviceTimes = parseServiceTimes(r.service_times);
  const fields = {
    name: r.name,
    street: r.street,
    city: r.city,
    region: r.region,
    regionName: REGIONS[r.region]?.n ?? r.region,
    postalCode: r.postal_code,
    country: r.country,
    countryName: COUNTRIES[r.country] ?? r.country,
    latitude: r.lat,
    longitude: r.lng,
    phone: r.phone,
    email: r.email,
    website: r.website,
    denomination: r.denomination,
    serviceTimes,
    languages: list(r.languages),
    ministries: list(r.ministries),
    pastorName: r.pastor_name,
  };
  const missing = [
    ...(["street", "city", "postalCode", "phone", "email", "website", "denomination", "pastorName"] as const).filter((k) => fields[k] === null),
    ...(fields.serviceTimes.raw === null ? ["serviceTimes"] : []),
    ...(fields.languages.length ? [] : ["languages"]),
    ...(fields.ministries.length ? [] : ["ministries"]),
  ];
  return {
    id: r.id,
    fields,
    missing,
    completeness: r.completeness,
    freshness: { lastVerified: r.last_verified },
    // Values that aren't facts about the listing. A host must never fill `city` from nearestPlace.
    hints: { nearestPlace: r.city ? null : r.near },
  };
}

export const CONTRIBUTABLE_FIELDS = {
  serviceTimes: { countries: "all" },
  denomination: { countries: "all" },
  languages: { countries: "all" },
  ministries: { countries: "all" },
  website: { countries: "all" },
  address: { countries: ["US"] },
  phone: { countries: ["US", "CA"] },
} as const;

export const RECORD_FIELDS = ["name", "street", "city", "region", "regionName", "postalCode", "country", "countryName", "latitude", "longitude", "phone", "email", "website", "denomination", "serviceTimes", "languages", "ministries", "pastorName"];

export { COMPLETENESS_WEIGHTS };
