# Milestone 2: full load, lexical search, eval

Measured 2026-11-05 against production data from the moderated export, at `https://hmc-lookup.harvous.workers.dev`. The planned address, `lookup.heresmychurch.com`, isn't attached yet because that DNS change needs the owner's approval.

## Result

The section 2 design, with the spike's prefix and folding changes, **holds at full scale**. `grac`, `gracee`, `grace comm`, `first bapt` and `church in dallas` all work, and all nine gate checks passed. Today's search returns nothing for all nine.

On held-out queries, top-1 rises from 0.28 to 0.78 and zero-result queries fall from 41% to 1%. Typical latency falls from about 20 s to about 150 ms when today's search has to look across all regions.

Search is still weak in three places: common names with no location, abbreviations, and misspellings that also exist in listings. Details are below.

## Eval

`eval/golden.jsonl` has 201 queries: 120 generated with a fixed seed across country, completeness and name commonness, 72 hand-written, and 9 gate checks that sit outside the split. Dev is 114 queries and test is 78.

Ranking was tuned on dev only. The test split was scored once, on the final deployed version, with no changes afterward.

**Held-out test split.** Latency is measured from one client in the central US, and cache hits are excluded.

| System | n | Top-1 | Top-5 | MRR | Zero results | Errors | p50 | p95 |
|---|---|---|---|---|---|---|---|---|
| Today, no state | 78 | 0.282 | 0.308 | 0.291 | 41.0% | 4 | 19,910 ms | 24,970 ms |
| **Lookup lexical** | 78 | **0.782** | **0.846** | **0.807** | **1.3%** | 0 | 150 ms | 483 ms |

**Same split, only queries with a known state.** "Today, told the state" is an oracle: a real caller doesn't normally know the right state, and Lookup isn't told it.

| System | n | Top-1 | Top-5 | MRR | Zero results | p50 | p95 |
|---|---|---|---|---|---|---|---|
| Today, no state | 47 | 0.255 | 0.298 | 0.271 | 36.2% | 19,910 ms | 23,913 ms |
| Today, told the state | 47 | 0.596 | 0.681 | 0.638 | 25.5% | 182 ms | 741 ms |
| **Lookup lexical** | 47 | **0.766** | **0.872** | **0.808** | **0%** | 161 ms | 533 ms |

The dev split, for comparison, scored top-1 0.728 and top-5 0.825, so tuning didn't overfit visibly. The test split happens to score higher.

**By class, dev and test combined.** Because this includes the tuning split, it's more flattering than the test table.

| Class | n | Today top-1 | Today told the state, top-1 | Lookup top-1 | Lookup top-5 | Lookup zero |
|---|---|---|---|---|---|---|
| Gate checks | 9 | 0.000 | | **1.000** | 1.000 | 0% |
| Full name | 30 | 0.233 | **0.667** | 0.633 | 0.767 | 0% |
| Typeahead | 30 | 0.133 | 0.467 | **0.567** | 0.700 | 0% |
| Typo, generated | 30 | 0.033 | 0.267 | **0.600** | 0.800 | 0% |
| Name and place | 30 | 0.633 | 0.933 | **1.000** | 1.000 | 0% |
| Place | 16 | 0.563 | | **1.000** | 1.000 | 0% |
| St/Saint | 8 | 0.625 | | **1.000** | 1.000 | 0% |
| Abbreviation | 9 | 0.111 | | **0.667** | 0.667 | 11% |
| Diacritics | 8 | 0.500 | | **1.000** | 1.000 | 0% |
| Common word | 12 | 0.667 | | **0.917** | 1.000 | 0% |
| Typo, hand-written | 14 | 0.000 | | **0.571** | 0.643 | 0% |
| Translation | 5 | 0.000 | | **0.600** | 0.600 | 0% |

### What missed

- **Common names with no location (test top-1 0.25, n=8).** `Kaplica pw. Miłosierdzia Bożego` matches many listings and nothing says which was meant. Exact-name retrieval also only sees the 60 most complete per rung, the risk the spike flagged. Top-1 rises to 0.87 on test queries where a location is given. This is the largest drag on the overall number and isn't really fixable without location.
- **Full name with a state supplied.** On full names, today's search told the state (0.667) slightly beat Lookup with no hints (0.633). Scoping by a known region is a real advantage, and Lookup callers can have it by passing `region`.
- **Misspellings that exist in listings.** `luthern church`, `grace chruch`, `grace comunity`, `calvery chapel` and `pentacostal` return listings with the same misspelling instead of correcting, because the word is in the vocabulary. Those results are arguably right, but the common spelling is what a person wants. The fix is to also offer the common spelling when a much more frequent neighbor exists, which would add a vocabulary lookup to more queries.
- **Abbreviations.** `lds church` returns nothing, and `umc dallas` isn't expanded. One test label was too strict in hindsight: `ame church` is scored a miss though its top results are AME churches. I left it, since I had already seen the test split. Multi-word expansions aren't built.
- **Translations.** `trinity church munich` and `mormon` miss. Lexical search can't do these, so they're the honest test of semantic search in milestone 3. English place names like Munich aren't mapped to München either.
- **Uncorrected typos.** `Raaen kirkko` isn't corrected. Single words under 7 characters only reach one edit by design.

### Labels changed

Two dev labels were corrected after seeing results, because they were wrong rather than because the system missed: `sda church` now accepts "SDA" in the name, and `cogic` accepts "COGIC".

## Full-scale D1

587,842 rows. `scripts/spike/bench.mjs` re-run on the production database, 20 warm runs per query, Worker in Kansas City (MCI) to the D1 primary in eastern North America. Raw data: [`spike/d1-full-scale.json`](spike/d1-full-scale.json), [`spike/d1-long-prefix.json`](spike/d1-long-prefix.json), [`spike/d1-burst-full-scale.json`](spike/d1-burst-full-scale.json).

| Query | Wall p50 / p95 ms | SQL ms per rung, p50 |
|---|---|---|
| grac | 38 / 47 | 4.6 / 3.7 / 1.3 |
| grace c | 40 / 162 | 4.9 / 4.3 / 1.7 |
| grace comm | 42 / 63 | 3.3 / 3.0 / 2.3 |
| gracee (no match) | 30 / 40 | 1.5 / 0.9 / 0.3 |
| first bapt | 39 / 83 | 3.2 / 1.9 / 1.3 |
| first baptist | 32 / 87 | 2.8 / 1.8 / 1.1 |
| church | 34 / 101 | 2.2 / 1.6 / 0.7 |
| baptist methodist (worst seen) | 44 / 51 | 4.7 / 4.9 / 9.4 |
| first united methodist (longer than 8 characters) | 45 / 56 | 6.5 / 5.7 / 3.9 |

Across all 37 spike queries, wall p50 was 29-45 ms. The local model predicted the fix would hold, and it did: `grace c` is 11 ms of SQL rather than the 390 ms predicted without it. Words over the 8-character prefix limit stayed under 6.5 ms per rung.

**Throughput is the real limit.**

| Concurrent | `grace` | `grace c` |
|---|---|---|
| 10 | 60/s, p95 192 ms | 48/s, p95 213 ms |
| 25 | 73/s, p95 344 ms | 59/s, p95 501 ms |
| 50 | 66/s, p95 757 ms | 54/s, p95 964 ms |
| 100 | 76/s, p95 1,358 ms | 58/s, p95 2,333 ms |
| 150 | overloaded | 81/s, p95 2,444 ms |

That is about 60-80 batches per second, down from 100-135 at 35k rows. Plan on about 60 uncached keystrokes per second. The Worker returns 503 with `Retry-After` on overload, which is tested with a stubbed database rather than a real overload through the deployed Worker. Repeats are served from the edge cache. This is enough for the hackathon and stretch-goal traffic should be watched against it.

**Size and load.** 414 MB, against about 285 MB projected. About 27 MB of that is vocabulary and places, which the projection left out, and I didn't isolate the rest. The load took about 5 minutes and wrote 3.68M rows by D1's count. I didn't run FTS5 `optimize`, so how much space it would recover is unmeasured.

## Latency outside the US

Probed with check-host.net: six queries, each twice per node. The first pass reaches D1 and the second should hit the edge cache. These times include DNS, TCP and TLS, so they overstate a page with a warm connection, and many nodes have only 1-3 samples, so treat them as rough. Raw data: [`spike/global-latency.json`](spike/global-latency.json).

| Node | First pass, median | Second pass, median |
|---|---|---|
| Canada | 143 ms | 152 ms |
| USA | 225 ms | 167 ms |
| Sweden | 212 ms | 63 ms |
| Germany | 240 ms | no sample |
| Switzerland | 242 ms | 260 ms |
| Spain | 287 ms | 66 ms |
| UK | 336 ms | no sample |
| Japan | 303 ms | 278 ms |
| Singapore | 388 ms | 484 ms |
| India | 649 ms | no sample |

Europe sees about 210-340 ms on a miss, and about 65 ms on nodes with a clean cache hit. Europe holds about 60% of the corpus, so this matters. The Worker already uses D1 sessions, so turning on read replication needs no code change, but it's an account setting I couldn't change from Wrangler and it hasn't been measured.

## Data reconciliation

- **Regions.** `/regions` lists 544, and the countries route implies 541. The three extra are DC (525 rows, folded into MD by the countries route and kept here as its own region) and `NLBQ2` and `NLBQ3`, which `/regions` lists but the region route rejects with 404. 542 regions were loaded.
- **Rows.** 655,977 exported, 68,135 unnamed rows excluded, 587,842 loaded. `scripts/verify-load.mjs` confirms table and per-region counts match the manifest exactly. There were no `pending_reverify` or relocated rows in the export.
- **Missing `state`.** Two rows have no `state`, and take the region they were exported under.
- **Office hours.** Stored rows don't record their source, so `opening_hours` values are detected by shape: no clock time, or a range of 4+ hours. That dropped 2,282 of 22,460 service-time values. It's a heuristic, and will miss some and catch a few real services.
- **Addresses.** 23,101 addresses were only a postcode and are now blank. Others had the trailing postcode removed.

## Changes from the plan

- **Typo vocabulary:** one-character deletions (1.04M rows) rather than grams. A lookup is a few indexed point reads, and edit distance is verified in the Worker.
- **Global follow-up:** if the rungs return too few results, a fourth query searches everywhere, so a US visitor can still find a German name.
- **Named places:** results outside a named place drop to the lowest band, even for an exact name. Without this, `grace, chicago` led with a church called "Grace" elsewhere.
- **Search-only `near`:** rows without a city carry a nearest place of up to 30 km in the index, which helps `first baptist dallas`. It's never returned as `city`.

## Not done

- `lookup.heresmychurch.com`, pending approval.
- A daily rate cap. The 120 per minute per-IP limit is in place, but a daily cap needs storage.
- Automated sync. The index is a one-time load from the export taken on 2026-11-05. Cron is milestone 3.
- A check of field integrity on 1,000 random ids against the export, from section 6.

## Reproduce

```bash
node scripts/fetch-export.mjs <exportDir>
```

```bash
node scripts/build-index.ts <exportDir> <buildDir>
```

```bash
node scripts/load-d1.mjs <buildDir>
```

```bash
node scripts/verify-load.mjs <buildDir>
```

```bash
LOOKUP_URL=https://hmc-lookup.harvous.workers.dev node eval/run.mjs lookup --split test
```

```bash
node eval/compare.mjs
```
