---
title: How search works
description: Words first, then places, spelling and, only when words fail, meaning. And where AI is and isn't used.
---

1. **Words, as you type.** A full-text index finds names that start with what's typed: nearby first, then wider, then the whole country. Short forms count too: "1st", "bapt", "meth", "pres", "ch", and abbreviations like "umc", "fbc", "ame", "cogic", "sda" and "lds" match the words they stand for, and the other way round.
2. **Places.** "church in dallas", "grace, chicago", "first baptist TX" and "first baptist dallas tx" become a place filter. A lowercase state code like "tx" also finds churches in that state, but still works as the start of a word, so "grace co" keeps finding Grace Community. "nyc", "philly", "ft worth" and "n charleston" are understood, and so are postcodes where listings have them, mostly in Europe ("kirche 80331"; US listings don't carry ZIP codes yet). A lowercase "in" is never read as Indiana.
3. **Half-typed words and spelling.** When almost nothing matches, every word is tried as the start of a longer one, with "church" optional, so "first bap church dallas" finds First Baptist. Then the closest spelling is tried, so "gracee" finds Grace.
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

A formula, not AI, orders results.

- **When you give a place or a point** (a city in the search, or `lat`/`lng`), every church that matches all your words competes on one footing: about 40% how well the words match, 30% how near it is, 10% for being in the city you named, a bonus for an exact name, and a little for a complete listing. So "Calvary Chapel West Boca" 28 km away beats an exact "Calvary Chapel" 300 km away.
- **Otherwise** a better name match always comes first, then 60% name, 25% nearness to the visitor's approximate location, and 15% listing completeness.

## Where AI is used, and where it isn't

| Where | How |
|---|---|
| Semantic search | One AI model, bge-m3 on Cloudflare Workers AI and Vectorize, runs only when no name matches every word. On the held-out test it moved "in top 5" from 85% to 87% and "no results" from 1% to 0%. |
| Ask AI in these docs | An instruct model on Workers AI answers questions using only these docs, and links the pages it used. Questions aren't stored. |
| Ranking | A formula, not AI. |
| Church details | AI never writes or changes them. Every fill comes from Here's My Church, and every shared fix goes through its review rules. |
| Searches | Lookup doesn't log them. |
