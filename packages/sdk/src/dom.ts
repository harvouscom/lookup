export type FieldTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Set a value the way a person typing would, so frameworks that track input (React) see it. */
export function setNativeValue(el: FieldTarget, value: string): void {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
