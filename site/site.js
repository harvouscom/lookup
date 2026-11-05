// Lookup site behavior: the hero globe and card, copy buttons, tabs, table-of-contents scrollspy,
// and the API playground. No dependencies.
import { createGlobe } from "/globe.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ── Hero: the horizon globe, the search, and the app window that fills in ──
const hero = $("#hero-search");
const app = $("#app-form");
const status = $("#app-status");
const small = () => matchMedia("(max-width: 720px)").matches;
let globe = null;

fetch("/data/globe.json")
  .then((r) => r.json())
  // A pick is aimed south of the church, so its pin rises into the visible cap of the globe.
  .then((data) => { globe = createGlobe($("#globe"), data, { layout: "horizon", theme: "dark", lat: 8, lng: -42, pinOffset: small() ? 46 : 56 }); })
  .catch(() => { $(".horizon").hidden = true; });

fetch("/v1/meta")
  .then((r) => r.json())
  .then((m) => {
    if (m.counts?.churches) $("[data-stat=churches]").textContent = m.counts.churches.toLocaleString("en-US");
    if (m.counts?.countries) $("[data-stat=countries]").textContent = m.counts.countries;
  })
  .catch(() => {});

hero.addEventListener("church-results", (e) => {
  globe?.setPins(e.detail.results.map((r) => ({ lat: r.latitude, lng: r.longitude })));
});
hero.addEventListener("church-select", (e) => {
  const r = e.detail.result;
  globe?.setPins([]);
  globe?.select({ lat: r.latitude, lng: r.longitude });
  $$("input", app).forEach((i) => i.classList.toggle("filled", false));
  status.classList.toggle("done", false);
  status.textContent = `Filling in ${r.name}…`;
});
hero.addEventListener("church-fill", (e) => {
  const { record, changes } = e.detail;
  // Overwrite is on, so clear what this record doesn't have, then let the fill land.
  const filled = new Set(changes.map((c) => c.field));
  $$("input[data-hmc-field]", app).forEach((el) => { if (!filled.has(el.dataset.hmcField)) el.value = ""; });
  requestAnimationFrame(() => {
    let i = 0;
    for (const c of changes) {
      if (c.element.tagName !== "INPUT") continue;
      c.element.style.setProperty("--i", i++);
      c.element.classList.toggle("flash", false);
      void c.element.offsetWidth;
      c.element.classList.add("filled", "flash");
    }
    const labels = { phone: "phone", website: "website", serviceTimes: "service times", street: "street" };
    const missing = record.missing.filter((m) => labels[m]).map((m) => labels[m]);
    status.classList.add("done");
    status.textContent = `Filled ${changes.length} fields from Here's My Church` + (missing.length ? `. Not listed yet: ${missing.join(", ")}.` : ".");
  });
});

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
    btn.textContent = "Copied";
  } catch {
    btn.textContent = "Select to copy";
  }
  setTimeout(() => (btn.textContent = "Copy"), 1800);
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

// ── Scrollspy for the side nav and "On this page" ──
const links = $$(".side a, .toc a");
const sections = $$("article section[id]");
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
  status.textContent = "Sending…";
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
