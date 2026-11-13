// Lookup site behavior: the header globe and record card, nav and theme, copy buttons, tabs,
// the section index, and the API playground. No dependencies.
import { createGlobe } from "/globe.js";
import { createSky } from "/sky.js";
import { createAurora } from "/aurora.js";
import "/common.js";

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
    startDemo();
    // The closing call to action has its own globe rising from the bottom, aimed so Europe sits in the visible band.
    const ctaGlobe = $("#cta-globe");
    if (ctaGlobe) createGlobe(ctaGlobe, data, { lat: -18, lng: -10, scale: 1.8, top: 180 }); })
  .catch((err) => { console.error(err); $(".horizon").hidden = true; });

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
  // The church card always keeps clear space below the search box (past its glow ring).
  const minY = hero.getBoundingClientRect().bottom - tagLayer.getBoundingClientRect().top + 30;
  tags.forEach((t, i) => {
    const p = screen(t.lat, t.lng);
    const on = p.visible && p.y > 24 && p.y < h - 8;
    const [w, ht] = sizes[i];
    t.el.style.opacity = on ? "1" : "0";
    // The church card sits beside its pin (right, or left near the edge) so it never covers the
    // search above. Where neither side fits, as on phones, it sits above the pin.
    if (t.big) {
      // Narrow layers (too narrow for a full-width card beside the pin): always below the pin, so
      // the card never jumps between placements as its details load.
      if (W < 2 * (290 + 30)) {
        const x = Math.min(Math.max(p.x, w / 2 + 8), W - w / 2 - 8);
        t.el.style.setProperty("--stem", `${p.x - x}px`);
        t.el.dataset.side = "bottom";
        t.el.style.transform = `translate(${x}px, ${Math.max(p.y + 18, minY)}px) translate(-50%, 0)`;
        return;
      }
      // Wider: pick a side once per church and keep it, sliding to stay on screen.
      if (!t.side && p.visible) t.side = p.x + 22 + w <= W - 8 ? "right" : "left";
      const side = t.side ?? "right";
      const x = Math.min(Math.max(side === "right" ? p.x + 22 : p.x - 22 - w, 8), W - w - 8);
      const y = Math.max(p.y - ht / 2, 8, minY);
      t.el.dataset.side = side;
      t.el.style.setProperty("--stem-y", `${Math.min(Math.max(p.y - y, 12), ht - 12)}px`);
      t.el.style.transform = `translate(${x}px, ${y}px)`;
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
  // The search above is a form field: its name="church" submits the chosen church's ID with this form.
  const id = new FormData(card).get("church");
  b.textContent = id ? `Saved church ${id}` : "Saved (demo)";
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

// A dark glass nav while scrolling inside the header, so links never sit on top of content.
const markScrolled = () => nav.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", markScrolled, { passive: true });
markScrolled();

// ── A second horizon across the top of the hero, at the globe's own radius ──
// The circle matches globe.js (R = 0.66 × the canvas width, at most 1300), its crest just under the nav.
(function horizonArc() {
  const hdr = $("#top"), globeEl = $("#globe");
  if (!hdr) return;
  const NS = "http://www.w3.org/2000/svg";
  const sky = document.createElementNS(NS, "svg");
  sky.setAttribute("class", "hdr-sky");
  sky.setAttribute("aria-hidden", "true");
  sky.innerHTML = '<path class="hdr-glow"/><path class="hdr-rim"/>';
  hdr.querySelector(".hero").before(sky);
  const f = (n) => n.toFixed(1);
  const draw = () => {
    const W = hdr.clientWidth, H = hdr.clientHeight;
    const R = Math.min((globeEl?.clientWidth || W) * 0.66, 1300);
    const crest = nav.offsetHeight - (hdr.offsetTop + hdr.clientTop) + 6;
    const cx = W / 2, cy = crest + R;
    const y = (x) => cy - Math.sqrt(Math.max(R * R - (x - cx) ** 2, 0));
    const arc = `M0 ${f(y(0))}A${f(R)} ${f(R)} 0 0 1 ${W} ${f(y(W))}`;
    for (const p of sky.children) p.setAttribute("d", arc);
    sky.setAttribute("viewBox", `0 0 ${W} ${H}`);
  };
  draw();
  new ResizeObserver(draw).observe(hdr);
})();

// ── The notch: cut out of the dark band's top edge (not painted on), so whatever is beneath shows through ──
(function notch() {
  const band = $(".cta");
  if (!band) return;
  const cut = () => {
    const W = band.clientWidth, r = W <= 640 ? 12 : 18, H = 2 * r;
    const T = Math.min(1120, W - 32), L = (W - T) / 2, R = L + T;
    // The band's opaque top strip: rounded where it meets the tab, scooped where the tab's corners curve in.
    const d = `M0 0H${L - r}A${r} ${r} 0 0 1 ${L} ${r}A${r} ${r} 0 0 0 ${L + r} ${H}H${R - r}A${r} ${r} 0 0 0 ${R} ${r}A${r} ${r} 0 0 1 ${R + r} 0H${W}V${H}H0Z`;
    const svg = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><path d='${d}'/></svg>`)}")`;
    const mask = `${svg} 0 0 / ${W}px ${H}px no-repeat, linear-gradient(#000, #000) 0 ${H}px / 100% calc(100% - ${H}px) no-repeat`;
    band.style.webkitMask = mask;
    band.style.mask = mask;
  };
  new ResizeObserver(cut).observe(band);
  cut();
})();

// ── The light page pins once its end is in view, and the dark get-started band slides up over it ──
(function slideOver() {
  const page = $("#main"), band = $(".cta");
  if (!page || !band) return;
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Sticky with a negative top: the page stops moving when its bottom edge reaches the bottom of the window.
  const pin = () => { page.style.top = `${Math.min(0, innerHeight - page.offsetHeight)}px`; };
  let queued = false;
  const recede = () => {
    queued = false;
    // How far the band has climbed over the pinned page, 0 to 1.
    const k = Math.min(1, Math.max(0, (innerHeight - band.getBoundingClientRect().top) / innerHeight));
    page.style.transform = still() || !k ? "" : `scale(${1 - 0.04 * k})`;
    page.style.opacity = still() || !k ? "" : String(1 - 0.5 * k);
  };
  new ResizeObserver(() => { pin(); recede(); }).observe(page);
  addEventListener("resize", pin);
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(recede); } }, { passive: true });
  pin(); recede();
})();

// ── Examples: each app opens full screen in a window frame. Deep links: /#example/<name> ──
(function examples() {
  const dlg = $("#exm");
  if (!dlg) return;
  const LIST = [
    { key: "kinship", name: "Kinship", kind: "Church management · React", addr: "app.kinship.church/churches/new",
      // The same app built two ways: the drop-in element, and the shadcn/ui registry component.
      versions: [
        { key: "element", label: "Web component", src: "/demo/kinship?embed=1", open: "/demo/kinship" },
        { key: "shadcn", label: "shadcn/ui", src: "/demo/shadcn/?embed=1", open: "/demo/shadcn/" },
      ] },
    { key: "harvest", name: "Harvest", kind: "Food pantry network · plain HTML form", addr: "partners.harvestpantries.org/join" },
    { key: "steeple", name: "Steeple", kind: "Church website builder · live preview", addr: "build.steeple.site/setup" },
  ];
  const frame = $("#exm-frame");
  // Load without adding history entries, so Back closes the modal instead of stepping through the frame.
  const load = (url) => { try { frame.contentWindow.location.replace(url); } catch { frame.src = url; } };
  let at = 0, opener = null, pushed = false, version = "";
  const ver = $("#exm-ver");
  function show(i, v = "") {
    at = (i + LIST.length) % LIST.length;
    const ex = LIST[at];
    const vs = ex.versions ?? [];
    const pick = vs.find((x) => x.key === v) ?? vs[0];
    version = pick && pick !== vs[0] ? pick.key : "";
    ver.hidden = !vs.length;
    ver.replaceChildren(...vs.map((x) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = x.label;
      b.setAttribute("aria-pressed", String(x === pick));
      b.addEventListener("click", () => show(at, x.key));
      return b;
    }));
    $("#exm-name").textContent = ex.name;
    $("#exm-kind").textContent = ex.kind;
    $("#exm-addr").textContent = ex.addr;
    $("#exm-count").textContent = `${at + 1} of ${LIST.length}`;
    $("#exm-open").href = pick?.open ?? `/demo/${ex.key}`;
    // The same app icon the card shows.
    $("#exm-logo").innerHTML = $(`.ex-card[data-ex="${ex.key}"] .ex-icon`)?.innerHTML ?? "";
    frame.title = `${ex.name} example app`;
    load(pick?.src ?? `/demo/${ex.key}?embed=1`);
    const hash = `#example/${ex.key}${version ? `/${version}` : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  function open(key, from, v = "") {
    const i = LIST.findIndex((e) => e.key === key);
    if (i < 0) return;
    opener = from ?? document.activeElement;
    if (!dlg.open) {
      if (!location.hash.startsWith("#example/")) { history.pushState(null, "", `#example/${key}`); pushed = true; }
      dlg.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    show(i, v);
  }
  function close() { if (dlg.open) dlg.close(); }
  dlg.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
    if (location.hash.startsWith("#example/")) {
      if (pushed) history.back();
      else history.replaceState(null, "", "#examples");
    }
    pushed = false;
    opener?.focus?.();
  });
  $$(".ex-card").forEach((b) => b.addEventListener("click", () => open(b.dataset.ex, b)));
  $("#exm-prev").addEventListener("click", () => show(at - 1));
  $("#exm-next").addEventListener("click", () => show(at + 1));
  $("#exm-close").addEventListener("click", close);
  // A click on the dimmed page around the window closes it, like any modal.
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  addEventListener("popstate", () => {
    const m = location.hash.match(/^#example\/([a-z]+)(?:\/([a-z]+))?$/);
    if (dlg.open && !m) { pushed = false; close(); }
    else if (!dlg.open && m) open(m[1], $(`.ex-card[data-ex="${m[1]}"]`), m[2]);
  });
  const deep = location.hash.match(/^#example\/([a-z]+)(?:\/([a-z]+))?$/);
  if (deep) open(deep[1], $(`.ex-card[data-ex="${deep[1]}"]`), deep[2]);
})();

// ── The video: the hero's thumbnail opens a lightbox with the same Plyr player and settings as harvous.com.
// Plyr (self-hosted in /vendor/plyr) loads on first open, so a visit that never plays never downloads it. ──
(function videoLightbox() {
  const trigger = $("#video-open"), lb = $("#video-lb"), video = $("#video-video");
  if (!trigger || !lb || !video) return;
  const closeBtn = $(".video-lb-close", lb);
  // Harvous's src/lib/plyr-options.ts.
  const OPTIONS = {
    controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "settings", "fullscreen"],
    settings: ["speed"],
    speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 2] },
    hideControls: true,
    keyboard: { focused: true, global: false },
    tooltips: { controls: true, seek: true },
    iconUrl: "/vendor/plyr/plyr.svg",
    blankVideo: "",
  };
  let player = null, loading = null, previousFocus = null;

  const loadPlyr = () => loading ??= (() => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "/vendor/plyr/plyr.css";
    document.head.append(css);
    return import("/vendor/plyr/plyr.min.mjs").then((m) => m.default);
  })();

  const focusables = () => [...lb.querySelectorAll('button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.offsetParent !== null);

  async function open() {
    previousFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
    try {
      const Plyr = await loadPlyr();
      player ??= new Plyr(video, OPTIONS);
    } catch { video.controls = true; }
    // Plyr only returns a promise once it's ready; before that it queues the play.
    const played = player ? player.play() : video.play();
    if (played && typeof played.catch === "function") played.catch(() => {});
  }

  function close() {
    lb.hidden = true;
    document.body.style.overflow = "";
    if (player) player.pause(); else video.pause();
    previousFocus?.focus?.();
    previousFocus = null;
  }

  trigger.addEventListener("click", open);
  $$("[data-video-close]", lb).forEach((el) => el.addEventListener("click", close));
  lb.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = focusables();
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
})();
