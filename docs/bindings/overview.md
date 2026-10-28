---
title: Bindings
description: Services the platform lends your app, and the one rule that makes them safe.
---

A **binding** is a service the platform provides to your app. Your app says which ones it wants in `cohostly.json`. The platform then gives it an address and a token for each. The real keys for the provider behind a service never enter your app, so there is nothing in your code to leak.

Think of a hotel room with a phone. You can call room service, but you never get the kitchen's keys.

## What is available

| Binding | What it gives your app | Status |
| --- | --- | --- |
| [`ai`](ai.md) | Ask AI models questions, with a monthly spending cap. | Live |
| [`data`](data.md) | A small database for the project, with rules about who sees which rows. | Live |
| [`connections`](connections.md) | Use a person's Google or Microsoft account without ever holding their password or token. | Live for Google and Microsoft. Slack is not set up yet. |
| [`approvals`](approvals.md) | Ask a person to say yes before the app does something risky. | Live in the dashboard. Approval emails are not sent yet. |
| [`cron`](cron.md) | A clock that wakes your app and hands it a job at set times. | Live |
| `env.secrets` | Passwords and keys, delivered into the environment. | Live. See [secrets](../cli/secrets.md). |

## Turn one on

Say so in `cohostly.json`:

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "my-app",
  "bindings": {
    "ai": { "models": ["claude-haiku-5-5"], "monthly_cap_usd": 5 },
    "data": { "managed": true },
    "cron": { "code": true },
    "approvals": { "enabled": true }
  }
}
```

Then generate the typed `platform` object and import it:

```bash
cohostly types --project my-app
```

```js title="app.js"
import platform from './platform.gen.js'
```

Details are in [the platform object](../sdk/platform-object.md).

## Rules that stop the common mistakes

1. **Declare what you use.** A call to a binding the settings file does not declare fails.
2. **Do not hold the token.** Do not log it, hand it to a browser or write it to a file.
3. **Handle refusals.** A call can be refused: a spending cap reached, a rule said no, a person has not yet connected their account. These are normal answers. Show the plain message and stop. Do not loop.
4. **Do not go around.** If a call is refused for a policy reason, the policy belongs to the project's owner. Do not call the provider directly to get the answer.
5. **Local runs.** `cohostly dev --project my-app -- <command>` gives your machine the same addresses and a temporary token ([develop](../cli/develop.md)).

## Which one for what

- [Environment variables](environment.md): the variables the platform sets for each binding.
- A chatbot or summary: [`ai`](ai.md).
- Notes, orders, scores, anything kept per person: [`data`](data.md).
- Saving a form into a spreadsheet, reading a calendar: [`connections`](connections.md).
- Deleting, emailing a list, spending money: ask first with [`approvals`](approvals.md).
- A daily report, a reminder: [`cron`](cron.md).
