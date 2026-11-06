// Lookup site behavior: the header globe and record card, nav and theme, copy buttons, tabs,
// the section index, and the API playground. No dependencies.
import { createGlobe } from "/globe.js";
import { createSky } from "/sky.js";
import { createAurora } from "/aurora.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ── Header: the particle globe, the search, and the record card that fills in ──
const hero = $("#hero-search");
const card = $("#result-form");
const small = () => matchMedia("(max-width: 720px)").matches;
let globe = null;

fetch("/data/globe.json")
  .then((r) => r.json())
  // A pick is aimed south of the church, so its pin rises into the visible top of the globe.
  .then((data) => { globe = createGlobe($("#globe"), data, { lat: -16, lng: -60, onFrame: placeTags,
    // Degrees to tilt a picked church up from the view's center so its pin lands in the band of
    // globe still visible above the form stack.
    get pinOffset() {
      const W = $("#globe").clientWidth, R = Math.min(W * 0.66, 1300);
      return Math.asin(Math.min(1, Math.max(-1, 1 - ((small() ? 156 : 124) - 36) / R))) * 180 / Math.PI;
    } });
    startSky();
    startDemo(); })
  .catch(() => { $(".horizon").hidden = true; });

fetch("/v1/meta")
  .then((r) => r.json())
  .then((m) => {
    if (m.counts?.churches) $$("[data-stat=churches]").forEach((e) => (e.textContent = m.counts.churches.toLocaleString("en-US")));
    if (m.counts?.countries) $$("[data-stat=countries]").forEach((e) => (e.textContent = m.counts.countries));
  })
  .catch(() => {});

// Labels pinned to churches on the globe. They follow it every frame and hide on the far side.
const tagLayer = $("#tags");
const hud = $("#hud-q");
let tags = [];
function showTags(list) {
  tagLayer.replaceChildren();
  tags = list.map((t) => {
    const el = document.createElement("div");
    el.className = t.big ? "tag big" : "tag";
    if (t.big) el.append(...churchCard(t));
    else el.textContent = t.text;
    tagLayer.append(el);
    return { ...t, el };
  });
  if (globe) placeTags(globe.screen);
}
function placeTags(screen) {
  const h = tagLayer.clientHeight, W = tagLayer.clientWidth;
  const sizes = tags.map((t) => [t.el.offsetWidth, t.el.offsetHeight]);
  // The church card always keeps clear space below the search box.
  const minY = hero.getBoundingClientRect().bottom - tagLayer.getBoundingClientRect().top + 16;
  tags.forEach((t, i) => {
    const p = screen(t.lat, t.lng);
    const on = p.visible && p.y > 24 && p.y < h - 8;
    const [w, ht] = sizes[i];
    t.el.style.opacity = on ? "1" : "0";
    // The church card sits beside its pin (right, or left near the edge) so it never covers the
    // search above. Where neither side fits, as on phones, it sits above the pin.
    if (t.big) {
      const side = p.x + 22 + w <= W - 8 ? "right" : p.x - 22 - w >= 8 ? "left" : "";
      if (side) {
        const x = side === "right" ? p.x + 22 : p.x - 22 - w;
        const y = Math.max(p.y - ht / 2, 8, minY);
        t.el.dataset.side = side;
        t.el.style.setProperty("--stem-y", `${Math.min(Math.max(p.y - y, 12), ht - 12)}px`);
        t.el.style.transform = `translate(${x}px, ${y}px)`;
        return;
      }
      const x = Math.min(Math.max(p.x, w / 2 + 8), W - w / 2 - 8);
      t.el.style.setProperty("--stem", `${p.x - x}px`);
      // Above the pin if there's room under the search; otherwise below it.
      if (p.y - 18 - ht >= minY) {
        t.el.dataset.side = "top";
        t.el.style.transform = `translate(${x}px, ${p.y}px) translate(-50%, calc(-100% - 18px))`;
      } else {
        t.el.dataset.side = "bottom";
        t.el.style.transform = `translate(${x}px, ${p.y + 18}px) translate(-50%, 0)`;
      }
      return;
    }
    // Keep the label inside the globe's width; its stem still points at the pin.
    const x = Math.min(Math.max(p.x, w / 2 + 8), W - w / 2 - 8);
    t.el.style.transform = `translate(${x}px, ${p.y}px) translate(-50%, calc(-100% - ${t.big ? 18 : 12}px))`;
    t.el.style.setProperty("--stem", `${p.x - x}px`);
  });
}

hero.addEventListener("church-results", (e) => {
  const { query, results } = e.detail;
  globe?.setPins(results.map((r) => ({ lat: r.latitude, lng: r.longitude })));
  showTags(results.slice(0, 4).map((r) => ({ lat: r.latitude, lng: r.longitude, text: r.name })));
  hud.textContent = `"${query}" → ${results.length} ${results.length === 1 ? "church" : "churches"}`;
  logEvent("church-results", `${results.length} for "${query}"`, true);
});
hero.addEventListener("church-select", (e) => beginPick(e.detail.result));
hero.addEventListener("church-fill", (e) => showFill(e.detail.changes, false, e.detail.record));

function beginPick(r, quiet = false) {
  globe?.setPins([]);
  globe?.select({ lat: r.latitude, lng: r.longitude });
  if (!quiet) logEvent("church-select", r.name);
  $$("input", card).forEach((i) => { i.value = ""; i.placeholder = "…"; i.classList.toggle("on", false); });
  $$(".ly-row", card).forEach((row) => { row.classList.remove("on", "off"); $("b", row).textContent = "·"; });
  status.classList.toggle("done", false);
  status.textContent = `Looking up ${r.name}…`;
  showTags([{ lat: r.latitude, lng: r.longitude, text: r.name, sub: r.locationLabel, big: true }]);
  hud.textContent = "";
}
function showFill(changes, quiet = false, record = null) {
  if (record) enrichCard(record);
  const filled = new Set(changes.map((c) => c.field));
  const total = $$("input", card).length;
  requestAnimationFrame(() => {
    $$("input", card).forEach((i) => {
      const on = filled.has(i.dataset.hmcField);
      if (!on) { i.value = ""; i.placeholder = "Not listed yet"; }
      i.classList.toggle("on", on);
    });
    $$(".ly-row", card).forEach((row) => {
      const on = filled.has(row.dataset.for);
      row.classList.add(on ? "on" : "off");
      $("b", row).textContent = on ? "✓" : "–";
    });
    status.classList.add("done");
    status.textContent = `Autofilled ${changes.length} of ${total} fields from Here's My Church`;
    if (!quiet) logEvent("church-fill", `${changes.length} fields`);
    if (!quiet) logEvent("input/change", `fired on ${changes.length} fields`);
  });
}

// ── The sky: stars and constellations that turn with the globe, and the odd shooting star ──
function startSky() {
  const hdr = $(".hdr");
  const opts = {
    view: () => globe.view(),
    horizon: () => $(".horizon").getBoundingClientRect().top - hdr.getBoundingClientRect().top,
  };
  const aurora = createAurora($("#aurora"), opts);
  const sky = createSky($("#sky"), opts);
  let inView = true;
  const sync = () => { const on = inView && !document.hidden; aurora.setRunning(on); sky.setRunning(on); };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(hdr);
  document.addEventListener("visibilitychange", sync);
  sync();
}

// ── Idle demo: while nobody is searching, real churches light up on the globe and flow through
// the tagged fields into the app. Any use of the search box ends it for good. ──
const DEMO_QUERIES = ["grace community", "first baptist", "st mary", "trinity", "calvary chapel", "kosciol", "saint paul", "eglise", "methodist", "lutheran", "presbyterian", "catholic"];
let demoOn = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let demoTimer = 0, demoSeen = false, demoPool = [], demoAt = 0;
let demoPending = false;
function stopDemo() {
  if (!demoOn) return;
  demoOn = false;
  clearTimeout(demoTimer);
  // A demo pick caught mid-flight would leave the form stuck on "Looking up…": reset it.
  if (demoPending) {
    demoPending = false;
    $$("input", card).forEach((i) => { i.value = ""; i.placeholder = "—"; i.classList.remove("on"); });
    $$(".ly-row", card).forEach((row) => { row.classList.remove("on", "off"); $("b", row).textContent = "·"; });
    status.classList.remove("done");
    status.textContent = "Pick a church above and Lookup fills this in.";
    showTags([]);
  }
}
hero.addEventListener("focusin", stopDemo);
hero.addEventListener("church-results", stopDemo);
new IntersectionObserver(([e]) => { demoSeen = e.isIntersecting; }).observe(card);
function fieldText(rec, f) {
  const v = rec.fields?.[f];
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "object") return v.raw ?? null;
  return String(v);
}
async function startDemo() {
  if (!demoOn) return;
  const lists = await Promise.all(DEMO_QUERIES.map((q) =>
    fetch(`/v1/search?q=${encodeURIComponent(q)}&geo=off&limit=6`).then((r) => r.json()).then((j) => j.results ?? []).catch(() => [])));
  const seen = new Set();
  demoPool = lists.flat().filter((r) => r.latitude != null && !seen.has(r.id) && seen.add(r.id));
  for (let i = demoPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [demoPool[i], demoPool[j]] = [demoPool[j], demoPool[i]];
  }
  if (demoOn && demoPool.length) demoTimer = setTimeout(demoTick, 1200);
}
async function demoTick() {
  if (!demoOn) return;
  if (!demoSeen || document.hidden) { demoTimer = setTimeout(demoTick, 1000); return; }
  const hit = await nextReviewed();
  if (!demoOn) return;
  if (!hit) { demoTimer = setTimeout(demoTick, 3000); return; }
  const { r, rec } = hit;
  beginPick(r, true);
  demoPending = true;
  await new Promise((ok) => setTimeout(ok, 1300));
  if (!demoOn) return;
  {
    const changes = [];
    for (const i of $$("input[data-hmc-field]", card)) {
      const v = fieldText(rec, i.dataset.hmcField);
      i.value = v ?? "";
      if (v != null) changes.push({ field: i.dataset.hmcField, element: i, value: v });
    }
    demoPending = false;
    showFill(changes, true, rec);
  }
  demoTimer = setTimeout(demoTick, 5200);
}
// The demo only shows reviewed churches: verified by a person on Here's My Church, or meeting its
// verified-listing bar (a street address, a website and service times).
function isReviewed(rec) {
  const f = rec?.fields;
  if (!f) return false;
  return Boolean(rec.freshness?.lastVerified) || Boolean(f.street && f.city && f.website && f.serviceTimes?.raw);
}
async function nextReviewed() {
  for (let tries = 0; tries < 10 && demoOn; tries++) {
    const r = demoPool[demoAt++ % demoPool.length];
    if (r.skip) continue;
    try {
      const rec = await fetch(`/v1/churches/${encodeURIComponent(r.id)}`).then((x) => x.json());
      if (isReviewed(rec)) return { r, rec };
    } catch { /* try the next one */ }
    r.skip = true;
  }
  return null;
}

// ── The church card on the globe ──
const CHURCH_ICON = '<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5v3M6.5 3h3M3.5 14V8L8 5l4.5 3v6M6.5 14v-3a1.5 1.5 0 0 1 3 0v3M2 14h12"/></svg>';
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function churchCard(t) {
  const top = document.createElement("div");
  top.className = "cc-top";
  const ic = document.createElement("span");
  ic.className = "cc-ic";
  ic.innerHTML = CHURCH_ICON;
  const txt = document.createElement("div");
  txt.className = "cc-t";
  const b = document.createElement("b");
  b.textContent = t.text;
  const sub = document.createElement("small");
  sub.textContent = t.sub ?? "";
  txt.append(b, sub);
  top.append(ic, txt);
  const meta = document.createElement("div");
  meta.className = "cc-meta";
  return [top, meta];
}
function chip(text, cls = "") {
  const c = document.createElement("span");
  c.className = `cc-chip ${cls}`.trim();
  c.textContent = text;
  return c;
}
function enrichCard(rec) {
  const meta = $(".tag.big .cc-meta", tagLayer);
  if (!meta) return;
  const f = rec.fields ?? {};
  const chips = [];
  if (rec.freshness?.lastVerified) chips.push(chip("✓ verified", "ok"));
  else if (isReviewed(rec)) chips.push(chip("✓ reviewed", "ok"));
  if (f.denomination && !/^unknown$/i.test(f.denomination)) chips.push(chip(f.denomination));
  const slots = f.serviceTimes?.slots ?? [];
  if (slots.length) {
    const s = slots[0];
    const [h, m] = String(s.startTime).split(":").map(Number);
    const time = `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
    chips.push(chip(`${DAYS[s.dayOfWeek] ?? ""} ${time}${slots.length > 1 ? ` +${slots.length - 1}` : ""}`.trim()));
  }
  if (f.website) {
    try { chips.push(chip(new URL(f.website).hostname.replace(/^www\./, ""), "site")); } catch { /* not a URL */ }
  }
  meta.replaceChildren(...chips);
  if (globe) placeTags(globe.screen);
}

// ── The form stack: tagged fields behind, your app on top ──
// Each data-hmc-field row on the back layer lines up with its field in the app window.
const status = $("#result-foot");
const back = $(".ly-back", card);
function alignLayers() {
  if (getComputedStyle($(".ly-col", card)).display === "none") return;
  const top = back.getBoundingClientRect().top;
  let first = Infinity;
  for (const row of $$(".ly-row", card)) {
    const r = $(`[data-hmc-field="${row.dataset.for}"]`, card).getBoundingClientRect();
    const y = r.top + r.height / 2 - top;
    row.style.top = `${y}px`;
    first = Math.min(first, y);
  }
  $(".ly-colhead", card).style.top = `${first - 34}px`;
}
new ResizeObserver(alignLayers).observe(card);
document.fonts?.ready.then(alignLayers);

$$(".looks button", card).forEach((b) => b.addEventListener("click", () => {
  card.dataset.look = b.dataset.look;
  $$(".looks button", card).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
}));
$("#sc-save").addEventListener("click", (e) => {
  const b = e.currentTarget;
  b.textContent = "Saved (demo)";
  setTimeout(() => { b.textContent = "Save church"; }, 1800);
});

const log = $("#sc-log");
function logEvent(name, text, replace = false) {
  $(".idle", log)?.remove();
  const last = log.lastElementChild;
  if (replace && last?.dataset.name === name) last.remove();
  const li = document.createElement("li");
  li.className = "new";
  li.dataset.name = name;
  const b = document.createElement("b");
  b.textContent = name;
  const t = document.createElement("span");
  t.textContent = text;
  li.append(b, t);
  log.append(li);
  while (log.children.length > 4) log.firstElementChild.remove();
}

// ── Theming example: size the frame to its content so it never scrolls on its own ──
const demoFrame = $("#theming iframe");
function fitFrame() {
  try {
    const doc = demoFrame.contentDocument;
    if (!doc?.body) return;
    const bottom = Math.max(0, ...[...doc.body.children].map((el) => el.getBoundingClientRect().bottom));
    const pad = parseFloat(getComputedStyle(doc.body).paddingBottom) || 0;
    if (bottom) demoFrame.style.height = `${Math.ceil(bottom + pad)}px`;
  } catch { /* cross-origin or not ready: keep the CSS height */ }
}
demoFrame?.addEventListener("load", () => {
  fitFrame();
  try {
    const ro = new ResizeObserver(fitFrame);
    for (const el of demoFrame.contentDocument.body.children) ro.observe(el);
  } catch { /* keep the CSS height */ }
});
if (demoFrame?.contentDocument?.readyState === "complete") fitFrame();

// ── Thanks: if an avatar can't load, show initials instead of a broken image ──
for (const img of $$(".thanks img")) {
  const swap = () => {
    const tile = document.createElement("span");
    tile.className = "th-ic th-initials";
    tile.textContent = "CP";
    img.replaceWith(tile);
  };
  if (img.complete && !img.naturalWidth) swap();
  else img.addEventListener("error", swap, { once: true });
}

// ── GitHub stars on the repo buttons, shown once a repo has some ──
async function repoStars(repo) {
  const key = `lookup-stars:${repo}`;
  try { const hit = sessionStorage.getItem(key); if (hit != null) return JSON.parse(hit); } catch { /* storage off */ }
  let n = null;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`);
    if (r.ok) n = (await r.json()).stargazers_count ?? null;
  } catch { /* offline or rate limited */ }
  try { sessionStorage.setItem(key, JSON.stringify(n)); } catch { /* storage off */ }
  return n;
}
for (const repo of new Set($$("[data-stars-for]").map((el) => el.dataset.starsFor))) {
  repoStars(repo).then((n) => {
    if (typeof n !== "number" || n < 1) return;
    for (const el of $$(`[data-stars-for="${repo}"]`)) {
      $("span", el).textContent = n.toLocaleString("en-US");
      el.hidden = false;
      const label = el.parentElement.querySelector(":scope > span")?.textContent.replace(/\s+/g, " ").trim();
      el.parentElement.setAttribute("aria-label", `${label}, ${n} ${n === 1 ? "star" : "stars"}`);
    }
  });
}

// ── Nav: dark over the header, solid once the docs scroll in ──
const nav = $("#nav");

// ── Docs theme: light by default, dark on request, remembered ──
const themeBtn = $("#theme");
const setTheme = (dark) => {
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  themeBtn.setAttribute("aria-pressed", String(dark));
  try { localStorage.setItem("lookup-docs-theme", dark ? "dark" : "light"); } catch {}
};
themeBtn.setAttribute("aria-pressed", String(document.documentElement.dataset.theme === "dark"));
themeBtn.addEventListener("click", () => setTheme(document.documentElement.dataset.theme !== "dark"));

// ── The search's placeholder types out example searches, one after another ──
const EXAMPLES = ["grace comm", "church in dallas", "kosciol", "first baptist, TX", "gracee", "st mary"];
(function rotatePlaceholder() {
  const input = hero.shadowRoot?.querySelector("input");
  if (!input) { requestAnimationFrame(rotatePlaceholder); return; }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let n = 0, len = 0, deleting = false;
  const step = () => {
    const word = EXAMPLES[n % EXAMPLES.length];
    // Nothing to animate while the placeholder is hidden behind typed text.
    if (input.value) { setTimeout(step, 600); return; }
    if (!deleting && len < word.length) len++;
    else if (!deleting) { deleting = true; setTimeout(step, 1800); return; }
    else if (len > 0) len--;
    else { deleting = false; n++; setTimeout(step, 350); return; }
    input.placeholder = `Try \u201C${word.slice(0, len)}\u201D`;
    setTimeout(step, deleting ? 28 : 70);
  };
  setTimeout(step, 900);
})();

// ── Theming: a before/after slider with a small token playground ──
(function themingPlayground() {
  const ba = $("#ba");
  if (!ba) return;
  const after = $("#ba-after church-lookup");
  const layer = $("#ba-after");
  const PRESETS = {
    hmc: { accent: "#8B5CF6", radius: 14, font: '"Google Sans Flex", ui-sans-serif, sans-serif', mode: "dark" },
    sensible: { accent: "#171717", radius: 4, font: "ui-sans-serif, system-ui, sans-serif", mode: "light" },
    parish: { accent: "#9A3412", radius: 2, font: "Georgia, 'Times New Roman', serif", mode: "light" },
  };
  const state = { ...PRESETS.hmc, icons: "builtin" };
  // Icons from two kinds of library: Lucide as inline SVG, Tabler as an icon font loaded on first use.
  const lucide = (paths) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ICONS = {
    lucide: {
      search: lucide('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
      result: lucide('<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="M18 22V5.6a1 1 0 0 0-.55-.9l-4.56-2.27a2 2 0 0 0-1.78 0L6.55 4.7A1 1 0 0 0 6 5.6V22"/><path d="m18 7 3.45 1.72a1 1 0 0 1 .55.9V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9.38a1 1 0 0 1 .55-.9L6 7"/>'),
    },
    tabler: {
      search: '<i class="ti ti-search"></i>',
      result: '<i class="ti ti-building-church"></i>',
      markup: ['<i slot="search-icon" class="ti ti-search"></i>', '<i slot="result-icon" class="ti ti-building-church"></i>'],
    },
  };
  ICONS.lucide.markup = [ICONS.lucide.search.replace("<svg ", '<svg slot="search-icon" '), ICONS.lucide.result.replace("<svg ", '<svg slot="result-icon" ')];
  function loadTabler() {
    if (document.getElementById("tabler-css")) return;
    const l = document.createElement("link");
    l.id = "tabler-css";
    l.rel = "stylesheet";
    l.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css";
    document.head.append(l);
  }
  function applyIcons() {
    for (const el of [...after.children]) if (el.slot === "search-icon" || el.slot === "result-icon") el.remove();
    const set = ICONS[state.icons];
    if (set) {
      if (state.icons === "tabler") loadTabler();
      for (const [slot, html] of [["search-icon", set.search], ["result-icon", set.result]]) {
        const t = document.createElement("template");
        t.innerHTML = html.trim();
        const node = t.content.firstElementChild;
        node.setAttribute("slot", slot);
        after.append(node);
      }
    }
    // Re-run the search so the open results pick up the new icon.
    const input = after.shadowRoot?.querySelector("input");
    if (input?.value) input.dispatchEvent(new Event("input"));
  }
  const mix = (c, p, base) => `color-mix(in oklab, ${c} ${p}%, ${base})`;
  function tokens() {
    const { accent: a, radius: r, mode } = state;
    const dark = mode === "dark";
    return dark ? {
      "--hmc-bg": mix(a, 12, "#110C20"), "--hmc-popover": mix(a, 14, "#140E26"), "--hmc-text": "#FFFFFF", "--hmc-popover-text": "#FFFFFF",
      "--hmc-muted": "#B8B2CC", "--hmc-border": mix(a, 28, "#2A2340"), "--hmc-input-border": mix(a, 45, "#2A2340"),
      "--hmc-accent": mix(a, 55, "white"), "--hmc-active-bg": mix(a, 32, "transparent"), "--hmc-active-text": "#FFFFFF", "--hmc-radius": `${r}px`,
    } : {
      "--hmc-bg": "#FFFFFF", "--hmc-popover": "#FFFFFF", "--hmc-text": "#18181B", "--hmc-popover-text": "#18181B",
      "--hmc-muted": "#52525B", "--hmc-border": mix(a, 20, "#E4E4E7"), "--hmc-input-border": mix(a, 45, "#D4D4D8"),
      "--hmc-accent": a, "--hmc-active-bg": mix(a, 12, "white"), "--hmc-active-text": "#18181B", "--hmc-radius": `${r}px`,
    };
  }
  function render() {
    const t = tokens();
    for (const [k, v] of Object.entries(t)) after.style.setProperty(k, v);
    after.style.fontFamily = state.font;
    after.style.colorScheme = state.mode;
    layer.dataset.mode = state.mode;
    layer.style.setProperty("--ba-bg", state.mode === "dark" ? mix(state.accent, 16, "#0B0814") : mix(state.accent, 7, "white"));
    $("#ba-r").value = String(state.radius);
    $("#ba-r-out").textContent = `${state.radius}px`;
    $("#ba-font").value = state.font;
    $("#ba-color").value = /^#[0-9a-f]{6}$/i.test(state.accent) ? state.accent : "#8B5CF6";
    for (const b of $$(".ba-sw")) b.setAttribute("aria-pressed", String(b.dataset.accent.toLowerCase() === state.accent.toLowerCase()));
    for (const b of $$("[data-mode]", ba.parentElement)) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
    for (const b of $$("[data-preset]")) {
      const p = PRESETS[b.dataset.preset];
      b.setAttribute("aria-pressed", String(Object.keys(p).every((k) => String(p[k]).toLowerCase() === String(state[k]).toLowerCase())));
    }
    for (const b of $$("[data-icons]")) b.setAttribute("aria-pressed", String(b.dataset.icons === state.icons));
    const lines = Object.entries(t).map(([k, v]) => `    ${k}: ${v};`);
    const kids = ICONS[state.icons]?.markup.map((m) => `  ${m}`).join("\n");
    $("#ba-css").textContent = `<style>\n  church-lookup {\n${lines.join("\n")}\n    font-family: ${state.font};\n  }\n</style>\n<church-lookup label="Your church">${kids ? `\n${kids}\n` : ""}</church-lookup>`;
  }
  $$("[data-preset]").forEach((b) => b.addEventListener("click", () => { Object.assign(state, PRESETS[b.dataset.preset]); render(); }));
  $$(".ba-sw").forEach((b) => b.addEventListener("click", () => { state.accent = b.dataset.accent; render(); }));
  $("#ba-color").addEventListener("input", (e) => { state.accent = e.target.value; render(); });
  $("#ba-r").addEventListener("input", (e) => { state.radius = Number(e.target.value); render(); });
  $("#ba-font").addEventListener("change", (e) => { state.font = e.target.value; render(); });
  $$("[data-mode]", ba.parentElement).forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; render(); }));
  $$("[data-icons]").forEach((b) => b.addEventListener("click", () => { state.icons = b.dataset.icons; applyIcons(); render(); }));
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
  const box = btn.closest(".code");
  const pre = $$("pre", box).find((p) => !p.hidden);
  try {
    await navigator.clipboard.writeText(pre.textContent);
    btn.textContent = "copied";
  } catch {
    btn.textContent = "select to copy";
  }
  setTimeout(() => (btn.textContent = "copy"), 1800);
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

// ── Scrollspy for the section index ──
const links = $$(".index a");
const sections = $$(".docs section[id]");
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    links.forEach((a) => {
      if (a.getAttribute("href") === `#${e.target.id}`) {
        a.setAttribute("aria-current", "true");
        // In the horizontal bar, keep the current section's link in view.
        const bar = a.parentElement;
        if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
      } else a.removeAttribute("aria-current");
    });
  }
}, { rootMargin: "-20% 0px -70% 0px" });
sections.forEach((s) => spy.observe(s));

// ── API playground ──
const form = $("#play-form");
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

// A dark glass nav while scrolling inside the header, so links never sit on top of content.
const markScrolled = () => nav.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", markScrolled, { passive: true });
markScrolled();
