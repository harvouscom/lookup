# Lookup

The autofill for your church info: a church typeahead and autofill API, SDK and widget built on the [Here's My Church](https://heresmychurch.com) directory.

Early work. Lexical search is live at `https://hmc-lookup.harvous.workers.dev/v1/search?q=grac`. The address will change to `lookup.heresmychurch.com`.

| Path | Contents |
|---|---|
| `worker/` | Lookup API Worker |
| `packages/sdk/` | Client and `<church-lookup>` element |
| `site/` | Landing page and demo forms |
| `scripts/` | Index build and measurement tools |
| `eval/` | Baselines and results |

See [`eval/results/spike.md`](eval/results/spike.md) for the measurements behind the search design, and [`eval/results/milestone-2.md`](eval/results/milestone-2.md) for full-scale results and the eval.

Directory data includes OpenStreetMap contributors' data (ODbL) and contributions from Here's My Church users. Code is MIT.
