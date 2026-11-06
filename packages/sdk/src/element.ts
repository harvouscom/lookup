// <church-lookup>: an ARIA 1.2 combobox that searches Here's My Church and autofills a form.
import { createLookup, type ChurchRecord, type Lookup, type SearchResult } from "./client.ts";
import { setNativeValue, type FieldTarget } from "./dom.ts";

export { setNativeValue };

const DEBOUNCE_MS = 150;
const SETTLE_MS = 700;
const SETTLED_MIN = 4;
const ADD_URL = "https://heresmychurch.com";

// Each token falls back to the shadcn/ui names that Sensible UI (sensibleui.com, by Cam Pak) uses, so a
// page styled with either themes the widget with no setup. Custom properties cross the shadow boundary.
const CSS = `
:host{display:block;position:relative;font:inherit;color:var(--hmc-text,var(--foreground,#18181b));
--_bg:var(--hmc-bg,var(--background,#fff));--_pop:var(--hmc-popover,var(--popover,var(--_bg)));--_pop-fg:var(--hmc-popover-text,var(--popover-foreground,inherit));
--_line:var(--hmc-border,var(--border,#d4d4d8));--_input:var(--hmc-input-border,var(--input,#a1a1aa));--_ring:var(--hmc-accent,var(--ring,#6d28d9));
--_active:var(--hmc-active-bg,var(--accent,#f3effe));--_active-fg:var(--hmc-active-text,var(--accent-foreground,inherit));
--_muted:var(--hmc-muted,var(--muted-foreground,#52525b));--_r:var(--hmc-radius,var(--radius,10px))}
label{display:block;margin-bottom:8px;font-weight:600;font-size:.9375rem}
.field{position:relative}
.field svg{position:absolute;z-index:1;left:14px;top:50%;width:20px;height:20px;margin-top:-10px;color:var(--_muted);pointer-events:none}
input{box-sizing:border-box;width:100%;min-height:52px;padding:12px 16px 12px 44px;font:inherit;font-size:1.0625rem;color:inherit;background:var(--_bg);border:1px solid var(--_input);border-radius:var(--_r);outline:none;transition:border-color .15s,box-shadow .15s}
input::placeholder{color:var(--_muted);opacity:.85}
input:focus-visible{border-color:var(--_ring);box-shadow:0 0 0 4px color-mix(in oklab,var(--_ring) 22%,transparent)}
.pop{position:absolute;z-index:var(--hmc-z,1000);left:0;right:0;margin-top:8px;padding:6px;background:var(--_pop);color:var(--_pop-fg);border:1px solid var(--_line);border-radius:calc(var(--_r) + 4px);box-shadow:0 20px 40px -12px rgb(24 24 27/.25),0 4px 10px -4px rgb(24 24 27/.1)}
.pop[hidden]{display:none}
ul{list-style:none;margin:0;padding:0;max-height:min(60vh,400px);overflow:auto;display:grid;gap:2px}
li{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:12px;min-height:56px;padding:8px 10px;border-radius:var(--_r);cursor:pointer}
li:hover,li[aria-selected=true]{background:var(--_active);color:var(--_active-fg)}
.ic{display:grid;place-items:center;width:40px;height:40px;border-radius:calc(var(--_r) - 2px);background:color-mix(in oklab,var(--_ring) 12%,transparent);color:var(--_ring)}
.ic svg{width:20px;height:20px}.ic ::slotted(*){display:grid;place-items:center;width:20px;height:20px;font-size:20px;line-height:1}.field ::slotted([slot=search-icon]){position:absolute;z-index:1;left:14px;top:50%;display:grid;place-items:center;width:20px;height:20px;margin-top:-10px;font-size:20px;line-height:1;color:var(--_muted);pointer-events:none}:host([icons=none]) .ic{display:none}:host([icons=none]) li{grid-template-columns:1fr auto}
.t{display:grid;gap:2px;min-width:0}
.n{font-weight:600;line-height:1.3}
.sub{color:var(--_muted);font-size:.875rem;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.d{font-size:.8125rem;color:var(--_muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.note{padding:14px 12px;font-size:.9375rem;color:var(--_muted)}
.foot{display:flex;align-items:center;gap:8px;margin-top:6px;padding:10px 10px 4px;border-top:1px solid var(--_line);font-size:.75rem;color:var(--_muted)}.foot svg{flex:none;width:20px;height:20px}.foot span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.foot i{font-style:normal}.foot b a{color:inherit;font-weight:600;text-decoration:none}.foot b a:hover{text-decoration:underline}.foot .osm{margin-left:auto;font-size:.6875rem;font-weight:400;color:var(--_muted);text-decoration:none;white-space:nowrap}.foot .osm:hover{text-decoration:underline}
a{color:var(--_ring);font-weight:500;text-underline-offset:3px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:480px){.foot i{display:none}li{grid-template-columns:32px 1fr auto;gap:10px;min-height:48px;padding:6px 8px}.ic{width:32px;height:32px}.ic svg{width:16px;height:16px}.n{font-size:.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sub{font-size:.8125rem}.d{font-size:.75rem}input{min-height:48px;font-size:1rem}}
@media (prefers-reduced-motion:reduce){input{transition:none}}
@media (forced-colors:active){li[aria-selected=true]{background:Highlight;color:HighlightText;forced-color-adjust:none}input,.pop{border:1px solid CanvasText}input:focus-visible{outline:2px solid Highlight}}
`;
const SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
// Here's My Church's mark: a lilac cursive "h" on a plum tile.
const HMC = `<svg viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="hmc-t"><rect width="20" height="20" rx="5"/></clipPath></defs><g clip-path="url(#hmc-t)"><rect width="20" height="20" fill="#3B1D6E"/><path d="M-1 16C3 14 6 9 7.4 5.2 8.4 2.4 6.3 1.7 5.8 4.6 5.3 8 5.5 13 5.7 21M5.9 15.2C7.1 11.4 9.9 9.4 11.9 10.2 13.8 11 13.3 14.6 13.8 16.8 14.2 18.6 17 18.2 21 15.4" fill="none" stroke="#D2B4FB" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const CHURCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v5M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4"/></svg>`;

let uid = 0;

export interface FillChange { field: string; element: FieldTarget; value: string }

export function fieldValue(record: ChurchRecord, field: string): string | null {
  const v = field === "id" ? record.id : record.fields[field];
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "object") return (v as { raw?: string | null }).raw ?? null;
  return String(v);
}

export class ChurchLookup extends HTMLElement {
  /** Map of record field to an element or selector. Merged over data-hmc-field elements. */
  fieldMap: Record<string, FieldTarget | string> = {};
  lookup: Lookup | null = null;
  private input!: HTMLInputElement;
  private list!: HTMLUListElement;
  private pop!: HTMLDivElement;
  private note!: HTMLDivElement;
  private live!: HTMLDivElement;
  private results: SearchResult[] = [];
  private active = -1;
  private composing = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ctrl: AbortController | null = null;
  private seq = 0;
  private id = `hmc-${++uid}`;

  connectedCallback(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    const id = this.id;
    root.innerHTML = `<style>${CSS}</style><label part="label" for="${id}-i"></label><div class="field"><slot name="search-icon">${SEARCH}</slot><input part="input" id="${id}-i" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-l" autocomplete="off" spellcheck="false"></div><div class="pop" part="popup" hidden><ul part="listbox" role="listbox" id="${id}-l"></ul><div class="note" part="note" hidden></div><div class="foot" part="footer">${HMC}<span><i>Data from </i><b><a href="${ADD_URL}" target="_blank" rel="noopener">Here's My Church</a></b></span><a class="osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a></div></div><div class="sr" role="status" aria-live="polite"></div>`;
    this.input = root.querySelector("input")!;
    this.list = root.querySelector("ul")!;
    this.pop = root.querySelector(".pop")!;
    this.note = root.querySelector(".note")!;
    this.live = root.querySelector("[role=status]")!;
    root.querySelector("label")!.textContent = this.getAttribute("label") ?? "Church";
    this.input.placeholder = this.getAttribute("placeholder") ?? "Start typing your church's name";
    this.input.addEventListener("input", () => this.onInput());
    this.input.addEventListener("compositionstart", () => (this.composing = true));
    this.input.addEventListener("compositionend", () => { this.composing = false; this.onInput(); });
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    this.input.addEventListener("blur", () => setTimeout(() => this.close(), 120));
    this.list.addEventListener("mousedown", (e) => e.preventDefault());
    this.list.addEventListener("click", (e) => {
      const li = (e.target as Element).closest("li");
      if (li) this.choose(Number(li.dataset.i));
    });
  }

  private client(): Lookup {
    return this.lookup ??= createLookup({ baseUrl: this.getAttribute("base-url") ?? undefined, client: this.getAttribute("client") ?? undefined });
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private onInput(): void {
    if (this.composing) return;
    this.clearTimers();
    const q = this.input.value.trim();
    if (q.length < 2) { this.ctrl?.abort(); this.results = []; this.close(); return; }
    this.timers.push(setTimeout(() => this.run(q, false), DEBOUNCE_MS));
    if (q.length >= SETTLED_MIN) this.timers.push(setTimeout(() => this.run(q, true), SETTLE_MS));
  }

  private async run(q: string, settled: boolean): Promise<void> {
    this.ctrl?.abort();
    const ctrl = (this.ctrl = new AbortController());
    const seq = ++this.seq;
    const a = (n: string) => this.getAttribute(n) ?? undefined;
    try {
      const res = await this.client().search(q, {
        settled, signal: ctrl.signal, region: a("region"), country: a("country"), near: a("near"),
        limit: Number(a("limit")) || 8, geo: a("geo") !== "off",
      });
      if (seq !== this.seq || this.input.value.trim() !== q) return;
      this.show(res.results);
      // For hosts that want to show results elsewhere too, such as pins on a map.
      this.dispatchEvent(new CustomEvent("church-results", { detail: { query: q, results: this.results, settled }, bubbles: true, composed: true }));
    } catch (e) {
      if ((e as Error).name === "AbortError" || seq !== this.seq) return;
      this.show([], "Search isn't available right now. You can keep typing your church's details.");
    }
  }

  /** Render results. The highlighted church keeps its place when settled results arrive. */
  private show(next: SearchResult[], error?: string): void {
    const pinned = this.results[this.active];
    if (pinned) {
      const at = this.active;
      next = next.filter((r) => r.id !== pinned.id);
      next.splice(Math.min(at, next.length), 0, pinned);
      this.active = Math.min(at, next.length - 1);
    } else this.active = -1;
    this.results = next;
    this.placeIcons(next.length);
    this.list.replaceChildren(...next.map((r, i) => {
      const li = document.createElement("li");
      li.id = `${this.id}-o${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("part", "option");
      li.setAttribute("aria-selected", String(i === this.active));
      li.dataset.i = String(i);
      li.innerHTML = `<span class="ic"><slot name="hmc-ic-${i}">${CHURCH}</slot></span><span class="t"><span class="n"></span><span class="sub"></span></span><span class="d"></span>`;
      li.querySelector(".n")!.textContent = r.name;
      li.querySelector(".sub")!.textContent = r.locationLabel;
      li.querySelector(".d")!.textContent = r.distanceKm == null ? "" : r.distanceKm < 10 ? `${r.distanceKm} km` : `${Math.round(r.distanceKm)} km`;
      return li;
    }));
    this.note.hidden = Boolean(next.length);
    if (!next.length) {
      this.note.innerHTML = "";
      this.note.append(error ?? "No matching church. What you typed stays in the form. ");
      if (!error) {
        const link = document.createElement("a");
        link.href = ADD_URL;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Add it on Here's My Church";
        this.note.append(link);
      }
    }
    this.open();
    this.say(error ?? (next.length ? `${next.length} ${next.length === 1 ? "church" : "churches"} found. Use up and down arrows to choose.` : "No matching church."));
    this.mark();
  }

  private open(): void {
    this.pop.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
  }

  close(): void {
    this.pop.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
  }

  private mark(): void {
    this.list.querySelectorAll("li").forEach((li, i) => li.setAttribute("aria-selected", String(i === this.active)));
    const li = this.active >= 0 ? this.list.children[this.active] : null;
    if (li) {
      this.input.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView?.({ block: "nearest" });
    } else this.input.removeAttribute("aria-activedescendant");
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.results.length;
    const isOpen = !this.pop.hidden;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) { if (n) this.open(); if (e.altKey) return; }
      if (!n) return;
      this.active = e.key === "ArrowDown" ? (this.active + 1) % n : this.active <= 0 ? n - 1 : this.active - 1;
      this.mark();
    } else if (e.key === "Enter" && isOpen && this.active >= 0) {
      e.preventDefault();
      this.choose(this.active);
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

  private targets(): Map<string, FieldTarget> {
    const scopeId = this.getAttribute("form");
    const scope: ParentNode = (scopeId && document.getElementById(scopeId)) || this.closest("form") || document;
    const out = new Map<string, FieldTarget>();
    scope.querySelectorAll<FieldTarget>("[data-hmc-field]").forEach((el) => out.set(el.dataset.hmcField!, el));
    for (const [field, t] of Object.entries(this.fieldMap)) {
      const el = typeof t === "string" ? document.querySelector<FieldTarget>(t) : t;
      if (el) out.set(field, el);
    }
    return out;
  }

  private async choose(i: number): Promise<void> {
    const result = this.results[i];
    if (!result) return;
    this.clearTimers();
    this.close();
    // A new search after choosing starts fresh, with nothing pinned.
    this.results = [];
    this.active = -1;
    if (!this.dispatchEvent(new CustomEvent("church-select", { detail: { result }, cancelable: true, bubbles: true, composed: true }))) return;
    this.input.value = result.name;
    let record: ChurchRecord;
    try {
      record = await this.client().getChurch(result.id);
    } catch {
      this.say("Couldn't load that church's details. You can type them in.");
      return;
    }
    const overwrite = this.hasAttribute("overwrite");
    const changes: FillChange[] = [];
    const empty: string[] = [];
    for (const [field, element] of this.targets()) {
      const value = fieldValue(record, field);
      if (value == null) { empty.push(field); continue; }
      if (!overwrite && element.value.trim()) continue;
      if (element instanceof HTMLSelectElement && ![...element.options].some((o) => o.value === value)) continue;
      changes.push({ field, element, value });
    }
    if (!this.dispatchEvent(new CustomEvent("church-fill", { detail: { record, changes }, cancelable: true, bubbles: true, composed: true }))) return;
    for (const c of changes) setNativeValue(c.element, c.value);
    this.say(`Filled ${changes.length} ${changes.length === 1 ? "field" : "fields"}.${empty.length ? ` Not available: ${empty.join(", ")}.` : ""}`);
  }
}

if (typeof customElements !== "undefined" && !customElements.get("church-lookup")) customElements.define("church-lookup", ChurchLookup);
