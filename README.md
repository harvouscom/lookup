# Lookup

**Official submission for the [AI for Church Hackathon 2026](https://aiforchurch.com/hackathon)** — Open Track.  
Started October 30, 2026 · Completed November 14, 2026.

The autofill for your church info: a church typeahead and autofill API, SDK, and widget built on the [Here's My Church](https://heresmychurch.com) open directory of 587,842 churches across 19 countries.

**Live demo & docs:** [lookup.heresmychurch.com](https://lookup.heresmychurch.com/)

Type a few letters, pick your church, and the address, website, phone, service times, and more fill in automatically. No API key required.

## Why it exists

Church apps keep asking people for the same details over and over. Lookup solves this once, from a shared open directory, so every app that uses it helps keep church data accurate. When someone corrects a filled-in detail, they can share the fix back — churches that have claimed their listing review changes first; otherwise Here's My Church checks them automatically (AI helps locate supporting evidence on the church's website; a person reviews anything the checks can't decide).

Built during the October 30 – November 27, 2026 hackathon window. Uses AI for semantic search fallback (only when lexical matching fails) and in the contribution review pipeline. Humans stay in the loop.

## Features

- **Accessible combobox widget** — `<church-lookup>` custom element. Search as you type (prefixes, typos, "church in dallas"). Keyboard friendly. Autofills tagged form fields. Preserves anything the user already typed.
- **Open API** — Plain HTTP, open CORS, no key. Search, get church records, submit contributions, confirm listings, add missing churches. Rate limited and documented.
- **React & shadcn/ui** — Registry components and hooks so you can own the code. Works with Lovable, v0, Vite, etc.
- **Service times editor** — Editable as rows of day/time/label, still submits as one plain string.
- **Theming** — CSS variables. Matches shadcn/ui-style tokens with zero setup. Inherits Sensible UI tokens.
- **AI-assisted quality** — Semantic ranking only as a fallback. Contribution review uses AI to find supporting quotes on the church's own site, then code + human review.
- **Agent-friendly** — [SKILL.md](https://lookup.heresmychurch.com/SKILL.md) so AI coding agents can add Lookup to an app in one prompt.
- **Community loop** — Fixes shared from any app flow back to Here's My Church. Completeness and freshness scores surface the best data.

## Quick start

Add the widget to any form in three steps (no key):

```html
<script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/element.js"></script>

<form>
  <church-lookup name="church_id" label="Your church"></church-lookup>
  <input name="street" data-hmc-field="street">
  <input name="city" data-hmc-field="city">
  <input name="website" data-hmc-field="website">
  <button>Join</button>
</form>
```

Or hand this to an AI agent:

> Add church lookup to my app: lookup.heresmychurch.com/SKILL.md

Full quickstart, React guide, API reference, and theming docs: [lookup.heresmychurch.com/docs](https://lookup.heresmychurch.com/docs)

Live API example: `https://lookup.heresmychurch.com/v1/search?q=grace%20comm`

## Project structure

| Path | Contents |
|---|---|
| `worker/` | Lookup API (Cloudflare Worker) |
| `packages/sdk/` | Client, `<church-lookup>` element, React registry |
| `scripts/` | Index build and measurement tools |
| `eval/` | Baselines, golden set, and results |
| `docs/` | Markdown source for the docs site |
| `site/` | Landing page, docs, and demo forms |

Evaluation details and design decisions live in `eval/results/`.

## Hackathon notes

- **Track:** Open Track
- **Build window:** October 30 – November 27, 2026
- **Completed:** November 14, 2026
- **Live demo:** https://lookup.heresmychurch.com/
- **Repo:** https://github.com/harvouscom/lookup
- Built as a new project during the official build window.
- AI is used for semantic search fallback and contribution review (with human oversight).
- Open source (MIT). Data from OpenStreetMap (ODbL) + Here's My Church community contributions.

## License & credits

Code is [MIT](LICENSE).

Directory data includes OpenStreetMap contributors' data (ODbL) and contributions from Here's My Church users.

The widget's look follows [Sensible UI](https://sensibleui.com) by [Cam Pak](https://github.com/cameronapak) (MIT): it inherits Sensible UI and shadcn/ui theme tokens, and the example page is styled with it.

---

Built by [Derek Castelli](https://github.com/heyderekj) under the [Harvous](https://github.com/harvouscom) umbrella for the [AI for Church Hackathon 2026](https://aiforchurch.com/hackathon).
