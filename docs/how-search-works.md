---
title: How search works
description: Words first, then places, spelling and, only when words fail, meaning. And where AI is and isn't used.
---

1. **Words, as you type.** A full-text index finds names that start with what's typed: nearby first, then wider, then the whole country.
2. **Places.** "church in dallas", "grace, chicago" and "first baptist TX" become a place filter. A lowercase "in" is never read as Indiana.
3. **Spelling.** When almost nothing matches, the closest spelling is tried, so "gracee" finds Grace.
4. **Meaning, only when words fail.** If no result matches every word, a settled query also asks semantic search (bge-m3 in Cloudflare Vectorize). Those results always rank below real name matches.

## How it compares

78 held-out test queries we didn't tune on, against Here's My Church's search today:

| System | Top result right | In top 5 | No results | Typical time |
|---|---|---|---|---|
| Today's search | 28% | 31% | 41% | 20 s |
| Lookup, words only | 78% | 85% | 1% | 150 ms |
| Lookup, with semantic | **78%** | **87%** | **0%** | 170 ms |

Semantic search helped two queries in 78 and hurt none. It doesn't fix translations such as "trinity church munich", and common names with no location stay hard. [Full write-up](https://github.com/harvouscom/lookup/tree/main/eval/results).

## Ranking

A formula, not AI, orders results: 60% how well the name matches, 25% how near the church is, and 15% how complete its listing is. That's why complete listings rank higher.

## Where AI is used, and where it isn't

| Where | How |
|---|---|
| Semantic search | One AI model, bge-m3 on Cloudflare Workers AI and Vectorize, runs only when no name matches every word. On the held-out test it moved "in top 5" from 85% to 87% and "no results" from 1% to 0%. |
| Ask AI in these docs | An instruct model on Workers AI answers questions using only these docs, and links the pages it used. Questions aren't stored. |
| Ranking | A formula, not AI. |
| Church details | AI never writes or changes them. Every fill comes from Here's My Church, and every shared fix goes through its review rules. |
| Searches | Lookup doesn't log them. |
