// The autofill record. Every key in `fields` is always present, null or [] when empty, so hosts can
// map fields without checking which ones exist.
import { COMPLETENESS_WEIGHTS } from "./project.ts";
import { COUNTRIES, REGIONS } from "./regions.generated.ts";
import { parseServiceTimes } from "./service-times.ts";

export interface ChurchRow {
  id: string; short_id?: string | null; name: string; street: string | null; city: string | null; near: string | null; postal_code: string | null;
  region: string; country: string; lat: number; lng: number; phone: string | null; email: string | null; website: string | null;
  denomination: string | null; service_times: string | null; languages: string | null; ministries: string | null;
  pastor_name: string | null; last_verified: number | null; completeness: number;
  /** 1 when the church has verified its listed inbox on Here's My Church. Absent before the m4 migration. */
  claimed?: number | null;
}

const list = (v: string | null): string[] => {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
};

export const HMC_SITE = "https://heresmychurch.com";

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
    // The church has claimed its listing (verified its listed inbox). Others' changes go to the church first.
    claimed: r.claimed === 1,
    // The church's page, where people can fix anything Lookup doesn't take. Add ?suggest=1 to open the form.
    links: { heresMyChurch: r.short_id ? `${HMC_SITE}/${r.country}/${r.region}/${encodeURIComponent(r.short_id)}` : null },
    // Values that aren't facts about the listing. A host must never fill `city` from nearestPlace.
    hints: { nearestPlace: r.city ? null : r.near },
  };
}

/**
 * What a person can update through Lookup, and how Here's My Church checks it. `address` is street,
 * city and postal code sent together; `name` needs NAME_CONTRIBUTIONS before contributions accept it.
 *
 * On a claimed listing (`claimed: true` on the record), everyone else's changes go to the church
 * first, and the answer says reviewBy: "church". Otherwise:
 * - A blank field goes live on one vote, with an automatic spam check afterwards. Email and pastor
 *   name sent from Lookup are the exception: they're always held, since a host form can hold
 *   someone's personal details.
 * - Replacing a filled value is held and checked automatically. Phone and service times are approved
 *   when they appear on the church's website, when two or more independent people send the same
 *   value, or after three quiet days. Denomination, languages and ministries (additions only) follow
 *   agreement, the name rules or three quiet days.
 * - Name, website, address, email and pastor name need evidence (the church's website, a small name
 *   fix, an address within 150 m of the pin) or else a Here's My Church reviewer.
 * - Closed and duplicate reports can hide a listing, reversibly, and only on strong evidence. Moves
 *   always go to a reviewer.
 *
 * `checks` says that: "automatic" fields are decided by the checks above; "automatic-then-reviewer"
 * fields go to a person whenever the checks can't decide; "reviewer" (moves) always goes to one. `review` is kept as it was for hosts that
 * read it: "live" for fields that can change without a person, "moderated" for the others. It no
 * longer means a moderator sees every change.
 */
export const CONTRIBUTABLE_FIELDS = {
  name: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  serviceTimes: { countries: "all", review: "live", checks: "automatic" },
  denomination: { countries: "all", review: "live", checks: "automatic" },
  languages: { countries: "all", review: "live", checks: "automatic" },
  ministries: { countries: "all", review: "live", checks: "automatic" },
  phone: { countries: "all", review: "live", checks: "automatic" },
  website: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  address: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  email: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  pastorName: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  reportClosed: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  reportDuplicate: { countries: "all", review: "moderated", checks: "automatic-then-reviewer" },
  reportRelocated: { countries: "all", review: "moderated", checks: "reviewer" },
} as const;

export const RECORD_FIELDS = ["name", "street", "city", "region", "regionName", "postalCode", "country", "countryName", "latitude", "longitude", "phone", "email", "website", "denomination", "serviceTimes", "languages", "ministries", "pastorName"];

export { COMPLETENESS_WEIGHTS };
