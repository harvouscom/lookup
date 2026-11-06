---
title: API
description: Search churches and read autofill records over plain HTTP. Open CORS, no key, no cookies.
---

Base URL `https://lookup.heresmychurch.com/v1`. Open CORS, no key, no cookies. Send a `client` name, such as your app's, so Here's My Church knows which tool is asking.

## GET /v1/search

Try it against the live API:

:::html
<div class="frame"><div class="frame-in play">
      <form id="play-form">
        <label class="sr" for="play-q">Query</label>
        <input id="play-q" type="text" value="grace comm" autocomplete="off" spellcheck="false">
        <button class="btn btn-dark" type="submit">send</button>
        <div class="opts">
          <label><input type="checkbox" id="play-settled"> settled=1</label>
          <label><input type="checkbox" id="play-geo" checked> geo=off</label>
        </div>
        <div class="url" id="play-url" aria-live="polite"></div>
      </form>
      <div class="status" id="play-status" aria-live="polite">send a request to the live api</div>
      <pre id="play-out" tabindex="0" aria-label="Response"><code>{}</code></pre>
    </div></div>
:::

| Parameter | What it does |
|---|---|
| `q` | What the person typed. Place words like "in Dallas" or ", TX" are understood. |
| `near`, `lat`, `lng` | Rank near a place or point. |
| `country`, `region` | Only return churches there. |
| `limit` | 1 to 50. Defaults to 8. |
| `settled=1` | The person paused, so semantic search may run. |
| `geo=off` | Don't use the request's approximate location. |

The response has `results`, plus `hasMore` when more churches ranked past `limit`. To show more, ask again with a higher `limit`: the first results stay in the same order. It also has `place` (the place understood from the query, or `null`), `corrected` (the spelling searched instead, or `null`), `degraded` and `semantic`.

## GET /v1/churches/:id

The autofill record. Every key in `fields` is always present, with `null` or `[]` when empty, plus `missing`, `completeness` and `hints`.

```bash
curl https://lookup.heresmychurch.com/v1/churches/CA-ON-56994145
```

## GET /v1/meta

Field names, what can be contributed and how it's reviewed, completeness weights, counts and attribution.

## POST /v1/churches/:id/contributions

Send corrections as `{ client, changes: [{ field, value }] }`. Each field comes back with its own status:

| Status | Meaning |
|---|---|
| `live` | Applied now. These fields go live on one vote. |
| `in_review` | Waits for a Here's My Church moderator. |
| `not_applied` | Accepted, but the listed value didn't change, such as when it was already the same. |
| `rejected` | Not accepted, with a `message` saying why. |
| `try_again` | A temporary problem, such as maintenance or a rate limit. Nothing was refused. |
| `coming_soon` | A field Lookup will accept soon. Name is coming soon. |

```bash
curl -X POST https://lookup.heresmychurch.com/v1/churches/CA-ON-56994145/contributions \
  -H "content-type: application/json" \
  -d '{"client":"lookup-demo","changes":[{"field":"phone","value":"905-555-0100"}]}'
```

:::tip Sandbox
Test with `client: "lookup-demo"`. Changes are checked the same way but never sent, and responses say `sandbox: true`.
:::

## POST /v1/churches/:id/confirm

"Still correct." Send `{ client }` to mark a listing as checked today.

## POST /v1/ask

Ask a question about these docs. Send `{ question }` (up to 500 characters) and the answer streams back as server-sent events. It powers the Ask AI button and is limited to 10 questions a minute.

## Errors

Errors are JSON with a readable `error` and a stable `code` to check in your code:

| Status | `code` |
|---|---|
| 400 | `invalid` |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 413 | `too_large` |
| 429 | `rate_limited` |
| 500 | `unavailable` |
| 503 | `overloaded` |

## Limits

120 requests and 30 semantic searches a minute per visitor, 5 contributions and 10 docs questions a minute. Over the limit returns `429`, a busy database returns `503`, and both send `Retry-After`, which browsers on any origin can read.
