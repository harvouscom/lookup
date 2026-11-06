// Types for <church-lookup> in any setup: the DOM tag and its events, and JSX for React <= 18,
// Preact and Solid through the global JSX namespace. React 19 and Vue: also import the matching
// "@heresmychurch/lookup/react" or "@heresmychurch/lookup/vue" types.
import type { ChurchRecord, SearchResult } from "./client.ts";
import type { ChurchErrorDetail, ChurchLookup, FillChange } from "./element.ts";

export interface ChurchLookupEventMap {
  /** `more` is true when the results came from "Show more". */
  "church-results": CustomEvent<{ query: string; results: SearchResult[]; settled: boolean; more: boolean }>;
  "church-select": CustomEvent<{ result: SearchResult }>;
  "church-fill": CustomEvent<{ record: ChurchRecord; changes: FillChange[] }>;
  "church-clear": CustomEvent<null>;
  "church-error": CustomEvent<ChurchErrorDetail>;
  "church-contribute": CustomEvent<{ churchId: string; changes: { field: string; value: string }[] }>;
  "church-confirm": CustomEvent<{ churchId: string }>;
}

/** Attributes you can set on <church-lookup>. */
export interface ChurchLookupAttributes {
  label?: string;
  placeholder?: string;
  /** Submit the chosen church's ID under this name. */
  name?: string;
  /** A church ID to show, such as one saved earlier. */
  value?: string;
  required?: boolean;
  /** The id of the form to fill. Defaults to the enclosing form. */
  form?: string;
  overwrite?: boolean;
  "fill-on-load"?: boolean;
  disabled?: boolean;
  /** Which fields fill: tagged and church-named (default), "auto" adds plain names like city, "tagged", or "off". */
  fill?: "auto" | "tagged" | "off";
  region?: string;
  country?: string;
  near?: string;
  lat?: number | string;
  lng?: number | string;
  geo?: "off";
  /** Results per page. Defaults to 8. */
  limit?: number | string;
  /** The most results "Show more" reaches. Defaults to 50. */
  "max-results"?: number | string;
  "min-chars"?: number | string;
  debounce?: number | string;
  semantic?: "off";
  density?: "compact" | "comfortable";
  "show-distance"?: "off";
  icons?: "none";
  lang?: string;
  client?: string;
  "base-url"?: string;
  contribute?: "off";
  id?: string;
  class?: string;
  className?: string;
  style?: unknown;
  children?: unknown;
  ref?: unknown;
}

declare global {
  interface HTMLElementTagNameMap { "church-lookup": ChurchLookup }
  interface HTMLElementEventMap extends ChurchLookupEventMap {}
  namespace JSX {
    interface IntrinsicElements { "church-lookup": ChurchLookupAttributes & Record<string, unknown> }
  }
}
