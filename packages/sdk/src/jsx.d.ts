// Types for <church-lookup> in any setup: the DOM tag and its events, and JSX for React <= 18,
// Preact and Solid through the global JSX namespace. React 19 and Vue: also import the matching
// "@heresmychurch/lookup/react" or "@heresmychurch/lookup/vue" types.
import type { ChurchRecord, SearchResult } from "./client.ts";
import type { ChurchLookup, FillChange } from "./element.ts";

export interface ChurchLookupEventMap {
  "church-results": CustomEvent<{ query: string; results: SearchResult[]; settled: boolean }>;
  "church-select": CustomEvent<{ result: SearchResult }>;
  "church-fill": CustomEvent<{ record: ChurchRecord; changes: FillChange[] }>;
  "church-clear": CustomEvent<Record<string, never>>;
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
  region?: string;
  country?: string;
  near?: string;
  geo?: "off";
  limit?: number | string;
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
