# Milestone 1 spike: D1 search and bge-m3

Measured 2026-11-05 on real D1 and Workers AI, using a throwaway Worker and database that have since been deleted. The data was the public R2 files for TX, DEBY and PLWP. Those files contain unmoderated overlays, so this data is for measurement only and no church rows from it are committed here.

## Verdict

**The section 2 design holds with four changes.** Rowid-ordered FTS5 with three capped rungs is fast on D1, and `grac`, `grace comm` and `first bapt` now return results. These need to change:

1. **Index prefixes `1 2 3 4 5 6 7 8`, not `2 3 4 5`.** This is required. Prefixes with no prefix index lose the early stop, and the cost grows with the corpus.
2. **Fold letters that `remove_diacritics` leaves alone** (`ł ß ø đ æ œ ı þ ð`), in both the index and the query. Today `kosciol` and `wroclaw` return 0.
3. **Raise the AI timeout from 400 ms to about 800 ms.** bge-m3 alone misses 400 ms on 25% of calls, before Vectorize runs.
4. **Treat throughput as a hard limit.** One D1 database served about 100-135 batches per second, then queued. Handle `D1 DB is overloaded`, and rely on the edge cache.

Keep the section 2 embed text. Don't add a trigram table.

## Setup

| | |
|---|---|
| Rows | 35,303 of 40,130 after exclusions: TX 16,018, DEBY 15,144, PLWP 4,141 |
| Share of corpus | 6% of the planned 588k |
| Query | `db.batch` of three `LIMIT 60` rungs: nine g4 cells, nine g3 cells, country |
| Worker to D1 | MCI colo to ENAM primary, read replication off |
| Runs | 20 warm runs per query, plus one cold run discarded from percentiles |

## D1 latency and rows read

Full three-rung batch, measured inside the Worker. Raw data: [`spike/d1-three-regions.json`](spike/d1-three-regions.json), [`spike/d1-fixed.json`](spike/d1-fixed.json).

| Query | Rows per rung | Rows read per rung | SQL ms per rung, p50 (section 2) | Wall p50 / p95 ms (section 2) | Wall p50 / p95 ms (fixed) |
|---|---|---|---|---|---|
| grac | 41 / 60 / 60 | 82 / 119 / 119 | 1.4 / 1.0 / 0.6 | 38 / 98 | 33 / 59 |
| grace | 40 / 60 / 60 | 80 / 119 / 119 | 1.3 / 1.0 / 0.5 | 32 / 44 | 33 / 39 |
| grace c | 35 / 60 / 60 | 70 / 119 / 119 | 5.8 / 5.8 / 5.4 | 45 / 62 | 30 / 40 |
| grace comm | 4 / 7 / 22 | 8 / 14 / 44 | 1.1 / 0.9 / 0.6 | 28 / 43 | 30 / 43 |
| gracee | 0 / 0 / 0 | 0 / 0 / 0 | 0.7 / 0.4 / 0.2 | 28 / 34 | 29 / 41 |
| first bapt | 56 / 60 / 60 | 112 / 119 / 119 | 1.7 / 0.9 / 0.6 | 30 / 42 | 32 / 57 |
| church | 60 / 60 / 60 | 119 / 119 / 119 | 2.4 / 2.0 / 1.7 | 38 / 75 | 30 / 39 |
| church dallas | 60 / 60 / 60 | 119 / 119 / 119 | 1.3 / 0.9 / 0.7 | 30 / 63 | 32 / 44 |
| baptist methodist | 0 / 0 / 0 | 0 / 0 / 0 | 1.4 / 1.1 / 0.8 | 29 / 33 | 32 / 41 |

"Fixed" means prefixes 1-8 with folding. In the three-region runs, wall p50 was 26-45 ms across all 36 queries. Almost all of that is the round trip, since SQL time was under 6 ms per rung before the fix and under 2.5 ms after it. A few fixed runs had p95 outliers of 247-389 ms with normal p50s, which looks like network or platform noise rather than query cost.

**`rows_read` doesn't measure FTS5 work.** It reports about two rows per returned result and misses the internal index reads: `baptist methodist` does real work and reports 0, and `grace c` costs about six times what `grace` does and reports about the same. It is useful for estimating the bill, at most 357 rows per keystroke, but not for finding slow queries. Monitor `meta.duration` instead.

## Scale: why the prefix change is required

35k rows can't show behavior at 588k, and rows read can't either. So I built a local model with `node:sqlite`, using the same schema and queries, and replicated the rows to 600,151 with shifted coordinates. It is a slowdown ratio, not a D1 measurement. Replication keeps vocabulary small, which makes common-word lists pessimistic. At 1x, D1 ranged from about level with local to 2.5x slower.

| Query | 1x total ms | 17x total ms | Ratio | Why |
|---|---|---|---|---|
| grace | 1.1 | 1.7 | 1.5 | Prefix index, stops early |
| first bapt | 1.6 | 2.6 | 1.7 | Prefix index, stops early |
| grace c | 21.6 | 387.6 | 18.0 | 1 character: no prefix index |
| church c | 13.2 | 227.5 | 17.2 | 1 character: no prefix index |
| church | 3.3 | 62.0 | 19.0 | 6 characters: no prefix index |
| first baptist | 1.8 | 62.8 | 34.1 | 7 characters: no prefix index |

Unfixed, a user typing `grace c` would hold the single D1 thread for about 390 ms or more. Every multi-word search passes through a one-character token, so this would be routine.

Candidate fixes at 17x, total ms for all three rungs ([`spike/local-variants.json`](spike/local-variants.json)):

| Prefix lengths | DB size | grace c | church c | church | first baptist | Worst of 17 |
|---|---|---|---|---|---|---|
| 2-5, folded | 210 MB | 367 | 267 | 66 | 22 | 367 |
| 2-8, folded | 229 MB | 208 | 150 | 0.7 | 1.8 | 208 |
| 1-5, folded | 230 MB | 2.4 | 1.0 | 37 | 14 | 37 |
| **1-8, folded** | **247 MB** | **1.6** | **0.7** | **0.5** | **1.6** | **7.9** |

Prefixes 1-8 add about 17% to the database. On real D1 at 1x, `grace c` fell from 17 ms to 4.5 ms of SQL per batch and from 38-44 to 79-91 batches per second, with no overload at 150 concurrent. Timings in this table vary between builds, so read the size of each difference rather than exact values. Prefixes over 8 characters still have no index. `presbyterian` and `evangelische` stayed under 2 ms because their lists are short, but a long, very common word could still be slow, so check for one in the golden set.

## Throughput

Concurrent batches from one isolate ([`spike/d1-burst.json`](spike/d1-burst.json), [`spike/d1-burst-fixed.json`](spike/d1-burst-fixed.json)).

| Concurrent | `grace`, section 2 | `grace c`, section 2 | `grace`, fixed | `grace c`, fixed |
|---|---|---|---|---|
| 10 | 82/s, p95 139 ms | 38/s, p95 270 ms | 72/s, p95 151 ms | 79/s, p95 135 ms |
| 50 | 135/s, p95 400 ms | 42/s, p95 1,236 ms | 102/s, p95 503 ms | 91/s, p95 558 ms |
| 100 | 127/s, p95 837 ms | 44/s, p95 2,499 ms | 119/s, p95 957 ms | 90/s, p95 1,111 ms |
| 150 | 113/s, p95 1,337 ms | overloaded | 121/s, p95 1,463 ms | 85/s, p95 1,796 ms |

- **Queueing is linear.** Beyond saturation, latency grows with queue length.
- **Overload is real and sticky.** `D1 DB is overloaded. Too many resources consumed within a 10 second window` appeared twice, both after sustained `grace c` load on the section 2 schema. The first time it kept failing most of a 17-query probe for several seconds afterward.
- **Capacity.** About 100 keystrokes per second is a useful planning number, before the edge cache. That is comfortable for a hackathon demo, and short of what a large site would need.
- **Not measured: read replicas.** They are in the plan as a mitigation, and were off here.

## Other lexical findings

Country-rung hits, capped at 60, on the section 2 schema:

| Query | Hits | | Query | Hits |
|---|---|---|---|---|
| kościół | 60 | | wrocław | 60 |
| koscioł | 60 | | wroclaw | **0** |
| kosciol | **0** | | münchen | 60 |
| kościol | **0** | | munchen | 60 |
| świętego | 60 | | muenchen | **0** |
| swietego | 60 | | straße / strasse | 1 / **0** |

Folding fixed `kosciol` on D1 and `wroclaw` in the local model. It doesn't fix `muenchen`, because `ue` for `ü` needs a query-side variant. That belongs in the golden set.

These still need the later pipeline steps, which this spike didn't build:

- `gracee` returns 0, so it depends on typo correction (step 3).
- `st mary` returns 0 / 4 / 21 and misses `saint`, so it needs St/Saint expansion.
- `church in dallas` was tested as `church` with Dallas cells and `church dallas`. The parser itself isn't built.

**One risk for the golden set.** Each rung returns the 60 most complete matches, and ranking only sees those. On a short common query at full scale, a low-completeness exact name can fall outside the cap. Add these cases to the golden set, and consider an exact-name rung if they fail.

### Trigram, for information only

| Measure | Result |
|---|---|
| Added size | 3.9 MB for 35k names, about 65 MB at full scale |
| `grac`, `race`, `chu` substring | 0.5-0.6 ms, 60 rows |
| `gr` | 0 rows, since it needs 3+ characters |
| `gracee` OR-of-grams, bm25 | 3.8 ms |
| `chrch` OR-of-grams, bm25 | 62.6 ms p50 at 35k rows |

Don't add it. Prefixes already cover typeahead, and substring match isn't something the design needs. The bm25 fuzzy form is too slow at 6% of the corpus, and without bm25 the results aren't ordered by similarity. The planned vocabulary approach to typos stands.

## bge-m3

**Dimensions: 1024,** from a real response (`shape: [1, 1024]`). Use 1024 when creating the Vectorize index.

**Single-query latency,** measured inside the Worker over 60 calls ([`spike/embed-latency.json`](spike/embed-latency.json)):

| p50 | p90 | p95 | Max | Over 400 ms |
|---|---|---|---|---|
| 264 ms | 519 ms | 571 ms | 656 ms | 15 of 60 (25%) |

That excludes Vectorize, which this spike didn't touch. A 400 ms budget would return `degraded:true` on at least a quarter of settled queries. Settled queries don't block typing, since lexical results are already on screen, so about 800 ms costs little. Re-check once Vectorize is measured.

**Embedding cost.** The section 2 text used 25.6 tokens per row (410,014 for TX). That is about 15M tokens for 588k rows, in line with the plan's estimate, though I didn't re-check the price and non-English names may differ.

## Embed-text A/B

16,018 TX rows, with brute-force cosine in memory instead of Vectorize. 18 scored queries; two more (`mormon church el paso`, `jehovahs witnesses corpus christi`) had no relevant row in the data and are reported but not scored. Raw data: [`spike/embed-ab.json`](spike/embed-ab.json).

- **Raw:** the full query is embedded, with no location filter.
- **Parsed:** the place is removed from the query and candidates are limited to 50 km, which is what the section 2 parser would do.

| Text | Mode | Hit@1 | Hit@5 | P@10 | MRR |
|---|---|---|---|---|---|
| Name only | Raw | 0.39 | 0.50 | 0.12 | 0.45 |
| Name + place | Raw | 0.56 | 0.72 | 0.28 | 0.64 |
| **Name + denomination + place (section 2)** | Raw | **0.72** | **0.78** | **0.34** | **0.76** |
| Name only | Parsed | 0.78 | 0.89 | 0.60 | 0.82 |
| Name + place | Parsed | 0.94 | 0.94 | 0.65 | 0.94 |
| **Name + denomination + place (section 2)** | Parsed | **0.94** | **0.94** | **0.74** | **0.94** |

**Result: keep the section 2 text.** It won or tied every aggregate metric. Parsing helped every arm, taking name only from 0.39 to 0.78 on hit@1, so the place parser matters at least as much as the embed text.

Limits on this result:

- It is a small set with relevance rules I wrote, for example denomination or name matches within 50 km of the place.
- Those rules can read the denomination field, which favors the arm that embeds it. Name + place, with no denomination, is the fairer comparison against name only, and it still wins.
- Not every query favored it. `spanish speaking church san antonio` (parsed) was better with name only, 0.5 against 0.3, and `grace comunity church dallas` (raw) was too, 0.2 against 0. Semantic search doesn't replace typo correction.
- `cowboy church fort worth` scored 0 in all arms, with one relevant row.

## Index size and import

| Measure | Result |
|---|---|
| D1 size, section 2 schema | 14.6 MB for 35,303 rows, including the row table |
| Projected at 588k | About 245 MB, or about 285 MB with prefixes 1-8 |
| Import | 3 files, 2.7 s of SQL time |
| `rows_written` | 2 per church. It doesn't count FTS5 internals, so don't use it to estimate write load. |

The plan's 87 MB figure was low, but this stays well within D1's limits. The production row table will be larger, since it holds the full autofill record.

## Not measured

- Vectorize. It wasn't created, per the milestone's scope.
- Read replicas, and latency from any colo other than MCI. Half the corpus is outside English-primary countries, and users far from ENAM will see a longer round trip. Measure this in milestone 2.
- D1 at full scale. The scale numbers are a local model. Re-run `scripts/spike/bench.mjs` after the full load.
- Search quality beyond these spot checks, which is what the golden set is for.

## Reproduce

Scripts are in [`scripts/spike/`](../../scripts/spike/). Baselines come from `scripts/snapshot-baseline.mjs`.

Baselines are in [`baseline-2026-11-05/`](baseline-2026-11-05/): 80 production responses across 20 queries, with no state and with TX, DEBY and PLWP. Worth noting for the eval:

- `grac`, `gracee`, `grace comm` and `first bapt` return 0 everywhere.
- `church in dallas` returns 0 without a state, and 100 with `state=TX`.
- Without a state, most zero-result queries took 15-21 s, and `lakewood` took 31 s.
- `grace` with `state=TX` returned 100 here, where the plan recorded 25.
