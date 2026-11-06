// Build the docs: docs/*.md → site/docs/*.html (Clerk-style layout), plus the AI-readable copies:
// site/docs/*.md, site/llms.txt, site/llms-full.txt, site/SKILL.md and a search index.
// Run: node scripts/build-docs.mjs. Output is committed, so the site works without a build step.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { Marked } from "marked";
import { createHighlighter } from "shiki";

const SITE = "https://lookup.heresmychurch.com";
const REPO = "https://github.com/harvouscom/lookup";
const NAV = [
  { title: "Get started", pages: ["index", "quickstart", "examples"] },
  { title: "Widget", pages: ["widget", "react", "service-times", "theming"] },
  { title: "API", pages: ["api"] },
  { title: "How it works", pages: ["how-search-works", "data"] },
];
const themes = JSON.parse(readFileSync("scripts/shiki-lookup.json", "utf8"));
const highlighter = await createHighlighter({
  themes: [themes.dark, themes.light],
  langs: ["html", "javascript", "typescript", "tsx", "bash", "json", "css", "vue", "text"],
});

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const href = (p) => (p === "index" ? "/docs" : `/docs/${p}`);
const mdHref = (p) => `/docs/${p}.md`;

// ── Pages ──
function parse(file) {
  const raw = readFileSync(`docs/${file}`, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return { meta, body: raw.slice(m ? m[0].length : 0) };
}
const order = NAV.flatMap((g) => g.pages.map((p) => ({ page: p, group: g.title })));
const pages = order.map(({ page, group }) => ({ page, group, ...parse(`${page}.md`) }));

// ── Custom blocks: :::prompt, :::note, :::tabs, :::cards, :::html ──
// Each block becomes a placeholder before Markdown runs, so its HTML survives untouched.
function blocks(body, stash) {
  return body.replace(/^:::(\w+)([^\n]*)\n([\s\S]*?)^:::\s*$/gm, (_, kind, arg, inner) => {
    const title = arg.trim();
    let html = "";
    if (kind === "html") html = inner;
    else if (kind === "prompt") {
      const n = stash.length;
      html = `<div class="ap" data-ap>
  <div class="ap-bar"><span class="ap-ic" aria-hidden="true"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M3.4 12.6l2.1-2.1M10.5 5.5l2.1-2.1"/></svg></span><b>${esc(title || "Prompt")}</b><button class="ap-copy" type="button" data-copy-prompt>Copy prompt</button></div>
  <pre class="ap-body" id="ap-${n}" tabindex="0">${esc(inner.trim())}</pre>
  <button class="ap-more" type="button" aria-expanded="false" aria-controls="ap-${n}">Expand prompt</button>
</div>`;
    } else if (kind === "note" || kind === "tip" || kind === "warn") {
      html = `<div class="callout ${kind}"><p class="callout-t">${esc(title || { note: "Note", tip: "Tip", warn: "Heads up" }[kind])}</p>${md.parse(inner)}</div>`;
    } else if (kind === "tabs") {
      const fences = [...inner.matchAll(/```(\w+)\s+title="([^"]+)"\n([\s\S]*?)```/g)];
      const id = `tb-${stash.length}`;
      const tabs = fences.map((f, i) => `<button role="tab" aria-selected="${i === 0}" aria-controls="${id}-${i}" id="${id}-${i}-t"${i ? ' tabindex="-1"' : ""}>${esc(f[2])}</button>`).join("");
      const panes = fences.map((f, i) => code(f[3], f[1], { id: `${id}-${i}`, hidden: i > 0, label: `${id}-${i}-t` })).join("");
      html = `<div class="cb" data-tabs><div class="cb-bar"><div class="tabs" role="tablist" aria-label="${esc(title || "Examples")}">${tabs}</div><button class="copy cb-copy" type="button">Copy</button></div>${panes}</div>`;
    } else if (kind === "cards") {
      const items = [...inner.matchAll(/^- \[([^\]]+)\]\(([^)]+)\):\s*(.+)$/gm)];
      html = `<div class="cards">${items.map((c) => `<a class="card" href="${esc(c[2])}"><b>${esc(c[1])}</b><span>${md.parseInline(c[3])}</span></a>`).join("")}</div>`;
    }
    stash.push(html);
    return `\n\nXSTASHX${stash.length - 1}XSTASHX\n\n`;
  });
}

// Markdown copies for agents: blocks turn back into plain Markdown, and interactive demos drop out.
function plain(body) {
  return body.replace(/^:::(\w+)([^\n]*)\n([\s\S]*?)^:::\s*$/gm, (_, kind, arg, inner) => {
    const title = arg.trim();
    if (kind === "html") return "";
    if (kind === "prompt") return `**${title || "Prompt"}**\n\n\`\`\`text\n${inner.trim()}\n\`\`\`\n`;
    if (kind === "note" || kind === "tip" || kind === "warn") return inner.trim().split("\n").map((l, i) => `> ${i === 0 ? `**${title || "Note"}:** ` : ""}${l}`).join("\n") + "\n";
    if (kind === "tabs") return inner.replace(/```(\w+)\s+title="([^"]+)"\n/g, (_m, lang, t) => `${t}:\n\n\`\`\`${lang}\n`);
    return inner;
  }).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function code(text, lang = "text", { id, hidden, label, bar = false } = {}) {
  const known = highlighter.getLoadedLanguages().includes(lang) ? lang : "text";
  const html = highlighter.codeToHtml(text.replace(/\n$/, ""), { lang: known, themes: { light: "lookup-light", dark: "lookup-dark" }, defaultColor: false });
  const pre = html.replace(/^<pre class="shiki[^"]*"[^>]*>/, `<pre class="shiki" tabindex="0"${id ? ` id="${id}" role="tabpanel" aria-labelledby="${label}"` : ""}${hidden ? " hidden" : ""}>`);
  if (!bar) return pre;
  return `<div class="cb"><div class="cb-bar"><span class="cb-l">${esc(lang === "text" ? "" : lang)}</span><button class="copy cb-copy" type="button">Copy</button></div>${pre}</div>`;
}

let toc = [];
const md = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) { return code(text, (lang || "text").split(/\s/)[0], { bar: true }); },
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const id = slug(inner);
      if (depth === 2 || depth === 3) toc.push({ depth, id, text: inner.replace(/<[^>]+>/g, "") });
      return `<h${depth} id="${id}"><a class="hash" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
    },
    table(token) {
      const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
      const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("");
      const label = token.header.map((c) => c.text.replace(/[`*]/g, "")).join(", ");
      return `<div class="tw" tabindex="0" role="region" aria-label="${esc(label)}"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  },
});

// ── Layout ──
const ICON = {
  search: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m13.5 13.5-3.3-3.3"/></svg>',
  spark: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3z"/></svg>',
  gh: '<svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
  sun: '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
  menu: '<svg class="burger" viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path class="b1" d="M2.5 4.5h11"/><path class="b2" d="M2.5 8h11"/><path class="b3" d="M2.5 11.5h11"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>',
  chev: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>',
};

function sidebar(current) {
  const groups = NAV.map((g) => `<div class="sg"><p class="sg-t">${esc(g.title)}</p><ul>${g.pages.map((p) => {
    const pg = pages.find((x) => x.page === p);
    return `<li><a href="${href(p)}"${p === current ? ' aria-current="page"' : ""}>${esc(pg.meta.nav || pg.meta.title)}</a></li>`;
  }).join("")}</ul></div>`).join("");
  return `${groups}<div class="sg sg-ai"><p class="sg-t">For AI tools</p><ul>
<li><a href="/SKILL.md">SKILL.md</a></li><li><a href="/llms.txt">llms.txt</a></li><li><a href="/llms-full.txt">llms-full.txt</a></li></ul></div>`;
}

function layout(pg, article, rail) {
  const i = order.findIndex((o) => o.page === pg.page);
  const prev = pages[i - 1], next = pages[i + 1];
  const url = `${SITE}${href(pg.page)}`;
  const ask = encodeURIComponent(`Read ${SITE}${mdHref(pg.page)} so I can ask questions about Lookup's ${pg.meta.title} docs.`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pg.meta.title)} · Lookup docs</title>
<meta name="description" content="${esc(pg.meta.description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="text/markdown" href="${mdHref(pg.page)}" title="This page as Markdown">
<meta property="og:title" content="${esc(pg.meta.title)} · Lookup docs">
<meta property="og:description" content="${esc(pg.meta.description)}">
<meta property="og:url" content="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght,ROND@6..144,400..700,0..100&family=Geist+Mono:wght@400..600&display=swap">
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/docs.css">
<script>
  try { var t = localStorage.getItem("lookup-docs-theme"); if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.dataset.theme = "dark"; } catch (e) {}
</script>
</head>
<body class="dx-body" data-page="${pg.page}">
<a class="skip" href="#content">Skip to content</a>
<header class="dx-top">
  <button class="dx-icon dx-menu" id="dx-menu" type="button" aria-label="Docs menu" aria-expanded="false" aria-controls="dx-side">${ICON.menu}</button>
  <a class="dx-brand" href="/" aria-label="Lookup home"><img src="/brand/mark.svg" alt="" width="22" height="22"><span>Lookup</span></a>
  <a class="dx-pill" href="/docs">Docs</a>
  <button class="dx-search" id="dx-search-open" type="button">${ICON.search}<span>Search docs</span><kbd>⌘K</kbd></button>
  <button class="dx-ask" id="dx-ask-open" type="button">${ICON.spark}<span>Ask AI</span></button>
  <div class="dx-top-end">
    <button class="theme dx-icon" id="theme" type="button" aria-pressed="false" aria-label="Dark mode">${ICON.sun}</button>
    <a class="dx-icon" href="${REPO}" aria-label="Lookup on GitHub">${ICON.gh}</a>
  </div>
</header>
<div class="dx">
  <nav class="dx-side" id="dx-side" aria-label="Docs">${sidebar(pg.page)}</nav>
  <main class="dx-main" id="content">
    <p class="dx-crumbs"><a href="/docs">Docs</a><span aria-hidden="true">/</span>${esc(pg.group)}</p>
    <div class="dx-head">
      <h1>${esc(pg.meta.title)}</h1>
      <div class="dx-actions">
        <button class="dx-act" type="button" data-copy-page="${mdHref(pg.page)}">${ICON.copy}<span>Copy page</span></button>
        <button class="dx-act dx-act-more" type="button" aria-label="More page actions" aria-expanded="false" aria-controls="dx-act-menu">${ICON.chev}</button>
        <div class="dx-menu-pop" id="dx-act-menu" hidden>
          <a href="${mdHref(pg.page)}">View as Markdown<small>Plain text for people and agents</small></a>
          <a href="https://claude.ai/new?q=${ask}" target="_blank" rel="noopener">Open in Claude<small>Ask questions about this page</small></a>
          <a href="https://chatgpt.com/?q=${ask}" target="_blank" rel="noopener">Open in ChatGPT<small>Ask questions about this page</small></a>
        </div>
      </div>
    </div>
    <p class="dx-desc">${esc(pg.meta.description)}</p>
    <article class="dx-prose">
${article}
    </article>
    <nav class="dx-pager" aria-label="Previous and next page">
      ${prev ? `<a href="${href(prev.page)}"><small>Previous</small>${esc(prev.meta.title)}</a>` : "<span></span>"}
      ${next ? `<a class="next" href="${href(next.page)}"><small>Next</small>${esc(next.meta.title)}</a>` : ""}
    </nav>
    <footer class="dx-foot"><span>Lookup is part of <a href="https://heresmychurch.com">Here&#8217;s My Church</a>.</span><a href="${REPO}/edit/main/docs/${pg.page}.md">Edit this page on GitHub</a></footer>
  </main>
  <aside class="dx-rail" aria-label="On this page">
    ${rail}
    <div class="dx-rail-ai">
      <p>Using an AI assistant?</p>
      <button type="button" class="dx-rail-btn" data-copy-page="${mdHref(pg.page)}">${ICON.copy}Copy page as Markdown</button>
      <button type="button" class="dx-rail-btn" data-ask>${ICON.spark}Ask AI about this page</button>
    </div>
  </aside>
</div>
<div class="dx-scrim" id="dx-scrim" hidden></div>
<dialog class="dx-dialog dx-search-d" id="dx-search" aria-label="Search docs">
  <div class="dx-search-in">${ICON.search}<input id="dx-q" type="search" placeholder="Search the docs" autocomplete="off" spellcheck="false" aria-controls="dx-hits" aria-label="Search the docs"><kbd>esc</kbd></div>
  <ul class="dx-hits" id="dx-hits" role="listbox" aria-label="Results"></ul>
  <p class="dx-search-ask"><button type="button" data-ask>${ICON.spark}Ask AI instead</button></p>
</dialog>
<dialog class="dx-dialog dx-ask-d" id="dx-ask" aria-labelledby="dx-ask-h">
  <div class="dx-ask-head"><h2 id="dx-ask-h">${ICON.spark}Ask AI</h2><button type="button" class="dx-icon" data-close aria-label="Close">×</button></div>
  <div class="dx-ask-log" id="dx-ask-log" aria-live="polite">
    <p class="dx-ask-intro">Answers come from these docs, written by an AI model on Cloudflare Workers AI. Check anything important against the linked page.</p>
    <div class="dx-ask-sugg" id="dx-ask-sugg">
      <button type="button">How do I save the church ID with my form?</button>
      <button type="button">How do I theme the widget to match my app?</button>
      <button type="button">Which fields can people share back?</button>
      <button type="button">How do I use Lookup from React?</button>
    </div>
  </div>
  <form class="dx-ask-form" id="dx-ask-form"><label class="sr" for="dx-ask-q">Your question</label><textarea id="dx-ask-q" rows="1" maxlength="500" placeholder="Ask a question about Lookup"></textarea><button type="submit" class="dx-ask-send">Ask</button></form>
</dialog>
<script type="module" src="/element.js"></script>
<script type="module" src="/service-times.js"></script>
<script type="module" src="/docs.js"></script>
</body>
</html>
`;
}

// ── Build ──
rmSync("site/docs", { recursive: true, force: true });
mkdirSync("site/docs", { recursive: true });
const search = [];
const full = [];
for (const pg of pages) {
  toc = [];
  const stash = [];
  let html = md.parse(blocks(pg.body, stash));
  html = html.replace(/<p>XSTASHX(\d+)XSTASHX<\/p>/g, (_, n) => stash[Number(n)]).replace(/XSTASHX(\d+)XSTASHX/g, (_, n) => stash[Number(n)]);
  const rail = toc.length ? `<p class="dx-rail-t">On this page</p><ul>${toc.map((t) => `<li class="d${t.depth}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ul>` : "";
  writeFileSync(`site/docs/${pg.page}.html`, layout(pg, html, rail));
  const text = plain(pg.body);
  const mdOut = `# ${pg.meta.title}\n\n> ${pg.meta.description}\n\nSource: ${SITE}${href(pg.page)}\n\n${text}`;
  writeFileSync(`site/docs/${pg.page}.md`, mdOut);
  full.push(mdOut);
  // Search: one entry per page and per h2/h3 section, with a little text to match against.
  const parts = text.replace(/```[\s\S]*?```/g, "").split(/^#{2,3} /m);
  // Plain words only: no Markdown marks, link targets or table rules.
  const words = (s) => s.replace(/\]\([^)]*\)/g, "]").replace(/^\|?[\s|:-]+\|?$/gm, "").replace(/\|/g, " · ").replace(/[`*_>#\[\]]/g, "").replace(/(\s*·\s*)+/g, " · ").replace(/\s+/g, " ").replace(/^ ?· /, "").trim().slice(0, 1200);
  search.push({ t: pg.meta.title, h: "", u: href(pg.page), g: pg.group, x: words(parts[0]) });
  for (const part of parts.slice(1)) {
    const [head, ...rest] = part.split("\n");
    search.push({ t: pg.meta.title, h: head.replace(/`/g, ""), u: `${href(pg.page)}#${slug(head.replace(/`/g, ""))}`, g: pg.group, x: words(rest.join("\n")) });
  }
}
writeFileSync("site/docs/search-index.json", JSON.stringify(search));
const intro = "Lookup is a church search box and autofill SDK for any church app, from Here's My Church: one script tag, an open API, no key. People pick their church and the address, website and service times fill in.";
writeFileSync("site/llms.txt", `# Lookup\n\n> ${intro}\n\n## Docs\n\n${pages.map((p) => `- [${p.meta.title}](${SITE}${mdHref(p.page)}): ${p.meta.description}`).join("\n")}\n\n## For agents\n\n- [SKILL.md](${SITE}/SKILL.md): How to add Lookup to an app, step by step.\n- [Full docs](${SITE}/llms-full.txt): Every page in one file.\n\n## Source\n\n- [GitHub](${REPO})\n`);
writeFileSync("site/llms-full.txt", `# Lookup docs\n\n> ${intro}\n\n${full.join("\n\n---\n\n")}`);
writeFileSync("site/SKILL.md", readFileSync("docs/_skill.md", "utf8"));
console.log(`built ${pages.length} pages, ${search.length} search entries`);
