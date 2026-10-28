# Approvals

Read this when the app is about to do something a person should confirm first: delete rows, send money, email a customer list. The app asks; a person answers in the dashboard; the app continues or stops.

## Turn it on

```json
{ "bindings": { "approvals": { "enabled": true, "callback_path": "/__platform/hooks/approvals/decision" } } }
```

`callback_path` is the one path of your app that receives the decision. Leave it out to poll with `wait()` instead. The dashboard is where people answer; approval emails are not sent yet, so say that if the person expects one.

## Ask for one

```ts
import platform from './platform.gen.js'

const approval = await platform.approvals.request({
  summary: 'Delete 12 rows from the orders table',   // one plain sentence; the approver reads it as written
  details: { table: 'orders', rows: 12 },             // the facts, shown as written (up to 16 KiB)
  risk: 'medium',                                     // low | medium | high
  action: 'delete_rows',                              // a short key the project's rules can target
  expiresIn: 3600,                                    // seconds, 60 to 604800; default 24 hours
})
```

Write `summary` and `details` so the approver can decide without opening your code. Put exactly what will happen in them, because the approval is for that and nothing else.

## Get the answer

Two ways, and an app can use both. Polling never depends on the platform reaching you.

**Wait** (simple, good for a short request):

```ts
const done = await approval.wait({ timeoutMs: 15 * 60_000 })   // polls with backoff
if (done.status === 'approved') { /* do the thing */ }
```

`wait` throws `wait_timeout` if the time passes first. The approval is still pending, so call `platform.approvals.wait(id)` again later: keep the `id` somewhere that survives a restart.

**Callback** (the platform calls the app, and wakes it if it was asleep):

```ts
app.post('/__platform/hooks/approvals/decision', platform.approvals.callback({
  handler: async (d) => {            // d: { id, status, action, details_hash, decision_note }
    if (d.status === 'approved') await runDeletion(d.id)
  },
}).express)
```

The SDK checks that the call comes from the platform and that the body is untampered (an HMAC with the platform's signing key), then runs your handler. A handler that throws makes the platform retry. The callback can arrive more than once, so **make the handler safe to repeat**: remember the approval `id` you already acted on.

Statuses: `pending`, `approved`, `denied`, `expired`, `cancelled`. Treat everything except `approved` as "do not do it".

## Rules

- **Do the action only after `approved`**, and only the action the summary described. Do not reuse an approval for a different action.
- Pass an idempotency key (`request(input, { idempotencyKey })`) when a retry could ask twice.
- A connection can hold writes for approval by itself: `require_approval_for_writes: true` on the connection (see `bindings.md`). A held write answers `202` with an `approval_id`. Re-send the same request with the `X-Platform-Approval-Id` header once it is approved.
- A denied or expired request is a normal answer. Tell the person who asked what happened, plainly.

Worked example: `assets/examples/approval-gate/`.
