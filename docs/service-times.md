---
title: Service times
description: Edit a service-times field as rows of day, time and label, while it still submits one plain string.
---

Wrap a service-times field in `<church-service-times>` to edit it as rows of day, time and label, the same way Here's My Church does. The field keeps one plain string, such as `Sun 9:00 AM (Main Service); Wed 7:00 PM`, so it submits like any input.

:::html
<div class="frame"><div class="frame-in demo">
      <church-service-times label="Service times"><textarea aria-label="Service times">Sun 9:00 AM; Sun 11:00 AM (Contemporary); Wed 7:00 PM</textarea></church-service-times>
    </div></div>
:::

```html
<church-service-times>
  <textarea name="times" data-hmc-field="serviceTimes"></textarea>
</church-service-times>
<script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/service-times.js"></script>
```

When `<church-lookup>` fills a `serviceTimes` field inside `<church-service-times>`, the rows update with it.
