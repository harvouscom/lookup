// Website analytics only. The page templates load Fathom directly in the head.
const enabled = location.hostname === "lookup.heresmychurch.com" && window.top === window;
const seen = new Set();

// Count each milestone once per page load. Callers pass fixed event names only.
export function trackEvent(name) {
  if (!enabled || !window.fathom || seen.has(name)) return;
  seen.add(name);
  try { window.fathom.trackEvent(name); } catch { /* Analytics must not interrupt the site. */ }
}
