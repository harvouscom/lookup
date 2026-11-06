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

// ── Theming: a before/after slider with a small token playground ──
(function themingPlayground() {
  const ba = $("#ba");
  if (!ba) return;
  const after = $("#ba-after church-lookup");
  const layer = $("#ba-after");
  // Common design systems church apps are built on. Each one sets only the tokens the widget reads.
  const PRESETS = {
    hmc: { name: "Here's My Church", accent: "#8B5CF6", radius: 14, font: '"Google Sans Flex", ui-sans-serif, sans-serif', mode: "dark" },
    bootstrap: { name: "Bootstrap", accent: "#0D6EFD", radius: 6, font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', mode: "light", page: "#FFFFFF", border: "#DEE2E6", input: "#CED4DA", muted: "#6C757D", text: "#212529" },
    material: { name: "Material", accent: "#6750A4", radius: 4, font: 'Roboto, "Helvetica Neue", Arial, sans-serif', mode: "light", page: "#FEF7FF", popover: "#F3EDF7", border: "#CAC4D0", input: "#79747E", muted: "#49454F", text: "#1D1B20" },
    apple: { name: "Apple", accent: "#007AFF", radius: 10, font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif', mode: "light", page: "#F2F2F7", border: "#E5E5EA", input: "#D1D1D6", muted: "#6E6E73", text: "#1C1C1E" },
    tailwind: { name: "Tailwind", accent: "#4F46E5", radius: 6, font: 'Inter, ui-sans-serif, system-ui, sans-serif', mode: "light", page: "#F9FAFB", border: "#E5E7EB", input: "#D1D5DB", muted: "#6B7280", text: "#111827" },
  };
  let state = PRESETS.hmc;
  const mix = (c, p, base) => `color-mix(in oklab, ${c} ${p}%, ${base})`;
  function tokens() {
    const { accent: a, radius: r, mode } = state;
    if (mode === "dark") return {
      "--hmc-bg": mix(a, 12, "#110C20"), "--hmc-popover": mix(a, 14, "#140E26"), "--hmc-text": "#FFFFFF", "--hmc-popover-text": "#FFFFFF",
      "--hmc-muted": "#B8B2CC", "--hmc-border": mix(a, 28, "#2A2340"), "--hmc-input-border": mix(a, 45, "#2A2340"),
      "--hmc-accent": mix(a, 55, "white"), "--hmc-active-bg": mix(a, 32, "transparent"), "--hmc-active-text": "#FFFFFF", "--hmc-radius": `${r}px`,
    };
    return {
      "--hmc-bg": "#FFFFFF", "--hmc-popover": state.popover ?? "#FFFFFF", "--hmc-text": state.text, "--hmc-popover-text": state.text,
      "--hmc-muted": state.muted, "--hmc-border": state.border, "--hmc-input-border": state.input,
      "--hmc-accent": a, "--hmc-active-bg": mix(a, 12, "white"), "--hmc-active-text": state.text, "--hmc-radius": `${r}px`,
    };
  }
  function render() {
    const t = tokens();
    for (const [k, v] of Object.entries(t)) after.style.setProperty(k, v);
    after.style.fontFamily = state.font;
    after.style.colorScheme = state.mode;
    layer.dataset.mode = state.mode;
    layer.style.setProperty("--ba-bg", state.mode === "dark" ? mix(state.accent, 16, "#0B0814") : state.page);
    $("#ba-tag").textContent = state.name;
    for (const b of $$("[data-preset]")) b.setAttribute("aria-pressed", String(PRESETS[b.dataset.preset] === state));
    const lines = Object.entries(t).map(([k, v]) => `    ${k}: ${v};`);
    $("#ba-css").textContent = `<style>\n  church-lookup {\n${lines.join("\n")}\n    font-family: ${state.font};\n  }\n</style>\n<church-lookup label="Your church"></church-lookup>`;
  }
  $$("[data-preset]").forEach((b) => b.addEventListener("click", () => { state = PRESETS[b.dataset.preset]; render(); }));
  $("#ba-range").addEventListener("input", (e) => ba.style.setProperty("--pos", `${e.target.value}%`));
  render();
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
