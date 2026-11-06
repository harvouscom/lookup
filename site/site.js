// Lookup site behavior: the header globe and record card, nav and theme, copy buttons, tabs,
// the section index, and the API playground. No dependencies.
import { createGlobe } from "/globe.js";

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
  .then((data) => { globe = createGlobe($("#globe"), data, { lat: 10, lng: -45, pinOffset: small() ? 40 : 46, onFrame: placeTags }); })
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
    el.textContent = t.text;
    if (t.big) { const sub = document.createElement("small"); sub.textContent = t.sub ?? ""; el.append(sub); }
    tagLayer.append(el);
    return { ...t, el };
  });
  if (globe) placeTags(globe.screen);
}
function placeTags(screen) {
  const h = tagLayer.clientHeight;
  for (const t of tags) {
    const p = screen(t.lat, t.lng);
    const on = p.visible && p.y > 24 && p.y < h - 8;
    t.el.style.opacity = on ? "1" : "0";
    t.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, calc(-100% - ${t.big ? 18 : 12}px))`;
  }
}

hero.addEventListener("church-results", (e) => {
  const { query, results } = e.detail;
  globe?.setPins(results.map((r) => ({ lat: r.latitude, lng: r.longitude })));
  showTags(results.slice(0, 4).map((r) => ({ lat: r.latitude, lng: r.longitude, text: r.name })));
  hud.textContent = `"${query}" → ${results.length} ${results.length === 1 ? "church" : "churches"}`;
  logEvent("church-results", `${results.length} for "${query}"`, true);
});
hero.addEventListener("church-select", (e) => {
  const r = e.detail.result;
  globe?.setPins([]);
  globe?.select({ lat: r.latitude, lng: r.longitude });
  logEvent("church-select", r.name);
  $$("input", card).forEach((i) => { i.value = ""; i.placeholder = "…"; i.classList.toggle("on", false); });
  $$(".ly-row", card).forEach((row) => { row.classList.remove("on", "off"); $("b", row).textContent = "·"; });
  status.classList.toggle("done", false);
  status.textContent = `Looking up ${r.name}…`;
  showTags([{ lat: r.latitude, lng: r.longitude, text: r.name, sub: r.locationLabel, big: true }]);
  hud.textContent = `flying to ${r.city || r.nearestPlace || r.regionName}…`;
});
hero.addEventListener("church-fill", (e) => {
  const { changes } = e.detail;
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
    const big = $(".tag.big small", tagLayer);
    if (big) big.textContent = `${changes.length} fields filled`;
    hud.textContent = `filled ${changes.length} fields`;
    logEvent("church-fill", `${changes.length} fields`);
    logEvent("input/change", `fired on ${changes.length} fields`);
  });
});

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

// ── Nav: dark over the header, solid once the docs scroll in ──
const nav = $("#nav");
new IntersectionObserver(([e]) => nav.classList.toggle("solid", !e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" }).observe($(".hdr"));

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

$$("[data-try]").forEach((b) => b.addEventListener("click", () => {
  const input = hero.shadowRoot?.querySelector("input");
  if (!input) return;
  input.value = b.dataset.try;
  input.focus();
  input.dispatchEvent(new Event("input"));
}));

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
      if (a.getAttribute("href") === `#${e.target.id}`) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
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
