// Type-checked by types.test.ts: React 19 props on <church-lookup> and the useChurchLookup hook.
import { useChurchLookup, type ChurchLookupProps } from "@heresmychurch/lookup/react";
import type { ChurchLookup } from "@heresmychurch/lookup/element";
import { createRef } from "react";

export function Picker() {
  const ref = createRef<ChurchLookup>();
  const { results, search } = useChurchLookup({ client: "types-test", limit: 5 });
  void search;
  return (
    <form>
      <church-lookup
        ref={ref}
        name="church_id"
        label="Church"
        client="types-test"
        max-results={20}
        className="picker"
        aria-describedby="hint"
        data-testid="church"
        fieldMap={{ city: "#city" }}
        onchurch-select={(e) => e.detail.result.id.toUpperCase()}
        onchurch-fill={(e) => e.detail.record.fields.city?.toUpperCase()}
        onchurch-error={(e) => e.detail.status}
      />
      {results.map((r) => <p key={r.id}>{r.name}</p>)}
      {/* @ts-expect-error a typo'd camelCase prop is an error, not silently passed through */}
      <church-lookup maxResults={20} />
    </form>
  );
}
const props: ChurchLookupProps = { label: "Church" };
void props;
