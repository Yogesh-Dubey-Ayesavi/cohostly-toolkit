---
title: Ask before deleting
nav: Ask before deleting
description: An app that stops before doing something risky, asks a person, and carries on only if they say yes.
---

## What you will build

An app with a "purge" button that would delete every order older than 90 days. Before it does anything, it sends a plain sentence to a person: "Delete all orders older than 90 days". The person reads it in the dashboard and answers yes or no. The app only deletes if the answer is yes, and only exactly what the sentence said.

## What you need

- Node 20 or later, and the command line (`npm install -g cohostly`).
- The four files below. The delete itself is left as a comment for you to fill in.
- Someone who can answer in the dashboard: you, a project admin, or an owner or admin of the account.

## The files

```json title="package.json"
{
  "name": "approval-gate",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx server.ts",
    "types": "cohostly types --project approval-gate",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "@cohostly/sdk": "^0.2.1",
    "express": "^4.19.2",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "approval-gate",
  "health": { "port": 3000 },
  "bindings": { "approvals": { "enabled": true, "callback_path": "/__platform/hooks/approvals/decision" } }
}
```

```ts title="server.ts"
import express, { type Request, type Response } from 'express'
import platform from './platform.gen.js' // generated: run `npm run types`

const app = express()
const done = new Set<string>() // approval ids already acted on. In a real app keep these in the database: a restart empties memory.

async function purgeOldOrders(approvalId: string) {
  if (done.has(approvalId)) return // the callback can arrive more than once: acting twice must be harmless
  done.add(approvalId)
  // ... delete the rows the approver agreed to here ...
}

// The platform calls this path with the decision. The SDK checks it is really the platform and that the body is untampered.
app.post('/__platform/hooks/approvals/decision', platform.approvals.callback({
  handler: async (d) => {
    if (d.status === 'approved') await purgeOldOrders(d.id)
    // denied and expired mean: do nothing.
  },
}).express)

// Ask first, act later. The summary is exactly what the approver reads, so it says what will happen.
app.post('/purge', async (_req: Request, res: Response) => {
  const approval = await platform.approvals.request({
    summary: 'Delete all orders older than 90 days',
    details: { table: 'orders', older_than_days: 90 },
    risk: 'high',
    action: 'purge_orders',
    expiresIn: 3600,
  })
  res.status(202).json({ approval_id: approval.id, status: approval.status })
})

app.listen(Number(process.env.PORT) || 3000)
```

Add the same `tsconfig.json` as in [Private notes](./private-notes.md).

## What each part does

**`cohostly.json`** turns on the "may I?" service (the `approvals` binding) and names the one path of your app that receives the answer. The path `/__platform/hooks/approvals/decision` is the SDK's default, so you do not need to invent one.

**`POST /purge`** is the part that asks.

- `summary` is one plain sentence the approver reads as written. Say exactly what will happen, because the approval is for that and nothing else.
- `details` are the facts, shown as written.
- `risk` is `low`, `medium` or `high`.
- `action` is a short label (`purge_orders`) the project's rules can refer to.
- `expiresIn: 3600` gives the person one hour to answer. The range is 60 seconds to 7 days, and the default is 24 hours.
- The app then answers `202` ("accepted, not done yet") with the request's id. Nothing has been deleted.

**The callback.** When the person answers, the platform calls your app on the path above. It wakes the app if it was asleep. The SDK checks that the call really comes from the platform and has not been changed on the way, then runs your `handler`.

- The answer is `d.status`: `approved`, `denied` or `expired`. Only `approved` means go. Everything else means do nothing.
- `done` is the app's memory of requests it already handled. The platform may call twice, so the second time the app sees the id and stops.

> **Good to know** This sample keeps its list in memory, which a restart empties. In a real app, keep those ids in the small database, as the [morning summary](./morning-summary.md) does with run ids.

## Put it online

```sh
cohostly login
npm install
cohostly types --project approval-gate
cohostly deploy --project approval-gate
```

If `cohostly types` says it cannot find the project, deploy once first, then run it again.

## Try it

1. Send a request to `/purge`. The app answers `202` with an approval id and the status `pending`.
2. Look at what is waiting for you: `cohostly approvals needs-me`. Or open the dashboard's Approvals page.
3. Read it with `cohostly approvals show <id>`, then answer: `cohostly approvals approve <id>` or `cohostly approvals deny <id> --note "not today"`.
4. Watch the app's output with `cohostly logs approval-gate`. After "approve" the delete runs once. After "deny" nothing happens.

> **Good to know** Approval emails are not sent yet. The person answers in the dashboard or with the command line, so tell them to look there.

> **Good to know** A person decides, not the app and not an assistant. Anything that an AI assistant or a service key asked for has to be answered by a person in the dashboard.

## Make it yours

1. Ask for a smaller thing: change `summary` and `details` to describe something else, such as "Email the monthly update to 40 customers".
2. Give the person longer: `expiresIn: 86400` is one day.
3. Do not want a callback? Remove `callback_path` from `cohostly.json` and wait in the code instead: `const done = await approval.wait({ timeoutMs: 15 * 60_000 })`. Then check `done.status === 'approved'`. If the wait runs out, the request is still pending: keep its id somewhere safe and wait again later.

## If something goes wrong

- **It was approved but nothing happened.** Check the app's output (`cohostly logs approval-gate`). A handler that throws makes the platform try again, and your handler ignores ids it has already seen, so look for an error before the delete line.
- **Nothing shows up to approve.** The request may have expired, or been decided by someone else. `cohostly approvals history` shows what was decided.
- **The delete ran twice.** The handler must remember the id. Keep a list in the database, not in memory.
- **Not reaching the callback.** Make sure `callback_path` in `cohostly.json` matches the path in the code.

More on the service: [Approvals](../bindings/approvals.md). More on answering them: [Jobs and approvals](../cli/jobs-and-approvals.md).
