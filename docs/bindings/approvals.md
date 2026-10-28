---
title: Approvals
description: "Ask a person to say yes before your app does something risky, then carry on or stop depending on the answer."
nav: Approvals
---

Some actions should have a human nod first: deleting rows, spending money, emailing a customer list. With approvals, your app asks. A person answers. Your app then carries on or stops.

Think of a restaurant order slip. The waiter writes the order and hangs it in the kitchen window. The waiter does not stand there until the food is ready. They go and serve other tables, and the kitchen rings a bell when the slip is done. An approval works the same way. It is a **stored request**, not a paused app. Your app asks and gets an `id` back at once. The `id` is the slip number. Your app can stop there, keep working on other things, or come back later to check.

## How it works

1. Your app asks. The platform stores the request and gives your app an `id`.
2. The platform tells the people who may decide: in the dashboard, in the command line, by email, or in Telegram if they linked it, or through an AI assistant acting for them.
3. A person answers: approve or deny. If nobody answers in time, the request **expires**, and that counts as a no.
4. Your app finds out. Either the platform calls your app back (waking it if it is asleep), or your app checks by `id`.
5. **Your app does the action itself.** An approval is a yes or a no. It never runs anything for you.

> **Careful** Treat every answer except `approved` as "do not do it". That includes `denied`, `expired` and `cancelled`.

## When to use it

Use approvals when an action is hard to undo, costs money, or reaches other people. Good examples:

- Deleting or changing a lot of data.
- Sending an email to a list of customers.
- Anything an AI assistant decides on its own that you want a person to check.

Do not use approvals for steps that are safe and quick. Every request is something a person has to read.

## Turn it on

Declare `bindings.approvals` in `cohostly.json`, then deploy.

```json title="cohostly.json"
{
  "bindings": {
    "approvals": {
      "enabled": true,
      "callback_path": "/__platform/hooks/approvals/decision"
    }
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | true or false | Must be true or false if you send it. Any `approvals` object that does not set `enabled` to `false` counts as declared, so even `{}` turns the binding on. |
| `callback_path` | text | Optional. The one path on your app where the platform sends the answer. It must start with `/`, and it can be at most 200 characters. It is the only path the platform will ever call for decisions, and a request cannot name a different one. Leave it out if your app will check by `id` instead. |

Declaring the binding gives your app one setting:

| Variable | Description |
| --- | --- |
| `APPROVALS_URL` | The gateway's address for approvals, already ending in `/approvals`. Not secret. |

> **Good to know** `/__platform/hooks/approvals/decision` is a **convention**, not a default. The SDK does not mount any path for you. You mount the handler yourself on whatever path you registered. See [callbacks and waiting](approvals-callbacks-and-waiting.md).

## A first request

```js title="ask.js"
import platform from './platform.gen.js'

const approval = await platform.approvals.request({
  summary: 'Delete 12 rows from the orders table',   // one plain sentence, shown as written
  details: { table: 'orders', rows: 12 },            // the facts, shown as written
  risk: 'medium',                                    // low, medium or high
  action: 'delete_rows',                             // a short key that rules can target
  expiresIn: 3600,                                   // seconds, 60 to 604800. Default 24 hours
})

console.log(approval.id, approval.status)            // "pending"
```

Write `summary` and `details` so a person can decide without opening your code. The approval covers exactly that and nothing else. The next page covers every field, the Python and plain HTTP versions, and the answer you get back.

## Where to go next

- [Requesting from your app](approvals-requesting-from-your-app.md): every field, the request and response shapes, statuses, cancel and idempotency, in TypeScript, Python and plain HTTP.
- [Callbacks and waiting](approvals-callbacks-and-waiting.md): wait for the answer, or be called back. The retry schedule and how to check the signature.
- [Approval kinds](approvals-kinds.md): the five kinds, who may decide each, how long each stays open, and what happens on approve, deny and expire.
- [Who sees and answers](approvals-who-decides.md): the people, the channels, high-risk requests, "Always allow" rules and the pieces that have no screen yet.
- [Limits](approvals-limits.md): sizes, rates and time limits in one table.
- [Errors](approvals-errors.md): every error code and its fix.
- [Ask before deleting](../examples/ask-before-deleting.md): a small app that uses this binding from start to finish.
