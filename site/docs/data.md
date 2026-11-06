# Data and review

> Where the data comes from, how often it syncs, and how fixes people share go back to Here's My Church.

Source: https://lookup.heresmychurch.com/docs/data

Lookup reads Here's My Church's reviewed listings and re-syncs changed regions every 5 minutes. Searches aren't logged, and approximate location is only used in memory to rank nearby churches.

> **Why fewer churches than Here's My Church shows?:** Its map counts every listing, about 655,000. Lookup leaves out about 68,000 that have no real name yet, such as "Unnamed church", since nobody can find those by typing. Once a listing gets a name on Here's My Church, the next sync adds it.

## Sharing fixes back

When someone changes a detail Lookup filled, the widget offers to share it. Changed fields start checked, each says whether it goes live or waits for a moderator, and nothing is sent until they choose **Share** (or submit your form with a checked [`data-hmc-share`](/docs/widget#share-on-submit) box). Your form's own submit is never blocked.

| Field | Where | Review |
|---|---|---|
| Service times, denomination, languages, ministries | Everywhere | Live on one vote |
| Phone | Everywhere | Live on one vote |
| Website | Everywhere | Waits for a moderator |
| Address (street, city and postal code, sent together) | Everywhere | Waits for a moderator |
| Email, pastor name | Everywhere | Always waits for a moderator, since a host's form can hold someone's personal details |
| Closed, duplicate or moved reports | Everywhere | Waits for a moderator |
| Name | Coming soon | Will wait for a moderator |

A change that goes live shows in Lookup's search and records within seconds, without waiting for the next sync.

"Still correct?" only appears for a listing nobody has confirmed in the last 12 months. Every chosen church also gets **Report a problem** (closed, duplicate, moved) and a link to fix anything else on its Here's My Church page.

Turn the offer off with `contribute="off"`, or cancel the `church-contribute` event to send changes yourself.

## Adding a missing church

When nothing matches, the "Add it" link opens Here's My Church's add form with the typed name filled in. If someone fills in your form without picking a church, the widget offers to add it with the name, address and other details they typed. If it looks like a church already listed, it asks "Is it one of these?" first; picking one selects it, and **None of these** adds the new one. A church added this way goes live right away and the widget's value becomes its new ID.

## Attribution

Church data from OpenStreetMap contributors (ODbL) and Here's My Church contributors. Search responses include this line as `attribution`; please show it near results you display yourself.
