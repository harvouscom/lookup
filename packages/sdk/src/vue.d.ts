// Vue types for <church-lookup>. Add `import type {} from "@heresmychurch/lookup/vue";` once, and tell
// Vue's compiler it's a custom element: compilerOptions.isCustomElement = (tag) => tag.startsWith("church-").
// Events type-check in templates too: @church-select="(e) => e.detail.result".
import type { DefineComponent } from "vue";
import type { ChurchLookupAttributes, ChurchLookupEventMap } from "./jsx.d.ts";

type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
type ChurchLookupVueEvents = { [K in keyof ChurchLookupEventMap as `on${Capitalize<Camel<K>>}`]?: (event: ChurchLookupEventMap[K]) => void };

declare module "vue" {
  interface GlobalComponents { "church-lookup": DefineComponent<ChurchLookupAttributes & ChurchLookupVueEvents> }
}
