// React 19 types for <church-lookup>. Add `import type {} from "@heresmychurch/lookup/react";` once.
import type { ChurchLookupAttributes } from "./jsx.d.ts";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements { "church-lookup": ChurchLookupAttributes & Record<string, unknown> }
  }
}
