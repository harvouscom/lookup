# Milestone 3: semantic search, sync, SDK and widget

Measured 2026-11-05 on production at `lookup.heresmychurch.com`.

## Result

Everything in scope is deployed: hybrid search, the 5-minute sync, the SDK and widget, and a site that autofills from production. Semantic search adds little, so it now runs only where it can help. The end-to-end sync check is still pending, because no region has been written to in Here's My Church since the export routes shipped.

## Semantic search

- **Model and index:** bge-m3, 1024 dimensions, in Vectorize index `hmc-lookup-bge-m3`. Metadata indexes on `cc`, `region` and `g3` were created before any insert.
- **Backfill:** 587,842 vectors in 30 minutes, with 0 failed ranges. A handful of Workers AI "Cog prediction failed" errors succeeded on retry.
- **When it runs:** only on settled queries (`settled=1`) of 4 or more characters. It has an 800 ms timeout, falls back to `degraded:true` on failure, and has a per-IP limit of 30 a minute plus the `SEMANTIC_ENABLED` kill switch.
- **Ranking:** results join back to D1, so stale vectors can't surface excluded rows. Semantic-only results rank in the lowest band, fused with partial lexical matches by reciprocal rank (k=60).

### Eval, held-out test split (78 queries)

| System | Top-1 | Top-5 | MRR | Zero results | p50 | p95 |
|---|---|---|---|---|---|---|
| Today, no state | 0.282 | 0.308 | 0.291 | 41.0% | 19,910 ms | 24,970 ms |
| Lookup, lexical | 0.782 | 0.846 | 0.807 | 1.3% | 150 ms | 483 ms |
| Hybrid, first rule | 0.782 | 0.859 | 0.814 | 0% | 412 ms | 1,237 ms |
| **Hybrid, narrowed rule (deployed)** | **0.782** | **0.872** | **0.820** | **0%** | **168 ms** | **734 ms** |

**The first rule** ran semantic search whenever fewer than three results were exact or in-order name matches.
- It ran on 87 of 201 queries and timed out on 23 of them (26%). When it did complete, p50 was 764 ms.
- It improved one query (`Raaen kirkko`, from not found to rank 2) and made none worse.
- On the dev split it changed nothing in any class.

**The narrowed rule** runs semantic search only when no word result matches every word.
- I chose this from the dev result and the cost, not from tuning on test. The test split was scored once with the first rule and once with the final rule, and nothing was tuned in between.
- It ran on 9 of 78 test queries, with no timeouts and p50 639 ms when it ran.
- It improved two queries (`Raaen kirkko` and `grace comunity`, both to rank 2) and made none worse.

By class, across test and dev with the first rule, semantic search changed nothing for:
- **Translations** (5 queries): `trinity church munich` still misses, and `mormon` returns sound-alike names.
- **Abbreviations** (9): `lds church` returns "Lund Church" and "Sanders Church".
- **Common names with no location** (8): unchanged.
- **Full names and typeahead:** unchanged.

It helped only typos: generated typo top-5 went from 0.800 to 0.833. The semantic path's value is narrow, and the narrowed rule reflects that.

## Cron sync

- **Schedule:** every 5 minutes, up to 8 regions per tick, dirty regions first, then the longest since last sync.
- **Diffing:** changes are diffed by `doc_hash`, and rows are re-embedded only when `embed_hash` changes, through a D1 queue so a failed embed retries. Deletes are skipped when a region shrinks by more than 50%. Moved rows go to `moved`.
- **Consistency:** the first syncs of 92 regions, including TX, DEBY, PLWP and DC, all found zero changes. That proves the Worker's projection, including nearest place, matches the index build exactly.
- **End to end:** pending. No region has a `dirtyAt` yet, so a real write hasn't been observed flowing through. This needs a moderated edit in Here's My Church.
- **Not synced:** places, the vocabulary and completeness rowid order update only on a full rebuild. New rows are appended at the end.

## SDK and widget

| File | Gzipped | Budget |
|---|---|---|
| Client (`lookup.js`) | 527 B | 2 KB |
| `<church-lookup>` (`element.js`) | 4.6 KB | 10 KB |
| `<church-service-times>` (`service-times.js`) | 3.6 KB | 6 KB |

**`<church-lookup>`**
- An ARIA 1.2 combobox with full keyboard support. It handles IME composition and announces results and fills.
- When settled results arrive, the highlighted church keeps its place.
- It fills `data-hmc-field` inputs through the native setter, firing `input` and `change`, and doesn't overwrite fields that already have a value.
- It takes `--hmc-*` and shadcn/Sensible UI tokens.
- Events: cancelable `church-select` and `church-fill`, plus `church-results`.

**`<church-service-times>`** edits service times as rows, like Here's My Church's own input, and stores the same canonical string.

**Search labels:** search results now carry a display `label` and a `locationLabel`.

**Tests:** 33 SDK tests in happy-dom, including the size budgets. axe found no violations on the site. Playwright wasn't set up.

## Site

`lookup.heresmychurch.com/` is a docs and showcase page.
- **Hero:** a violet panel with the live search and a globe whose dots are real church density from `site/data/globe.json` (aggregates only). Results pin on the globe, and picking a church flies the globe to it and fills an example app form below.
- **Docs:** quickstart, widget, service times, theming (an embedded three-look example), a live API playground, how search works with these numbers, and data and review.

## Not done

- The end-to-end sync check, which needs a real write in Here's My Church.
- A Playwright plus axe spec. axe ran manually in the browser instead.
- npm publish, contributions and confirm, which are milestone 4.
