// Type-checked by types.test.ts the way an app would see the package: through its exports, with no
// allowImportingTsExtensions and full library checking.
import { createLookup, LookupError, type SearchResponse } from "@heresmychurch/lookup";
import { createLookupController, findTargets, type ControllerState } from "@heresmychurch/lookup/core";
import { matchField } from "@heresmychurch/lookup/fields";
import "@heresmychurch/lookup/element";
import "@heresmychurch/lookup/service-times";
import "@heresmychurch/lookup/strings/es";

const lookup = createLookup({ client: "types-test" });
const res: Promise<SearchResponse> = lookup.search("grace", { limit: 20 });
const ctl = createLookupController({ lookup, onChange: (s: ControllerState) => void s.results });
ctl.input("grace");
findTargets(document, (el) => matchField(el, true));
void ctl.more().then((added) => added.length);

const el = document.createElement("church-lookup");
el.fieldMap = { city: "#city" };
el.addEventListener("church-select", (e) => e.detail.result.id);
el.addEventListener("church-fill", (e) => e.detail.record.fields.name);
const err = new LookupError(429, "slow down", 60);
void [res, err.retryAfter, el.value];
