---
title: Data and review
nav: Data and review
description: Where the data comes from, how often it syncs, and how fixes people share go back to Here's My Church.
---

Lookup reads Here's My Church's reviewed listings and re-syncs changed regions every 5 minutes. Searches aren't logged, and approximate location is only used in memory to rank nearby churches.

:::note Why fewer churches than Here's My Church shows?
Its map counts every listing, about 655,000. Lookup leaves out about 68,000 that have no real name yet, such as "Unnamed church", since nobody can find those by typing. Once a listing gets a name on Here's My Church, the next sync adds it.
:::

## Sharing fixes back

When someone changes a detail Lookup filled, the widget offers to share it. Changed fields start checked, each says what will happen to it ("Goes live", "Checked automatically" or "The church reviews this"), and nothing is sent until they choose **Share** (or submit your form with a checked [`data-hmc-share`](/docs/widget#share-on-submit) box). Your form's own submit is never blocked.

**Claimed listings come first.** When a church has claimed its listing on Here's My Church (verified its listed inbox), everyone else's changes go to the church to review. The record says `claimed: true`, and each held change comes back with `reviewBy: "church"`.

**Filling a blank field** goes live on one vote, with an automatic spam check afterwards. Email and pastor name are the exception: from Lookup they're always held, since a host's form can hold someone's personal details.

**Replacing a value that's already listed**, or reporting a problem, is held and checked automatically by Here's My Church:

| Field | Approved when | Otherwise |
|---|---|---|
| Phone, service times | It appears on the church's own website, two or more people independently send the same value, or after three quiet days | A Here's My Church reviewer decides |
| Denomination, languages, ministries (additions only) | People agree, it passes the naming rules, or after three quiet days | A Here's My Church reviewer decides |
| Name, website, address (street, city and postal code, sent together) | There's evidence: the church's own website, a small spelling fix to a name, an address within 150 m of the map pin | A Here's My Church reviewer decides |
| Email, pastor name | There's evidence, such as the church's own website | A Here's My Church reviewer decides |
| Closed or duplicate reports | Strong evidence. The listing is hidden, not deleted, so it can come back | A Here's My Church reviewer decides |
| Moved reports | Never automatically | A Here's My Church reviewer decides |

Name corrections are coming soon through Lookup. The checks never let AI approve anything: where they read the church's website, an AI model only points to the sentence that should hold the value, and code confirms that the quote is really on the page and contains the value. `/v1/meta` lists each field with `checks`: `"automatic"`, `"automatic-then-reviewer"` or `"reviewer"`.

A change that goes live shows in Lookup's search and records within seconds, without waiting for the next sync.

"Still correct?" only appears for a listing nobody has confirmed in the last 12 months. Every chosen church also gets **Report a problem** (closed, duplicate, moved) and a link to fix anything else on its Here's My Church page.

Turn the offer off with `contribute="off"`, or cancel the `church-contribute` event to send changes yourself.

## Adding a missing church

When nothing matches, the "Add it" link opens Here's My Church's add form with the typed name filled in. If someone fills in your form without picking a church, the widget offers to add it with the name, address and other details they typed. If it looks like a church already listed, it asks "Is it one of these?" first; picking one selects it, and **None of these** adds the new one. A church added this way goes live right away and the widget's value becomes its new ID.

## Attribution

Church data from OpenStreetMap contributors (ODbL) and Here's My Church contributors. Search responses include this line as `attribution`; please show it near results you display yourself.
