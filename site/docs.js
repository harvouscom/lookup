// Docs pages: sidebar on mobile, page actions, agent prompts, ⌘K search, "On this page", and Ask AI.
import "/common.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function copyText(text, btn, done = "Copied") {
  const label = btn.dataset.label ??= btn.innerHTML;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = done;
  } catch {
    btn.textContent = "Couldn’t copy";
  }
  setTimeout(() => (btn.innerHTML = label), 1600);
}

// ── Sidebar as a sheet on small screens ──
const side = $("#dx-side"), menu = $("#dx-menu"), scrim = $("#dx-scrim");
function setMenu(open) {
  side.classList.toggle("open", open);
  scrim.hidden = !open;
  menu.setAttribute("aria-expanded", String(open));
}
menu.addEventListener("click", () => setMenu(!side.classList.contains("open")));
scrim.addEventListener("click", () => setMenu(false));
addEventListener("keydown", (e) => { if (e.key === "Escape" && side.classList.contains("open")) { setMenu(false); menu.focus(); } });

// ── Page actions ──
const more = $(".dx-act-more"), pop = $("#dx-act-menu");
more.addEventListener("click", () => {
  const open = pop.hidden;
  pop.hidden = !open;
  more.setAttribute("aria-expanded", String(open));
  if (open) pop.querySelector("a").focus();
});
document.addEventListener("click", (e) => {
  if (!pop.hidden && !e.target.closest(".dx-actions")) { pop.hidden = true; more.setAttribute("aria-expanded", "false"); }
});
pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { pop.hidden = true; more.setAttribute("aria-expanded", "false"); more.focus(); } });
$$("[data-copy-page]").forEach((btn) => btn.addEventListener("click", async () => {
  const text = await fetch(btn.dataset.copyPage).then((r) => r.text()).catch(() => "");
  if (text) copyText(text, btn, "Copied as Markdown");
}));

// ── Agent prompts ──
$$("[data-ap]").forEach((box) => {
  const body = $(".ap-body", box), more = $(".ap-more", box);
  $("[data-copy-prompt]", box).addEventListener("click", (e) => copyText(body.textContent, e.currentTarget));
  more.addEventListener("click", () => {
    const open = box.classList.toggle("open");
    more.setAttribute("aria-expanded", String(open));
    more.textContent = open ? "Collapse prompt" : "Expand prompt";
  });
});

// ── On this page: highlight the section in view ──
const railLinks = $$(".dx-rail li a");
const heads = railLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
if (heads.length) {
  const mark = () => {
    let cur = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top < 140) cur = h;
    railLinks.forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === `#${cur.id}`));
  };
  addEventListener("scroll", mark, { passive: true });
  mark();
}

// ── Search (⌘K) over a small prebuilt index ──
const searchD = $("#dx-search"), q = $("#dx-q"), hits = $("#dx-hits");
let index = null, sel = 0;
async function openSearch() {
  searchD.showModal();
  q.select();
  index ??= await fetch("/docs/search-index.json").then((r) => r.json()).catch(() => []);
  render();
}
function score(e, words) {
  const t = `${e.t} ${e.h}`.toLowerCase(), x = e.x.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (t.includes(w)) s += e.h.toLowerCase().startsWith(w) || e.t.toLowerCase().startsWith(w) ? 6 : 4;
    else if (x.includes(w)) s += 1;
    else return 0;
  }
  return s;
}
function render() {
  const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  const list = (words.length ? index.map((e) => [score(e, words), e]).filter(([s]) => s).sort((a, b) => b[0] - a[0]).map(([, e]) => e) : index.filter((e) => !e.h)).slice(0, 8);
  sel = 0;
  hits.innerHTML = list.length
    ? list.map((e, i) => `<li role="option" aria-selected="${i === 0}"><a href="${e.u}"><b>${esc(e.h || e.t)}</b>${e.h ? ` <span class="g">· ${esc(e.t)}</span>` : ` <span class="g">· ${esc(e.g)}</span>`}<small>${esc(e.x.slice(0, 120))}</small></a></li>`).join("")
    : `<li class="none">No matches. Try Ask AI below.</li>`;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
q.addEventListener("input", render);
q.addEventListener("keydown", (e) => {
  const items = $$("[role=option]", hits);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((li, i) => li.setAttribute("aria-selected", String(i === sel)));
    items[sel]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    const a = items[sel]?.querySelector("a");
    if (a) { e.preventDefault(); searchD.close(); location.href = a.href; }
  }
});
hits.addEventListener("click", (e) => { if (e.target.closest("a")) searchD.close(); });
searchD.addEventListener("click", (e) => { if (e.target === searchD) searchD.close(); });
$("#dx-search-open").addEventListener("click", openSearch);
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchD.open ? searchD.close() : openSearch(); }
  else if (e.key === "/" && !e.target.closest("input, textarea, [contenteditable]")) { e.preventDefault(); openSearch(); }
});

// ── Ask AI ──
const askD = $("#dx-ask"), askForm = $("#dx-ask-form"), askQ = $("#dx-ask-q"), log = $("#dx-ask-log"), sugg = $("#dx-ask-sugg");
const page = document.body.dataset.page;
function openAsk(prefill) {
  if (searchD.open) searchD.close();
  askD.showModal();
  if (prefill) askQ.value = prefill;
  askQ.focus();
}
$("#dx-ask-open").addEventListener("click", () => openAsk());
$$("[data-ask]").forEach((b) => b.addEventListener("click", () => openAsk(q.value && searchD.open ? q.value : "")));
$("[data-close]", askD).addEventListener("click", () => askD.close());
askD.addEventListener("click", (e) => { if (e.target === askD) askD.close(); });
$$("button", sugg).forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
askQ.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askForm.requestSubmit(); } });
askQ.addEventListener("input", () => { askQ.style.height = "auto"; askQ.style.height = `${askQ.scrollHeight}px`; });
askForm.addEventListener("submit", (e) => { e.preventDefault(); if (askQ.value.trim()) ask(askQ.value.trim()); });

// A small, safe Markdown renderer for answers: escape first, then add code, bold, lists and docs links.
function mdToHtml(src) {
  const blocks = [];
  let s = esc(src).replace(/```[\w-]*\n([\s\S]*?)(```|$)/g, (_, c) => { blocks.push(`<pre><code>${c.replace(/\n$/, "")}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]\n]+)\]\(((?:\/docs|https:\/\/lookup\.heresmychurch\.com)[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(\/docs\/[a-z-]+(?:#[a-z0-9-]+)?)/g, '$1<a href="$2">$2</a>');
  const out = [];
  for (const para of s.split(/\n{2,}/)) {
    const lines = para.split("\n");
    if (lines.every((l) => /^\s*(?:[-*]|\d+\.)\s/.test(l))) {
      const tag = /^\s*\d/.test(lines[0]) ? "ol" : "ul";
      out.push(`<${tag}>${lines.map((l) => `<li>${l.replace(/^\s*(?:[-*]|\d+\.)\s/, "")}</li>`).join("")}</${tag}>`);
    } else out.push(/^\u0000\d+\u0000$/.test(para.trim()) ? para.trim() : `<p>${lines.join("<br>")}</p>`);
  }
  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, n) => blocks[n]);
}

let busy = false;
async function ask(question) {
  if (busy) return;
  busy = true;
  sugg.hidden = true;
  askQ.value = "";
  askQ.style.height = "";
  const send = $(".dx-ask-send", askForm);
  send.disabled = true;
  const qa = document.createElement("div");
  qa.className = "qa";
  qa.innerHTML = `<p class="qa-q"></p><div class="qa-a"><p class="qa-wait">Reading the docs</p></div>`;
  $(".qa-q", qa).textContent = question;
  log.append(qa);
  qa.scrollIntoView({ block: "end" });
  const out = $(".qa-a", qa);
  let text = "";
  try {
    const res = await fetch("/v1/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, page }) });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? (res.status === 429 ? "That’s a lot of questions. Try again in a minute." : "Ask AI isn’t available right now."));
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const event = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = event.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (!data || data === "[DONE]") continue;
        try { text += JSON.parse(data).response ?? ""; } catch { /* partial line */ }
        out.innerHTML = mdToHtml(text);
      }
    }
    if (!text) throw new Error("No answer came back. Try rephrasing.");
    const tools = document.createElement("div");
    tools.className = "qa-tools";
    tools.innerHTML = `<button type="button">Copy answer</button><a href="https://claude.ai/new?q=${encodeURIComponent(`Using https://lookup.heresmychurch.com/llms-full.txt, answer: ${question}`)}" target="_blank" rel="noopener">Ask in Claude</a>`;
    tools.firstChild.addEventListener("click", (e) => copyText(text, e.currentTarget));
    out.append(tools);
  } catch (err) {
    out.innerHTML = `<p>${esc(err.message)}</p>`;
  }
  busy = false;
  send.disabled = false;
  askQ.focus();
}
