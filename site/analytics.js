// Website analytics only. Never import this from the embeddable Lookup SDK.
const enabled = location.hostname === "lookup.heresmychurch.com" && window.top === window;
const seen = new Set();
const pending = [];
let ready = false;
let failed = false;

function send(name) {
  try { window.fathom?.trackEvent(name); } catch { /* Analytics must not interrupt the site. */ }
}

// Count each milestone once per page load. Callers pass fixed event names only.
export function trackEvent(name) {
  if (!enabled || failed || seen.has(name)) return;
  seen.add(name);
  if (ready) send(name);
  else pending.push(name);
}

if (enabled) {
  const script = document.createElement("script");
  script.src = "https://cdn.usefathom.com/script.js";
  script.dataset.site = "HTDVJZUN";
  script.async = true;
  script.addEventListener("load", () => {
    ready = true;
    pending.splice(0).forEach(send);
  }, { once: true });
  script.addEventListener("error", () => {
    failed = true;
    pending.length = 0;
  }, { once: true });
  document.head.append(script);
}
