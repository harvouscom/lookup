// @heresmychurch/lookup/fields: find the form fields a church fills by their name, id or autocomplete,
// so a form works without data-hmc-field tags. Pass matchField to findTargets.
import type { FieldTarget } from "./dom.ts";

// Words (and word pairs) in a field's name, id or autocomplete, and the record field each means.
const WORDS: Record<string, string> = {
  name: "name", organization: "name", id: "id",
  street: "street", address: "street", "street-address": "street", "address-line1": "street",
  city: "city", town: "city", "address-level2": "city",
  state: "region", province: "region", region: "region", "address-level1": "region",
  zip: "postalCode", postal: "postalCode", postcode: "postalCode", "postal-code": "postalCode",
  country: "country", "country-name": "countryName",
  phone: "phone", tel: "phone", telephone: "phone", email: "email",
  website: "website", url: "website", web: "website", denomination: "denomination", pastor: "pastorName",
};

/**
 * The record field an untagged input is for, or null. Only the church's own fields match, named like
 * church_city, churchWebsite or autocomplete="section-church tel". With `generic`, plain ones match too
 * (city, zip, tel), but never name or id, which on most forms are the person's. Address line 2 and
 * hidden, password, checkbox and similar inputs never match, nor does anything inside the widget.
 */
export function matchField(el: FieldTarget, generic = false): string | null {
  if (/^(hidden|submit|button|reset|checkbox|radio|file|password|image)$/.test(el.type) || el.closest("church-lookup,[data-slot=church-lookup]")) return null;
  const t = [el.name, el.id, el.getAttribute("autocomplete")].join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/)
    .flatMap((w) => (w.startsWith("church") && w.length > 6 ? ["church", w.slice(6)] : [w]));
  const ours = t.includes("church");
  if ((!ours && !generic) || t.some((w) => /^(address|line|street)?[2-9]$/.test(w))) return null;
  const pair = t.slice(1).map((w, i) => WORDS[`${t[i]}-${w}`]).find(Boolean);
  const hits = t.map((w) => WORDS[w]);
  return pair ?? hits.filter((f) => f && f !== "name" && f !== "id").pop() ?? (ours ? hits.find(Boolean) : null) ?? null;
}
