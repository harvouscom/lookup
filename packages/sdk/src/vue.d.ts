// Vue types for <church-lookup>. Add `import type {} from "@heresmychurch/lookup/vue";` once, and tell
// Vue's compiler it's a custom element: compilerOptions.isCustomElement = (tag) => tag.startsWith("church-").
import type { DefineComponent } from "vue";
import type { ChurchLookupAttributes } from "./jsx.d.ts";

declare module "vue" {
  interface GlobalComponents { "church-lookup": DefineComponent<ChurchLookupAttributes> }
}
