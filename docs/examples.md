---
title: Example apps
nav: Examples
description: Made-up apps built with Lookup, using the real widget and live data. A church management app, a nonprofit sign-up and a church website builder.
---

Each one is a made-up app using the real widget and live data, in demo mode so nothing you share is sent. They open full screen on the homepage.

:::html
<div class="excards"><div class="excard"><span class="excard-ic" aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="dk-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E2822"/><stop offset="1" stop-color="#15120F"/></linearGradient><clipPath id="dk-l"><circle cx="12.5" cy="16" r="7.4"/></clipPath></defs><rect width="32" height="32" rx="8" fill="url(#dk-bg)"/><circle cx="12.5" cy="16" r="7.4" fill="#D9472B"/><circle cx="19.5" cy="16" r="7.4" fill="#F1EBE2"/><circle cx="19.5" cy="16" r="7.4" fill="#7FC4A4" clip-path="url(#dk-l)"/></svg></span><span class="excard-t"><small>Church management</small><b>Kinship</b></span><span class="excard-d">Add a partner church in a React app. Built twice: once with the drop-in web component, once with the shadcn/ui registry component and React Hook Form.</span><span class="excard-tags"><i>React</i><i>React Hook Form</i><i>shadcn registry</i><i>Share panel</i></span><span class="excard-go"><a href="/#example/kinship">Web component<span aria-hidden="true"> →</span></a><a href="/#example/kinship/shadcn">shadcn/ui<span aria-hidden="true"> →</span></a></span></div><a class="excard" href="/#example/harvest"><span class="excard-ic" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#C8371D"/><g fill="none" stroke="#FFFBF1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h18M9.5 21v5M22.5 21v5M16 21v-7"/></g><path d="M16 15c0-3.8 2.5-6.3 6.8-6.3 0 3.9-2.7 6.3-6.8 6.3z" fill="#9BD07A"/><path d="M16 17c0-3-2.1-5-5.4-5 0 3.1 2.2 5 5.4 5z" fill="#E9A520"/></svg></span><span class="excard-t"><small>Food pantry network</small><b>Harvest Table</b></span><span class="excard-d">A plain HTML sign-up that registers churches as distribution sites and posts church_id.</span><span class="excard-tags"><i>Plain form</i><i>required</i><i>Service times</i></span><span class="excard-go">Open example<span aria-hidden="true"> →</span></span></a><a class="excard" href="/#example/steeple"><span class="excard-ic" aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="ds-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2FA86"/><stop offset="1" stop-color="#C3E83E"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#ds-bg)"/><path d="M16 8.5 21.5 14.5v11.5h-11V14.5z" fill="#0E0E0C"/><path d="M16 4.5v4.5M14.2 6.3h3.6" stroke="#0E0E0C" stroke-width="1.7" stroke-linecap="round"/><path d="M14.5 26v-3.4a1.5 1.5 0 0 1 3 0V26z" fill="#D2F25C"/><circle cx="16" cy="17" r="1.4" fill="#D2F25C"/></svg></span><span class="excard-t"><small>Website builder</small><b>Steeple</b></span><span class="excard-d">Pick a church and a live church homepage builds itself from its details.</span><span class="excard-tags"><i>Live preview</i><i>Service times</i><i>Theming</i></span><span class="excard-go">Open example<span aria-hidden="true"> →</span></span></a></div>
:::

## What each one shows

| Example | Shows |
|---|---|
| Kinship, web component | React controlled inputs, `church-select` and `church-clear` events, the share panel |
| Harvest Table | `name` and `required` in a plain form, service times feeding distribution hours |
| Steeple | Filling a live preview, `<church-service-times>`, theming to a product's own look |
| Kinship, shadcn/ui | `shadcn add` from the registry, `ChurchLookup` in a React Hook Form `FormField`, `ChurchConsent` |

Every example uses `client="lookup-demo"`, so corrections are checked but never sent to Here's My Church.
