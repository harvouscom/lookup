// @heresmychurch/lookup/react: useChurchLookup, the search engine as a hook for your own picker, and
// React 19 types for <church-lookup>: its attributes, onchurch-* event props and object properties.
// For the types alone, add `import type {} from "@heresmychurch/lookup/react";` once.
import type * as React from "react";
import type { ChurchLookup } from "./element.ts";
import type { ChurchLookupAttributes, ChurchLookupEventProps, ChurchLookupProperties } from "./jsx.d.ts";

export { useChurchLookup, type UseChurchLookup, type UseChurchLookupOptions } from "./use-church-lookup.ts";

type Own = Omit<ChurchLookupAttributes, "id" | "class" | "className" | "style" | "children" | "ref"> & ChurchLookupEventProps & ChurchLookupProperties;

/** Props for <church-lookup> in React 19: its own, plus the usual HTML ones (id, className, style, aria-*). */
export type ChurchLookupProps = Own & Omit<React.HTMLAttributes<ChurchLookup>, keyof Own> & { class?: string; ref?: React.Ref<ChurchLookup> };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements { "church-lookup": ChurchLookupProps }
  }
}
