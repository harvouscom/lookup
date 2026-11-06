# Overview

> Lookup is a church search box that fills in your form from Here's My Church. One script tag, an open API, no key.

Source: https://lookup.heresmychurch.com/docs

Church tools keep asking people for the same details. Lookup fills them in from [Here's My Church](https://heresmychurch.com), an open directory of 587,842 churches in 19 countries. Someone types a few letters, picks their church, and the address, website, phone and service times fill in.

## What you get

- [Quickstart](/docs/quickstart): Add the search box to a form in a few minutes, or hand the job to your agent.
- [See it in real apps](/docs/examples): A church management app, a nonprofit sign-up and a church website builder.
- [The widget](/docs/widget): Every attribute, event and form option, with a live preview.
- [API](/docs/api): Search and church records over plain HTTP, with open CORS and no key.

## How it works

1. **Search as you type.** Prefixes, typos and places like "church in dallas" all work, nearby churches first.
2. **Fill your form.** Pick a church and the empty fields you tagged with `data-hmc-field` fill in. Anything already typed is left alone.
3. **Share fixes back.** When someone corrects a detail Lookup filled, they can share it back to Here's My Church, one checked box at a time.

Because every pick comes from the same open directory, each app that uses Lookup helps keep church data accurate.

## Credits

- **[Here's My Church](https://heresmychurch.com)**, the open, crowd-sourced church directory every result comes from.
- **[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors**, whose map data many listings started from (ODbL).
- **[Cam Pak](https://cameronpak.com)** and **[Sensible UI](https://sensibleui.com)**. The widget reads the same design token names Sensible UI uses, so it fits right in on those pages.

Lookup was built for the AI for Church hackathon and is open source on [GitHub](https://github.com/harvouscom/lookup).
