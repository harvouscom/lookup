// Shared by the homepage and the docs: theme, copy buttons, tabs, and the interactive demos
// (widget options, theming slider, API playground). Each part checks its markup is on the page.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ── Docs theme: light by default, dark on request, remembered ──
const themeBtn = $("#theme");
const setTheme = (dark) => {
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  themeBtn?.setAttribute("aria-pressed", String(dark));
  try { localStorage.setItem("lookup-docs-theme", dark ? "dark" : "light"); } catch {}
};
themeBtn?.setAttribute("aria-pressed", String(document.documentElement.dataset.theme === "dark"));
themeBtn?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme !== "dark"));

// ── Theming: the widget reads your page's design tokens. Edit them and watch it follow. ──
// The right side gets no Lookup-specific CSS at all: only the token names shadcn/ui and Sensible UI
// use (--background, --foreground, --accent, --border, --radius, ...), set on the page around it.
(function themingPlayground() {
  const ba = $("#ba");
  if (!ba) return;
  const layer = $("#ba-after");
  const box = $("#ba-tokens");
  const SETS = {
    light: { name: "shadcn/ui light", scheme: "light", css: `--background: oklch(1 0 0);
--foreground: oklch(0.145 0 0);
--popover: oklch(1 0 0);
--popover-foreground: oklch(0.145 0 0);
--accent: oklch(0.97 0 0);
--accent-foreground: oklch(0.205 0 0);
--muted-foreground: oklch(0.556 0 0);
--border: oklch(0.922 0 0);
--input: oklch(0.922 0 0);
--ring: oklch(0.708 0 0);
--radius: 0.625rem;` },
    dark: { name: "shadcn/ui dark", scheme: "dark", css: `--background: oklch(0.145 0 0);
--foreground: oklch(0.985 0 0);
--popover: oklch(0.205 0 0);
--popover-foreground: oklch(0.985 0 0);
--accent: oklch(0.269 0 0);
--accent-foreground: oklch(0.985 0 0);
--muted-foreground: oklch(0.708 0 0);
--border: oklch(1 0 0 / 10%);
--input: oklch(1 0 0 / 15%);
--ring: oklch(0.556 0 0);
--radius: 0.625rem;` },
    rose: { name: "Rose", scheme: "light", css: `--background: oklch(0.99 0.004 20);
--foreground: oklch(0.2 0.02 15);
--popover: oklch(1 0 0);
--popover-foreground: oklch(0.2 0.02 15);
--accent: oklch(0.95 0.035 15);
--accent-foreground: oklch(0.42 0.16 15);
--muted-foreground: oklch(0.5 0.03 15);
--border: oklch(0.91 0.02 15);
--input: oklch(0.82 0.06 15);
--ring: oklch(0.6 0.2 15);
--radius: 1.25rem;` },
    ocean: { name: "Ocean", scheme: "dark", css: `--background: oklch(0.24 0.045 245);
--foreground: oklch(0.97 0.01 245);
--popover: oklch(0.28 0.05 245);
--popover-foreground: oklch(0.97 0.01 245);
--accent: oklch(0.38 0.09 240);
--accent-foreground: oklch(0.99 0 0);
--muted-foreground: oklch(0.78 0.04 245);
--border: oklch(1 0 0 / 12%);
--input: oklch(1 0 0 / 22%);
--ring: oklch(0.75 0.14 225);
--radius: 0.25rem;` },
  };
  let set = "light";
  let applied = [];
  // Older shadcn themes write colors as bare HSL parts ("222 47% 11%"); wrap those in hsl().
  const fix = (v) => (/^-?[\d.]+\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(v) ? `hsl(${v})` : v);
  function apply() {
    for (const k of applied) layer.style.removeProperty(k);
    applied = [];
    for (const m of box.value.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) {
      layer.style.setProperty(m[1], fix(m[2].trim()));
      applied.push(m[1]);
    }
    const preset = SETS[set];
    layer.style.colorScheme = preset && box.value === preset.css ? preset.scheme : "normal";
    $("#ba-tag").textContent = preset && box.value === preset.css ? preset.name : "your tokens";
  }
  function pick(key) {
    set = key;
    box.value = SETS[key].css;
    for (const b of $$("[data-tokens]")) b.setAttribute("aria-pressed", String(b.dataset.tokens === key));
    apply();
  }
  $$("[data-tokens]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.tokens)));
  box.addEventListener("input", () => {
    for (const b of $$("[data-tokens]")) b.setAttribute("aria-pressed", String(SETS[b.dataset.tokens].css === box.value));
    apply();
  });
  $("#ba-range").addEventListener("input", (e) => ba.style.setProperty("--pos", `${e.target.value}%`));
  pick("light");
  // Open both widgets on the same search the first time the slider comes into view.
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    for (const cl of $$("church-lookup", ba)) {
      const input = cl.shadowRoot?.querySelector("input");
      if (!input) continue;
      input.value = "grace";
      input.dispatchEvent(new Event("input"));
    }
  }, { threshold: 0.4 }).observe(ba);
})();

// ── Copy buttons ──
$$(".copy").forEach((btn) => btn.addEventListener("click", async () => {
  const box = btn.closest(".code, .cb");
  const pre = $$("pre", box).find((p) => !p.hidden);
  const label = btn.dataset.label ??= btn.textContent;
  const cap = label[0] === label[0].toUpperCase();
  try {
    await navigator.clipboard.writeText(pre.textContent);
    btn.textContent = cap ? "Copied" : "copied";
  } catch {
    btn.textContent = cap ? "Select to copy" : "select to copy";
  }
  setTimeout(() => (btn.textContent = label), 1800);
}));

// Buttons that copy a fixed line, such as the agent one-liner.
$$("[data-copy-text]").forEach((btn) => btn.addEventListener("click", async () => {
  const label = btn.dataset.label ??= btn.textContent;
  const cap = label[0] === label[0].toUpperCase();
  try { await navigator.clipboard.writeText(btn.dataset.copyText); btn.textContent = cap ? "Copied" : "copied"; }
  catch { btn.textContent = cap ? "Couldn’t copy" : "couldn’t copy"; }
  setTimeout(() => (btn.textContent = label), 1600);
}));

// ── Tabs, with arrow-key movement ──
$$("[data-tabs]").forEach((box) => {
  const tabs = $$("[role=tab]", box);
  const pick = (t) => {
    tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute("aria-selected", String(on));
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => pick(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      pick(next);
      next.focus();
    });
  });
});

// ── API playground ──
(function apiPlayground() {
const form = $("#play-form");
if (!form) return;
const q = $("#play-q"), settled = $("#play-settled"), geoOff = $("#play-geo");
const urlFor = () => {
  const p = new URLSearchParams({ q: q.value, limit: "5" });
  if (settled.checked) p.set("settled", "1");
  if (geoOff.checked) p.set("geo", "off");
  return `/v1/search?${p}`;
};
const showUrl = () => { $("#play-url").innerHTML = `<b>GET</b> https://lookup.heresmychurch.com${urlFor().replace(/&/g, "&amp;").replace(/</g, "&lt;")}`; };
[q, settled, geoOff].forEach((el) => el.addEventListener("input", showUrl));
showUrl();
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#play-status"), out = $("#play-out code");
  status.textContent = "sending…";
  const t0 = performance.now();
  try {
    const res = await fetch(urlFor());
    const body = await res.json();
    const ms = Math.round(performance.now() - t0);
    const timing = res.headers.get("server-timing") ?? "";
    const d1 = timing.match(/d1;dur=(\d+)/)?.[1], ai = timing.match(/ai;dur=(\d+)/)?.[1];
    const cache = res.headers.get("x-lookup-cache");
    status.textContent = `${res.status} · ${ms} ms round trip` + (cache === "hit" ? " · from the edge cache" : d1 ? ` · database ${d1} ms` : "") + (ai && ai !== "0" ? ` · AI ${ai} ms` : "") + ` · ${body.results?.length ?? 0} results`;
    out.textContent = JSON.stringify(body, null, 2);
  } catch (err) {
    status.textContent = `Request failed: ${err.message}`;
  }
});
})();

// Widget options: every change rebuilds a fresh <church-lookup>, since the element reads attributes when it connects.
(function widgetOptions() {
  const host = $("#wo-host");
  if (!host) return;
  const HINTS = {
    required: "The form won\u2019t submit until a church is chosen. Clear the box to see why.",
    value: "Starts with Grace Community Church chosen, as on an edit screen. Its ID submits with the form.",
    icons: "Results without the icon beside each one.",
    geo: "Results aren\u2019t ranked by the visitor\u2019s approximate location.",
  };
  const state = { label: "", placeholder: "", lang: "", near: "", limit: 8, required: false, value: false, icons: false, geo: false };
  const log = $("#wo-log");
  const hint0 = $("#wo-hint").innerHTML;
  let el = null;
  function attrs() {
    const a = [["name", "church_id"]];
    if (state.label) a.push(["label", state.label]);
    if (state.placeholder) a.push(["placeholder", state.placeholder]);
    if (state.lang) a.push(["lang", state.lang]);
    if (state.near) a.push(["near", state.near]);
    if (state.limit !== 8) a.push(["limit", String(state.limit)]);
    if (state.value) a.push(["value", "CA-ON-56994145"]);
    if (state.icons) a.push(["icons", "none"]);
    if (state.geo) a.push(["geo", "off"]);
    if (state.required) a.push(["required", ""]);
    return a;
  }
  function note(kind, text) {
    log.querySelector(".wo-empty")?.remove();
    const li = document.createElement("li");
    li.innerHTML = `<code></code><span></span>`;
    li.firstChild.textContent = kind;
    li.lastChild.textContent = text;
    log.prepend(li);
    while (log.children.length > 4) log.lastChild.remove();
  }
  function build() {
    const query = el && !el.value ? el.shadowRoot?.querySelector("input")?.value ?? "" : "";
    const next = document.createElement("church-lookup");
    for (const [k, v] of attrs()) next.setAttribute(k, v);
    next.setAttribute("contribute", "off");
    next.addEventListener("church-results", (e) => note("church-results", `${e.detail.results.length} for \u201c${e.detail.query}\u201d${e.detail.settled ? " \u00b7 settled" : ""}`));
    next.addEventListener("church-select", (e) => note("church-select", `${e.detail.result.name} \u00b7 value ${e.detail.result.id}`));
    next.addEventListener("church-clear", () => note("church-clear", "value is now empty"));
    next.addEventListener("church-fill", (e) => e.preventDefault());
    host.replaceChildren(next);
    el = next;
    if (query) {
      const input = el.shadowRoot?.querySelector("input");
      if (input) { input.value = query; input.dispatchEvent(new Event("input")); }
    }
    code();
  }
  function code() {
    const esc = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const parts = attrs().map(([k, v]) => (v === "" ? `  <span class="a">${k}</span>` : `  <span class="a">${k}</span>=<span class="s">"${esc(v)}"</span>`));
    $("#wo-code").innerHTML = `<span class="t">&lt;church-lookup</span>\n${parts.join("\n")}<span class="t">&gt;&lt;/church-lookup&gt;</span>`;
  }
  let typing;
  $$("#wo-opts input[data-opt]").forEach((i) => i.addEventListener("input", () => {
    state[i.dataset.opt] = i.type === "range" ? Number(i.value) : i.value.trim();
    if (i.type === "range") $("#wo-limit").textContent = i.value;
    clearTimeout(typing);
    typing = setTimeout(build, i.type === "range" ? 120 : 300);
  }));
  const pick = (attr, key) => $$(`#wo-opts [data-${attr}]`).forEach((b) => b.addEventListener("click", () => {
    state[key] = b.dataset[attr];
    for (const o of $$(`#wo-opts [data-${attr}]`)) o.setAttribute("aria-pressed", String(o === b));
    build();
  }));
  pick("lang", "lang");
  pick("near", "near");
  $$("#wo-opts [data-flag]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.flag;
    state[k] = !state[k];
    b.setAttribute("aria-pressed", String(state[k]));
    const on = state[k] ? k : ["value", "required", "icons", "geo"].find((f) => state[f]);
    if (on) $("#wo-hint").textContent = HINTS[on];
    else $("#wo-hint").innerHTML = hint0;
    build();
  }));
  build();
})();
