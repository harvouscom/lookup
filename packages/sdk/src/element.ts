// <church-lookup>: an ARIA 1.2 combobox that searches Here's My Church and autofills a form. It's a
// form-associated element: with a `name`, the chosen church's ID submits like any input.
/// <reference path="./jsx.d.ts" preserve="true" />
import { createLookup, type AddResult, type ChurchRecord, type FieldStatus, type Lookup, type LookupError, type Meta, type NewChurch, type SearchResult } from "./client.ts";
import { addUrl, applyFill, changeFor, consentDiff, contributable, createLookupController, fieldValue, findTargets, isStale, mergeAddress, newChurchFrom, planFill, suggestUrl, type ControllerState, type FillChange } from "./core.ts";
import { setNativeValue, type FieldTarget } from "./dom.ts";
import { matchField } from "./fields.ts";
import { LANGS, registry, stringsFor, type Strings } from "./strings.ts";

export type { Strings, FillChange };

export { setNativeValue, fieldValue };

const ADD_URL = "https://heresmychurch.com";

// Each token falls back to the shadcn/ui names that Sensible UI (sensibleui.com, by Cam Pak) uses, so a
// page styled with either themes the widget with no setup. Custom properties cross the shadow boundary.
const CSS = `
:host{display:block;position:relative;font:inherit;color:var(--hmc-text,var(--foreground,#18181b));
--_bg:var(--hmc-bg,var(--background,#fff));--_pop:var(--hmc-popover,var(--popover,var(--_bg)));--_pop-fg:var(--hmc-popover-text,var(--popover-foreground,inherit));
--_line:var(--hmc-border,var(--border,#d4d4d8));--_input:var(--hmc-input-border,var(--input,#a1a1aa));--_ring:var(--hmc-accent,var(--ring,#6d28d9));
--_active:var(--hmc-active-bg,var(--accent,#f3effe));--_active-fg:var(--hmc-active-text,var(--accent-foreground,inherit));
--_muted:var(--hmc-muted,var(--muted-foreground,#52525b));--_r:var(--hmc-radius,var(--radius,10px));
--_ic:28px;--_g:16px;--_row:44px;--_pad:4px 8px;--_gap:10px;--_n:.9375rem;--_s:.8125rem;--_wrap:nowrap}
:host([density=comfortable]){--_ic:40px;--_g:20px;--_row:56px;--_pad:8px 10px;--_gap:12px;--_n:1rem;--_s:.875rem;--_wrap:normal}
label{display:block;margin-bottom:8px;font-weight:600;font-size:.9375rem}
.field{position:relative}
.field svg{position:absolute;z-index:1;left:14px;top:50%;width:20px;height:20px;margin-top:-10px;color:var(--_muted);pointer-events:none}
input{box-sizing:border-box;width:100%;min-height:52px;padding:12px 16px 12px 44px;font:inherit;font-size:1.0625rem;color:inherit;background:var(--_bg);border:1px solid var(--_input);border-radius:var(--_r);outline:none;transition:border-color .15s,box-shadow .15s}
input::placeholder{color:var(--_muted);opacity:.85}:host([data-chosen]) input{padding-right:48px}
.x{position:absolute;z-index:1;right:10px;top:50%;width:32px;height:32px;margin-top:-16px;display:grid;place-items:center;padding:0;border:0;border-radius:calc(var(--_r) - 2px);background:none;color:var(--_muted);cursor:pointer}.x:hover{background:var(--_active);color:inherit}.x:focus-visible{outline:2px solid var(--_ring);outline-offset:1px}.x[hidden]{display:none}.x svg{width:16px;height:16px}
input:focus-visible{border-color:var(--_ring);box-shadow:0 0 0 4px color-mix(in oklab,var(--_ring) 22%,transparent)}
.pop{position:absolute;z-index:var(--hmc-z,1000);left:0;right:0;margin-top:8px;padding:6px;background:var(--_pop);color:var(--_pop-fg);border:1px solid var(--_line);border-radius:calc(var(--_r) + 4px);box-shadow:0 20px 40px -12px rgb(24 24 27/.25),0 4px 10px -4px rgb(24 24 27/.1)}
.pop[hidden]{display:none}
ul{list-style:none;margin:0;padding:0;max-height:min(60vh,416px);overflow:auto;display:grid;gap:1px}
li{display:grid;grid-template-columns:var(--_ic) 1fr auto;align-items:center;gap:var(--_gap);min-height:var(--_row);padding:var(--_pad);border-radius:var(--_r);cursor:pointer;box-sizing:border-box}
li:hover,li[aria-selected=true]{background:var(--_active);color:var(--_active-fg)}
.ic{display:grid;place-items:center;width:var(--_ic);height:var(--_ic);border-radius:calc(var(--_r) - 3px);background:color-mix(in oklab,var(--_ring) 12%,transparent);color:var(--_ring)}
.ic svg{width:var(--_g);height:var(--_g)}.ic ::slotted(*){display:grid;place-items:center;width:var(--_g);height:var(--_g);font-size:var(--_g);line-height:1}.field ::slotted([slot=search-icon]){position:absolute;z-index:1;left:14px;top:50%;display:grid;place-items:center;width:20px;height:20px;margin-top:-10px;font-size:20px;line-height:1;color:var(--_muted);pointer-events:none}
.t{display:grid;min-width:0}
.n,.sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.n{font-weight:600;font-size:var(--_n);line-height:1.3;white-space:var(--_wrap)}
.sub{color:var(--_muted);font-size:var(--_s);line-height:1.35}
.d{font-size:.75rem;color:var(--_muted);white-space:nowrap;font-variant-numeric:tabular-nums}
:host([icons=none]) .ic,:host([show-distance=off]) .d{display:none}:host([icons=none]) .pop li{grid-template-columns:1fr auto}
.pop li.more{display:flex;justify-content:center;font-size:.875rem;font-weight:600;color:var(--_ring)}.pop li.more[aria-disabled=true]{cursor:progress;color:var(--_muted)}
.fix{margin:0;padding:4px 10px 6px;font-size:.8125rem;color:var(--_muted)}.fix[hidden]{display:none}
.note{padding:14px 12px;font-size:.9375rem;color:var(--_muted)}.rt{display:block;margin-top:8px;min-height:36px;padding:0 12px;border:1px solid var(--_input);border-radius:calc(var(--_r) - 2px);background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer}.rt:focus-visible{outline:2px solid var(--_ring);outline-offset:1px}
:host([data-loading]:not([data-chosen])) .field::after{content:"";position:absolute;right:16px;top:50%;width:14px;height:14px;margin-top:-9px;border:2px solid var(--_line);border-top-color:var(--_ring);border-radius:50%;opacity:0;animation:hmc-in 0s .3s forwards,hmc-spin .7s linear infinite}
@keyframes hmc-in{to{opacity:1}}@keyframes hmc-spin{to{transform:rotate(1turn)}}
.foot{display:flex;align-items:center;gap:8px;margin-top:6px;padding:10px 10px 4px;border-top:1px solid var(--_line);font-size:.75rem;color:var(--_muted)}.foot svg{flex:none;width:20px;height:20px}.foot span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.foot i{font-style:normal}.foot b a{color:inherit;font-weight:600;text-decoration:none}.foot b a:hover{text-decoration:underline}.foot .osm{margin-left:auto;font-size:.6875rem;font-weight:400;color:var(--_muted);text-decoration:none;white-space:nowrap}.foot .osm:hover{text-decoration:underline}
a{color:var(--_ring);font-weight:500;text-underline-offset:3px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:480px){.foot i{display:none}:host([density=comfortable]){--_ic:32px;--_g:16px;--_row:48px;--_pad:6px 8px;--_gap:10px;--_n:.9375rem;--_s:.8125rem;--_wrap:nowrap}input{min-height:48px;font-size:1rem}}
.cs{margin-top:10px;padding:12px 14px;border:1px solid var(--_line);border-radius:var(--_r);background:color-mix(in oklab,var(--_ring) 5%,var(--_bg));font-size:.875rem}.cs[hidden]{display:none}
.cs h3{margin:0;font-size:.9375rem;font-weight:600}.cs>p{margin:4px 0 10px;font-size:.8125rem}.cs .q{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}.cs .q p{margin:0;flex:1;min-width:12em}
.cs ul{max-height:none;overflow:visible;gap:4px;margin:0 0 10px}.cs li{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;min-height:44px;padding:6px 4px;cursor:default;align-items:start}.cs li:hover{background:none}
.cs input[type=checkbox]{width:20px;height:20px;min-height:0;margin:2px 0 0;padding:0;accent-color:var(--_ring)}.cs label{font-weight:600}.cs .v{grid-column:2;display:flex;flex-wrap:wrap;gap:4px 8px;color:var(--_muted);overflow-wrap:anywhere}.cs s{opacity:.75}.cs ins{text-decoration:none;color:inherit}
.cs .b{grid-column:2;justify-self:start;padding:1px 8px;border-radius:999px;font-size:.75rem;background:color-mix(in oklab,var(--_ring) 12%,transparent);color:var(--_ring)}.cs .b.m{background:color-mix(in oklab,var(--_muted) 14%,transparent);color:inherit}
.cs .ex{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px;font-size:.8125rem}.cs .ex button{padding:0;border:0;background:none;font:inherit;color:var(--_ring);cursor:pointer;text-decoration:underline;text-underline-offset:3px}.cs .ex[hidden]{display:none}.cs .kv li{min-height:0;padding:2px 4px}.cs li button{all:unset;cursor:pointer;grid-column:1/-1}.cs li button:focus-visible{outline:2px solid var(--_ring)}.cs li:has(button):hover{background:var(--_active)}
.cs .row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.cs .bt{min-height:40px;padding:0 14px;border-radius:calc(var(--_r) - 2px);font:inherit;font-weight:600;cursor:pointer;border:1px solid var(--_ring);background:var(--_ring);color:#fff}.cs .bt.g{background:transparent;color:inherit;border-color:var(--_input)}.cs .bt:disabled{opacity:.6;cursor:default}.cs .bt:focus-visible,.cs input:focus-visible{outline:2px solid var(--_ring);outline-offset:2px}.cs .note{padding:0;margin:8px 0 0}
@media (prefers-reduced-motion:reduce){input{transition:none}.field::after{animation-duration:0s,2.4s!important}}
@media (forced-colors:active){li[aria-selected=true]{background:Highlight;color:HighlightText;forced-color-adjust:none}input,.pop{border:1px solid CanvasText}input:focus-visible{outline:2px solid Highlight}}
`;
const SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
// Here's My Church's mark: a lilac cursive "h" on a plum tile.
const HMC = `<svg viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="hmc-t"><rect width="20" height="20" rx="5"/></clipPath></defs><g clip-path="url(#hmc-t)"><rect width="20" height="20" fill="#3B1D6E"/><path d="M-1 16C3 14 6 9 7.4 5.2 8.4 2.4 6.3 1.7 5.8 4.6 5.3 8 5.5 13 5.7 21M5.9 15.2C7.1 11.4 9.9 9.4 11.9 10.2 13.8 11 13.3 14.6 13.8 16.8 14.2 18.6 17 18.2 21 15.4" fill="none" stroke="#D2B4FB" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const CLEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
const CHURCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v5M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4"/></svg>`;

let uid = 0;

// Importing on a server, as Next.js does while rendering, defines the class without registering it.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

/** `detail` of church-error: what failed (a search, or loading a church) and why. */
export interface ChurchErrorDetail { query?: string; id?: string; status?: number; code?: string; retryAfter?: number; error: unknown }

interface WatchRow { field: string; el: FieldTarget; label: string; was: string; review: "live" | "moderated"; soon: boolean }
type Row = WatchRow & { value: string; parts?: Record<string, string> };
interface Snapshot {
  id: string; record: ChurchRecord; rows: WatchRow[]; sent: Map<string, string>; dismissed: string; confirmed: boolean;
  /** Rows the person unchecked. Changed rows start checked. */
  off: Set<string>; stale: boolean; reports: (keyof Strings["reports"])[]; note: string; stop: () => void;
}
/** The add-a-church offer: what was offered, and what's showing. */
interface Adding { name: string; dismissed: boolean; busy: boolean }

export class ChurchLookup extends Base {
  static formAssociated = true;
  static observedAttributes = ["label", "placeholder", "lang", "required", "value"];
  /** Map of record field to an element or selector. Merged over data-hmc-field elements. */
  fieldMap: Record<string, FieldTarget | string> = {};
  lookup: Lookup | null = null;
  private internals: ElementInternals | null = null;
  private fallback: HTMLInputElement | null = null;
  private current = "";
  private overrides: Partial<Strings> = {};
  private clearBtn!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private meta: Promise<Meta | null> | null = null;
  private snap: Snapshot | null = null;
  private adding: Adding | null = null;
  private input!: HTMLInputElement;
  private list!: HTMLUListElement;
  private pop!: HTMLDivElement;
  private note!: HTMLDivElement;
  private fix!: HTMLParagraphElement;
  private live!: HTMLDivElement;
  private composing = false;
  private key = `hmc-${++uid}`;
  /** The search engine; this element only renders it. See @heresmychurch/lookup/core. */
  private ctl = createLookupController({
    lookup: () => this.client(),
    params: () => {
      const a = (n: string) => this.getAttribute(n) ?? undefined;
      const n = (k: string) => { const v = parseFloat(a(k) ?? ""); return Number.isFinite(v) ? v : undefined; };
      return {
        region: a("region"), country: a("country"), near: a("near"), lat: n("lat"), lng: n("lng"),
        limit: n("limit"), maxResults: n("max-results"), minChars: n("min-chars"), debounce: n("debounce"),
        semantic: a("semantic") !== "off", geo: a("geo") !== "off",
      };
    },
    text: () => this.input?.value ?? "",
    onShow: (st, added) => this.show(st, added),
    onChange: (st) => this.sync(st),
    // For hosts that want to show results elsewhere too, such as pins on a map.
    onResults: (detail) => this.dispatchEvent(new CustomEvent("church-results", { detail, bubbles: true, composed: true })),
    onError: (error, query) => this.fail(error, { query }),
    onSelect: (result) => {
      if (!this.dispatchEvent(new CustomEvent("church-select", { detail: { result }, cancelable: true, bubbles: true, composed: true }))) return false;
      this.input.value = result.name;
    },
  });

  constructor() {
    super();
    try { this.internals = this.attachInternals?.() ?? null; } catch { this.internals = null; }
  }

  /** The chosen church's ID, or "". Setting an ID shows that church, as on an edit screen. */
  get value(): string { return this.current; }
  set value(id: string) { void this.prefill(id); }
  /** The chosen church as a search result, or null. */
  get selected(): SearchResult | null { return this.ctl.state.selected; }
  /** Override any text, such as { label: "Your parish" }. */
  get strings(): Partial<Strings> { return this.overrides; }
  set strings(v: Partial<Strings>) { this.overrides = v ?? {}; this.applyText(); }
  get form(): HTMLFormElement | null { return this.internals?.form ?? this.closest("form"); }
  get validity(): ValidityState | undefined { return this.internals?.validity; }
  checkValidity(): boolean { return this.internals?.checkValidity() ?? true; }
  reportValidity(): boolean { return this.internals?.reportValidity() ?? true; }

  private get uiLang(): string {
    return (this.getAttribute("lang") ?? this.closest("[lang]")?.getAttribute("lang") ?? "en").toLowerCase().split("-")[0]!;
  }
  private get t(): Strings {
    return { ...stringsFor(this.uiLang), ...this.overrides };
  }
  private onStrings = () => this.applyText();

  /** Focus the search box, as for "focus the first invalid field". */
  focus(options?: FocusOptions): void { this.input ? this.input.focus(options) : super.focus(options); }

  attributeChangedCallback(name: string): void {
    if (!this.shadowRoot) return;
    if (name === "value") {
      const id = this.getAttribute("value") ?? "";
      if (id !== this.current) void this.prefill(id);
    } else if (name === "required") this.setValue(this.current);
    else {
      if (name === "lang") this.loadLang();
      this.applyText();
    }
  }
  /** Load a language file that sits next to element.js, unless it's already registered. */
  private loadLang(): void {
    const lang = this.uiLang;
    if (!LANGS.includes(lang) || registry()[lang]) return;
    import(/* @vite-ignore */ new URL(`./strings-${lang}.js`, import.meta.url).href).catch(() => { /* stay in English */ });
  }

  disconnectedCallback(): void {
    document.removeEventListener("hmc-strings", this.onStrings);
    document.removeEventListener("submit", this.onSubmit, true);
    document.removeEventListener("change", this.onFormChange, true);
    this.ctl.destroy();
    this.close();
    // Moving the element (a portal, a reorder) reconnects it at once: keep the consent panel then.
    queueMicrotask(() => { if (!this.isConnected) this.unwatch(); });
  }

  connectedCallback(): void {
    document.addEventListener("hmc-strings", this.onStrings);
    document.addEventListener("submit", this.onSubmit, true);
    document.addEventListener("change", this.onFormChange, true);
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    const id = this.key;
    root.innerHTML = `<style>${CSS}</style><label part="label" for="${id}-i"></label><div class="field"><slot name="search-icon">${SEARCH}</slot><input part="input" id="${id}-i" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-l" autocomplete="off" spellcheck="false"><button class="x" part="clear" type="button" hidden>${CLEAR}</button></div><div class="pop" part="popup" hidden><p class="fix" part="corrected" hidden></p><ul part="listbox" role="listbox" id="${id}-l"></ul><div class="note" part="note" hidden></div><div class="foot" part="footer">${HMC}<span><i class="df"></i><b><a href="${ADD_URL}" target="_blank" rel="noopener">Here's My Church</a></b></span><a class="osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a></div></div><div class="cs" part="consent" role="region" hidden></div><div class="sr" role="status" aria-live="polite"></div>`;
    this.input = root.querySelector("input")!;
    this.list = root.querySelector("ul")!;
    this.pop = root.querySelector(".pop")!;
    this.note = root.querySelector(".note")!;
    this.fix = root.querySelector(".fix")!;
    this.live = root.querySelector("[role=status]")!;
    this.clearBtn = root.querySelector(".x")!;
    this.panel = root.querySelector(".cs")!;
    this.clearBtn.addEventListener("click", () => { this.clear(); this.input.focus(); });
    this.applyText();
    this.loadLang();
    this.input.addEventListener("input", () => this.onInput());
    this.input.addEventListener("compositionstart", () => (this.composing = true));
    this.input.addEventListener("compositionend", () => { this.composing = false; this.onInput(); });
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    this.input.addEventListener("blur", () => setTimeout(() => this.close(), 120));
    // Keep focus in the box while clicking the popup, so it stays open.
    this.pop.addEventListener("mousedown", (e) => e.preventDefault());
    this.list.addEventListener("click", (e) => {
      const li = (e.target as Element).closest("li");
      if (li) void this.choose(Number(li.dataset.i));
    });
    // Without ElementInternals (older browsers), a hidden input carries the value instead.
    const name = this.getAttribute("name");
    if (!this.internals && name && !this.fallback) {
      this.fallback = Object.assign(document.createElement("input"), { type: "hidden", name });
      this.append(this.fallback);
    }
    this.setValue("");
    const initial = this.getAttribute("value");
    // After a microtask, so a lookup client or strings set right after creation are used.
    if (initial) queueMicrotask(() => void this.prefill(initial));
  }

  private applyText(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const t = this.t;
    root.querySelector("label")!.textContent = this.getAttribute("label") ?? this.overrides.label ?? t.label;
    this.input.placeholder = this.getAttribute("placeholder") ?? this.overrides.placeholder ?? t.placeholder;
    this.clearBtn.setAttribute("aria-label", t.clear);
    root.querySelector(".df")!.textContent = `${t.dataFrom} `;
  }

  /** Set the submitted value and keep validity, the clear button and the fallback input in step. */
  private setValue(id: string): void {
    this.current = id;
    this.internals?.setFormValue(id || null);
    if (this.fallback) this.fallback.value = id;
    this.toggleAttribute("data-chosen", Boolean(id));
    if (this.clearBtn) this.clearBtn.hidden = !id;
    if (this.internals && this.input) {
      if (this.hasAttribute("required") && !id) this.internals.setValidity({ valueMissing: true }, this.t.required, this.input);
      else this.internals.setValidity({});
    }
  }

  /** Forget the chosen church. Fields it filled keep their values. */
  clear(): void {
    this.ctl.reset();
    this.input.value = "";
    this.close();
    this.drop();
  }

  /** The choice is gone, by the clear button or by editing the name: tell the host once. */
  private drop(): void {
    const had = Boolean(this.current);
    this.unwatch();
    this.setValue("");
    if (had) this.dispatchEvent(new CustomEvent("church-clear", { bubbles: true, composed: true }));
  }

  /** Tell the host about a failed search or church load, such as for logging. */
  private fail(error: unknown, detail: { query?: string; id?: string }): void {
    const e = error as Partial<LookupError>;
    this.dispatchEvent(new CustomEvent<ChurchErrorDetail>("church-error", { detail: { ...detail, status: e.status, code: e.code, retryAfter: e.retryAfter, error }, bubbles: true, composed: true }));
  }

  /** Show a church by ID without searching, such as one saved earlier. Fills only with fill-on-load. */
  private async prefill(id: string): Promise<void> {
    if (!this.shadowRoot) { if (id) this.setAttribute("value", id); return; }
    if (!id) { this.clear(); return; }
    try {
      const record = await this.client().getChurch(id);
      const name = String(record.fields.name ?? "");
      this.input.value = name;
      this.ctl.select({ id: record.id, name, label: name, locationLabel: "" } as SearchResult);
      this.setValue(record.id);
      if (this.hasAttribute("fill-on-load")) this.fillFrom(record);
    } catch (e) {
      this.say(this.t.loadFail);
      this.fail(e, { id });
    }
  }

  formResetCallback(): void { this.clear(); }
  formStateRestoreCallback(state: unknown): void { if (typeof state === "string" && state) void this.prefill(state); }
  formDisabledCallback(disabled: boolean): void {
    if (this.input) this.input.disabled = disabled;
    if (this.clearBtn) this.clearBtn.disabled = disabled;
  }

  private client(): Lookup {
    return this.lookup ??= createLookup({ baseUrl: this.getAttribute("base-url") ?? undefined, client: this.getAttribute("client") ?? undefined });
  }

  private onInput(): void {
    if (this.composing) return;
    this.ctl.input(this.input.value);
    // Typing after a pick starts over: the old choice no longer matches what's in the box.
    if (this.current && !this.ctl.state.selected) this.drop();
  }

  /** Keep the popup's open state and the highlighted option in step with the controller. */
  private sync(st: Readonly<ControllerState>): void {
    if (!this.pop) return;
    this.toggleAttribute("data-loading", st.loading || st.loadingMore);
    this.list.setAttribute("aria-busy", String(st.loading));
    const more = this.list.querySelector(".more");
    if (more) {
      more.textContent = st.loadingMore ? this.t.loading : this.t.more;
      more.setAttribute("aria-disabled", String(st.loadingMore));
    }
    this.pop.hidden = !st.open;
    this.input.setAttribute("aria-expanded", String(st.open));
    if (st.open) this.mark();
    else this.input.removeAttribute("aria-activedescendant");
  }

  /**
   * Render results, then a "Show more" row while there are more. The controller has already kept the
   * highlighted church in its place; `added` are the rows "Show more" just appended.
   */
  private show(st: Readonly<ControllerState>, added?: SearchResult[]): void {
    const t = this.t;
    const next = st.results;
    const error = st.error ? t.error : undefined;
    const option = (i: number) => {
      const li = document.createElement("li");
      li.id = `${this.key}-o${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("part", "option");
      li.setAttribute("aria-selected", String(i === st.active));
      li.dataset.i = String(i);
      return li;
    };
    this.placeIcons(next.length);
    const rows = next.map((r, i) => {
      const li = option(i);
      li.innerHTML = `<span class="ic"><slot name="hmc-ic-${i}">${CHURCH}</slot></span><span class="t"><span class="n" part="option-name"></span><span class="sub" part="option-detail"></span></span><span class="d" part="option-distance"></span>`;
      li.querySelector(".n")!.textContent = r.name;
      li.querySelector(".sub")!.textContent = r.locationLabel;
      li.querySelector(".d")!.textContent = r.distanceKm == null ? "" : r.distanceKm < 10 ? `${r.distanceKm} km` : `${Math.round(r.distanceKm)} km`;
      return li;
    });
    if (st.hasMore) {
      const li = option(next.length);
      li.className = "more";
      li.setAttribute("part", "more");
      li.textContent = t.more;
      rows.push(li);
    }
    this.list.replaceChildren(...rows);
    this.fix.hidden = !st.corrected || !next.length;
    this.fix.textContent = st.corrected ? t.corrected(st.corrected) : "";
    this.note.hidden = Boolean(next.length);
    if (!next.length) {
      this.note.innerHTML = "";
      this.note.append(error ?? t.none);
      const a = document.createElement(error ? "button" : "a");
      if (a instanceof HTMLButtonElement) {
        a.type = "button";
        a.className = "rt";
        a.setAttribute("part", "retry");
        a.onclick = () => this.ctl.retry();
        a.textContent = t.retry;
      } else {
        const tg = this.targets();
        Object.assign(a, { href: addUrl({ name: st.query, city: tg.get("city")?.value, region: (tg.get("region") ?? tg.get("regionName"))?.value }), target: "_blank", rel: "noopener", textContent: t.add });
      }
      this.note.append(a);
    }
    if (added) this.say(t.moreFound(added.length));
    else this.say(error ?? (next.length ? (st.corrected ? `${t.corrected(st.corrected)}. ` : "") + t.found(next.length) : t.noneShort));
  }

  close(): void {
    this.ctl.close();
    if (!this.pop) return;
    this.pop.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
  }

  private mark(): void {
    const active = this.ctl.state.active;
    this.list.querySelectorAll("li").forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
    const li = active >= 0 ? this.list.children[active] : null;
    if (li) {
      this.input.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView?.({ block: "nearest" });
    } else this.input.removeAttribute("aria-activedescendant");
  }

  private onKey(e: KeyboardEvent): void {
    const { results, active } = this.ctl.state;
    const n = results.length;
    const isOpen = !this.pop.hidden;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) { if (n) this.ctl.open(); if (e.altKey) return; }
      if (!n) return;
      this.ctl.move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && isOpen && active >= 0) {
      e.preventDefault();
      void this.choose(active);
    } else if (e.key === "Enter" && isOpen && this.ctl.state.error) {
      e.preventDefault();
      this.ctl.retry();
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      this.close();
    } else if (e.key === "Tab") this.close();
  }

  private say(text: string): void {
    this.live.textContent = "";
    setTimeout(() => (this.live.textContent = text), 50);
  }

  /**
   * Your own result icon, from any icon library: a child with slot="result-icon" (an element or a
   * <template>). It's copied once per result into the light DOM and slotted into that row, so page
   * CSS still styles it, which icon fonts need. Without one, the built-in church icon shows.
   */
  private placeIcons(n: number): void {
    const kids = [...this.children];
    kids.filter((el) => el.hasAttribute("data-hmc-icon")).forEach((el) => el.remove());
    const src = kids.find((el) => el.getAttribute("slot") === "result-icon");
    if (!src) return;
    for (let i = 0; i < n; i++) {
      let copy: Element;
      if (src instanceof HTMLTemplateElement) {
        copy = document.createElement("span");
        copy.append(src.content.cloneNode(true));
      } else copy = src.cloneNode(true) as Element;
      copy.setAttribute("slot", `hmc-ic-${i}`);
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("data-hmc-icon", "");
      copy.removeAttribute("id");
      this.append(copy);
    }
  }

  /**
   * The fields to fill: tagged ones, church-named ones (church_city), and with fill="auto" plain ones
   * (city) too, but only inside a form. fill="tagged" uses tags and fieldMap only.
   */
  private targets(): Map<string, FieldTarget> {
    const fill = this.getAttribute("fill");
    const scopeId = this.getAttribute("form");
    const form = (scopeId && document.getElementById(scopeId)) || this.closest("form");
    const out = findTargets(form || document, fill === "tagged" ? undefined : (el) => matchField(el, fill === "auto" && Boolean(form)));
    for (const [field, t] of Object.entries(this.fieldMap)) {
      const el = typeof t === "string" ? document.querySelector<FieldTarget>(t) : t;
      if (el) out.set(field, el);
    }
    return out;
  }

  private async choose(i: number): Promise<void> {
    const id = this.ctl.state.results[i]?.id;
    let record: ChurchRecord | null;
    try {
      record = await this.ctl.choose(i);
    } catch (e) {
      this.say(this.t.loadFail);
      this.fail(e, { id });
      return;
    }
    if (!record) return;
    // The ID is set once the record loads, and follows a church that merged into another.
    this.setValue(record.id);
    this.fillFrom(record);
  }

  /** Fill the form, unless fill="off": then church-fill still carries the record, with no changes. */
  private fillFrom(record: ChurchRecord): void {
    const off = this.getAttribute("fill") === "off";
    const { changes, empty } = off ? { changes: [], empty: [] } : planFill(record, this.targets(), { overwrite: this.hasAttribute("overwrite") });
    if (!this.dispatchEvent(new CustomEvent("church-fill", { detail: { record, changes }, cancelable: true, bubbles: true, composed: true })) || off) return;
    applyFill(changes);
    this.say(this.t.filled(changes.length, empty));
    void this.watch(record);
  }

  // ── Consent: share corrections back to Here's My Church, only when the person chooses to ──

  private metaP(): Promise<Meta | null> {
    return (this.meta ??= this.client().meta().catch(() => null));
  }

  private unwatch(): void {
    this.snap?.stop();
    this.snap = null;
    if (this.panel) this.panel.hidden = true;
  }

  /** After a fill, watch the mapped fields Lookup can contribute, against what the record said. */
  private async watch(record: ChurchRecord): Promise<void> {
    this.unwatch();
    this.adding = null;
    if (this.getAttribute("contribute") === "off") return;
    const meta = await this.metaP();
    if (!meta?.contributableFields) return;
    const country = String(record.fields.country ?? "");
    const rows: WatchRow[] = [];
    for (const [field, el] of this.targets()) {
      const rule = contributable(meta, field, country);
      if (!rule) continue;
      const label = (el.labels?.[0]?.textContent ?? el.getAttribute("aria-label") ?? field).trim();
      rows.push({ field, el, label, was: (fieldValue(record, field) ?? "").trim(), review: rule.review, soon: rule.status === "coming_soon" });
    }
    const reports = (["reportClosed", "reportDuplicate", "reportRelocated"] as const).filter((f) => contributable(meta, f, country));
    const render = () => this.renderPanel();
    rows.forEach((r) => r.el.addEventListener("change", render));
    this.snap = { id: record.id, record, rows, sent: new Map(), dismissed: "", confirmed: false, off: new Set(), stale: isStale(record), reports, note: "", stop: () => rows.forEach((r) => r.el.removeEventListener("change", render)) };
    this.renderPanel();
  }

  /** Changed rows, with street, city and postal code as one address row. */
  private changed(): Row[] {
    const s = this.snap!;
    return consentDiff(mergeAddress(s.rows.map((r) => ({ ...r, value: r.el.value }))), s.sent);
  }

  /** Report a problem, and a link to fix anything else on Here's My Church. */
  private extras(): HTMLElement {
    const s = this.snap!;
    const t = this.t;
    const ex = document.createElement("div");
    ex.className = "ex";
    if (s.note) ex.append(s.note);
    else if (s.reports.length) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t.report;
      b.setAttribute("aria-expanded", "false");
      b.onclick = () => {
        b.replaceWith(...s.reports.map((f) => {
          const c = document.createElement("button");
          c.type = "button";
          c.textContent = t.reports[f];
          c.onclick = () => void this.send([{ field: f, value: "true" }], true);
          return c;
        }));
        ex.querySelector("button")?.focus();
      };
      ex.append(b);
    }
    const url = suggestUrl(s.record);
    if (url) {
      const a = Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener", textContent: t.moreFixes });
      ex.append(a);
    }
    ex.hidden = !ex.childNodes.length;
    return ex;
  }

  private renderPanel(result?: Map<string, { status: FieldStatus; message?: string }>, sandbox?: boolean): void {
    const s = this.snap;
    const p = this.panel;
    if (!s) { p.hidden = true; return; }
    const t = this.t;
    const changed = this.changed();
    const sig = changed.map((r) => `${r.field}=${r.value.trim()}`).join("|");
    const h = `${this.key}-cs`;
    p.setAttribute("aria-labelledby", h);
    if (!result && changed.length && s.dismissed === sig) { p.hidden = true; return; }
    if (!changed.length && !result) {
      // Nothing to share: ask "Still correct?" of a listing nobody confirmed this year, once per pick.
      p.innerHTML = "";
      if (s.stale && !s.confirmed && s.dismissed !== "confirm" && !changed.length) {
        p.innerHTML = `<div class="q"><p id="${h}"></p><span class="row"><button type="button" class="bt"></button><button type="button" class="bt g"></button></span></div>`;
        p.querySelector("p")!.textContent = t.confirmQ;
        const [yes, no] = p.querySelectorAll<HTMLButtonElement>("button");
        yes!.textContent = t.stillCorrect;
        no!.textContent = t.notNow;
        yes!.onclick = () => void this.sendConfirm();
        no!.onclick = () => { s.dismissed = "confirm"; this.renderPanel(); };
      }
      const ex = this.extras();
      p.append(ex);
      p.hidden = ex.hidden && !p.querySelector("p");
      return;
    }
    const wasHidden = p.hidden || !p.querySelector("ul");
    p.innerHTML = `<h3 id="${h}"></h3><p></p><ul></ul><div class="row"><button type="button" class="bt"></button><button type="button" class="bt g"></button></div>`;
    p.querySelector("h3")!.textContent = t.shareTitle;
    p.querySelector("p")!.textContent = t.shareBody;
    const ul = p.querySelector("ul")!;
    const shown: Row[] = result ? mergeAddress(s.rows.map((r) => ({ ...r, value: r.el.value }))).filter((r) => result.has(r.field) && !changed.some((c) => c.field === r.field)).concat(changed) : changed;
    const [share, later] = p.querySelectorAll<HTMLButtonElement>(".row button");
    const count = () => {
      const n = p.querySelectorAll("ul input:checked:not(:disabled)").length;
      share!.textContent = n ? t.shareN(n) : t.share;
      share!.disabled = !n;
    };
    shown.forEach((r, i) => {
      const li = document.createElement("li");
      const id = `${h}-${i}`;
      const res = result?.get(r.field);
      li.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}"></label><span class="v"><s></s><span aria-hidden="true">→</span><ins></ins></span><span class="b"></span>`;
      const box = li.querySelector("input")!;
      box.dataset.field = r.field;
      box.disabled = r.soon || (Boolean(res) && res!.status !== "try_again" && !changed.includes(r));
      box.checked = !box.disabled && !s.off.has(r.field);
      box.onchange = () => { s.off[box.checked ? "delete" : "add"](r.field); count(); };
      li.querySelector("label")!.textContent = r.parts ? t.address : r.label;
      li.querySelector("s")!.textContent = r.was || "—";
      li.querySelector("ins")!.textContent = res && !changed.includes(r) ? (s.sent.get(r.field) ?? r.value.trim()) : r.value.trim();
      const b = li.querySelector<HTMLElement>(".b")!;
      b.textContent = res ? (res.message && res.status === "rejected" ? `${t.st.rejected}: ${res.message}` : t.st[res.status]) : r.soon ? t.soon : r.review === "moderated" ? t.reviewed : t.goesLive;
      b.classList.toggle("m", r.soon || r.review === "moderated" || (Boolean(res) && res!.status !== "live"));
      ul.append(li);
    });
    count();
    later!.textContent = t.notNow;
    share!.onclick = () => void this.sendShare();
    later!.onclick = () => { s.dismissed = sig; this.renderPanel(); };
    // After a share with nothing left to send, one button closes the panel.
    if (result && !p.querySelector("ul input:not(:disabled)")) { share!.hidden = true; later!.textContent = t.done; }
    if (sandbox) {
      const n = document.createElement("p");
      n.className = "note";
      n.textContent = t.sandbox;
      p.append(n);
    }
    p.append(this.extras());
    p.hidden = false;
    if (wasHidden && !result) this.say(t.changedNote(changed.length));
  }

  /** Send changes for the chosen church. A report (true) shows its outcome in place of the report link. */
  private async send(changes: { field: string; value: unknown }[], report = false): Promise<void> {
    const s = this.snap!;
    if (!this.dispatchEvent(new CustomEvent("church-contribute", { detail: { churchId: s.id, changes }, cancelable: true, bubbles: true, composed: true }))) return;
    const btn = this.panel.querySelector<HTMLButtonElement>(".row .bt");
    if (btn && !report) { btn.disabled = true; btn.textContent = this.t.sending; }
    let out: { sandbox?: boolean; results: { field: string; status: FieldStatus; message?: string }[] };
    try { out = await this.client().contribute(s.id, changes); }
    catch { out = { results: changes.map((c) => ({ field: c.field, status: "try_again" as const })) }; }
    if (this.snap !== s) return;
    const t = this.t;
    if (report) {
      const st = out.results[0]?.status ?? "try_again";
      s.note = st === "try_again" || st === "rejected" ? t.st[st] : `${t.reported}${out.sandbox ? ` ${t.sandbox}` : ""}`;
      this.renderPanel();
      this.say(s.note);
      return;
    }
    const result = new Map(out.results.map((r) => [r.field, r]));
    const rows = this.changed();
    for (const c of changes) if (result.get(c.field)?.status !== "try_again") s.sent.set(c.field, rows.find((r) => r.field === c.field)?.value.trim() ?? String(c.value));
    this.renderPanel(result, out.sandbox);
    const done = out.results.filter((r) => r.status === "live" || r.status === "in_review").length;
    this.say(`${t.shared(done)} ${out.results.map((r) => `${r.field}: ${t.st[r.status]}`).join(". ")}.`);
  }

  private sendShare(): Promise<void> {
    const boxes = [...this.panel.querySelectorAll<HTMLInputElement>("ul input:checked:not(:disabled)")].map((b) => b.dataset.field);
    const picked = this.changed().filter((r) => boxes.includes(r.field));
    return picked.length ? this.send(picked.map(changeFor)) : Promise.resolve();
  }

  /** A checked data-hmc-share box in the submitted form sends the checked changes, without holding up the submit. */
  private onSubmit = (e: Event): void => {
    const form = e.target as HTMLFormElement;
    const s = this.snap;
    if (!s || !(form === this.form || form.contains?.(this)) || !form.querySelector<HTMLInputElement>("[data-hmc-share]")?.checked) return;
    const rows = this.changed().filter((r) => !r.soon && !s.off.has(r.field));
    if (!rows.length) return;
    const changes = rows.map(changeFor);
    if (!this.dispatchEvent(new CustomEvent("church-contribute", { detail: { churchId: s.id, changes, onSubmit: true }, cancelable: true, bubbles: true, composed: true }))) return;
    for (const r of rows) s.sent.set(r.field, r.value.trim());
    this.client().contribute(s.id, changes, { keepalive: true }).catch(() => { /* nothing to show: the page is moving on */ });
    // A form that stays on the page (a single-page app) shouldn't offer the same fixes again.
    this.renderPanel();
  };

  private async sendConfirm(): Promise<void> {
    const s = this.snap!;
    if (!this.dispatchEvent(new CustomEvent("church-confirm", { detail: { churchId: s.id }, cancelable: true, bubbles: true, composed: true }))) return;
    let ok = false;
    try { ok = (await this.client().confirm(s.id)).status === "confirmed"; } catch { ok = false; }
    if (this.snap !== s) return;
    s.confirmed = ok;
    const msg = ok ? this.t.thanks : this.t.st.try_again;
    this.panel.querySelector("p")!.textContent = msg;
    this.panel.querySelectorAll(".row button").forEach((b) => { (b as HTMLElement).hidden = ok; });
    this.say(msg);
  }

  // ── Add a church that isn't listed ──

  /** A mapped field changed while no church is chosen: offer to add the one typed in. */
  private onFormChange = (e: Event): void => {
    if (this.current || this.snap || !this.input?.value.trim() || ![...this.targets().values()].includes(e.target as FieldTarget)) return;
    void this.offerAdd();
  };

  private newChurch(): NewChurch | null {
    return newChurchFrom(this.input.value, this.targets());
  }

  private async offerAdd(): Promise<void> {
    if (this.getAttribute("contribute") === "off" || this.adding?.busy) return;
    const meta = await this.metaP();
    const church = this.newChurch();
    const p = this.panel;
    if (!meta?.addEnabled || !church || this.current || this.snap) { if (!this.snap) p.hidden = true; return; }
    if (this.adding?.name === church.name && this.adding.dismissed) return;
    this.adding = { name: church.name, dismissed: false, busy: false };
    const t = this.t;
    const h = `${this.key}-cs`;
    p.setAttribute("aria-labelledby", h);
    p.innerHTML = `<h3 id="${h}"></h3><p></p><ul></ul><div class="row"><button type="button" class="bt"></button><button type="button" class="bt g"></button></div>`;
    p.querySelector("h3")!.textContent = t.addQ(church.name);
    p.querySelector("p")!.textContent = t.addBody;
    p.querySelector("ul")!.className = "kv";
    const labels = new Map([...this.targets()].map(([f, el]) => [f === "regionName" ? "region" : f === "countryName" ? "country" : f, (el.labels?.[0]?.textContent ?? f).trim()]));
    for (const [k, v] of Object.entries(church)) {
      const li = document.createElement("li");
      li.innerHTML = `<b></b><span></span>`;
      li.firstChild!.textContent = k === "name" ? t.label : labels.get(k) ?? k;
      li.lastChild!.textContent = String(v);
      p.querySelector("ul")!.append(li);
    }
    const [yes, no] = p.querySelectorAll<HTMLButtonElement>(".row button");
    yes!.textContent = t.addBtn;
    no!.textContent = t.notNow;
    yes!.onclick = () => void this.sendAdd(false);
    no!.onclick = () => { this.adding!.dismissed = true; p.hidden = true; };
    p.hidden = false;
  }

  private async sendAdd(confirmAdd: boolean): Promise<void> {
    const church = this.newChurch();
    const a = this.adding;
    if (!church || !a) return;
    if (!this.dispatchEvent(new CustomEvent("church-add", { detail: { church, confirmAdd }, cancelable: true, bubbles: true, composed: true }))) return;
    const t = this.t;
    const p = this.panel;
    const btn = p.querySelector<HTMLButtonElement>(".row .bt")!;
    btn.disabled = true;
    btn.textContent = t.adding;
    a.busy = true;
    let out: AddResult;
    try { out = await this.client().addChurch(church, { confirmAdd }); }
    catch (e) { out = { status: "try_again", message: (e as Error).message }; }
    a.busy = false;
    if (this.adding !== a) return;
    const head = p.querySelector("h3")!, body = p.querySelector("p")!, ul = p.querySelector("ul")!;
    btn.disabled = false;
    btn.textContent = t.addBtn;
    if (out.status === "similar" && out.similar?.length) {
      head.textContent = t.similarQ;
      body.textContent = "";
      ul.className = "";
      ul.replaceChildren(...out.similar.map((r) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `<span class="t"><span class="n"></span><span class="sub"></span></span>`;
        b.querySelector(".n")!.textContent = r.name;
        b.querySelector(".sub")!.textContent = r.locationLabel;
        b.onclick = () => void this.pickSimilar(r);
        li.append(b);
        return li;
      }));
      btn.textContent = t.noneOfThese;
      btn.onclick = () => void this.sendAdd(true);
      this.say(t.similarQ);
    } else if (out.status === "live") {
      ul.remove();
      head.textContent = t.added(church.name);
      body.textContent = out.sandbox ? t.sandbox : "";
      p.querySelector(".row")!.remove();
      this.adding = { ...a, dismissed: true };
      if (out.id) {
        this.ctl.select({ id: out.id, name: church.name, label: church.name, locationLabel: "" } as SearchResult);
        this.setValue(out.id);
      }
      this.dispatchEvent(new CustomEvent("church-added", { detail: { id: out.id ?? null, church, sandbox: Boolean(out.sandbox) }, bubbles: true, composed: true }));
      this.say(head.textContent);
    } else {
      body.textContent = out.status === "rejected" && out.message ? `${t.st.rejected}: ${out.message}` : t.st.try_again;
      this.say(body.textContent);
    }
  }

  /** "Is it one of these?": choosing one selects it, as picking it from the search would. */
  private async pickSimilar(r: SearchResult): Promise<void> {
    this.adding = null;
    this.panel.hidden = true;
    this.input.value = r.name;
    try {
      const record = await this.client().getChurch(r.id);
      this.ctl.select({ ...r, id: record.id });
      this.setValue(record.id);
      this.fillFrom(record);
    } catch (e) {
      this.say(this.t.loadFail);
      this.fail(e, { id: r.id });
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("church-lookup")) customElements.define("church-lookup", ChurchLookup);
