// Type-checked by types.test.ts: Vue's GlobalComponents entry carries typed event props.
import type {} from "@heresmychurch/lookup/vue";
import type { GlobalComponents } from "vue";

type Props = InstanceType<GlobalComponents["church-lookup"]>["$props"];
const props: Props = {
  label: "Church",
  onChurchSelect: (e) => e.detail.result.id,
  onChurchFill: (e) => e.detail.record.fields.city,
};
void props;
