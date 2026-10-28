---
title: Requesting from your app
description: "Ask for an approval from TypeScript, Python or plain HTTP: every field, the answer you get back, the statuses, cancelling, and safe repeats."
nav: Requesting
---

This page shows how your app asks for an approval, what comes back, and how to check or cancel it. For how to learn the answer, see [callbacks and waiting](approvals-callbacks-and-waiting.md).

## Ask in TypeScript

Generate the typed `platform` object once, and again whenever you change `cohostly.json` ([the platform object](../sdk/platform-object.md)).

```sh
cohostly types --project orders-admin
```

```js title="Ask for an approval"
import platform from './platform.gen.js'

const approval = await platform.approvals.request({
  summary: 'Delete all orders older than 90 days',
  details: { table: 'orders', older_than_days: 90 },
  risk: 'high',
  action: 'purge_orders',
  expiresIn: 3600,
})

// approval.id is what you keep. approval.status is "pending".
```

```py title="Ask for an approval"
from platform_gen import platform

approval = platform.approvals.request({
    "summary": "Delete all orders older than 90 days",
    "details": {"table": "orders", "older_than_days": 90},
    "risk": "high",
    "action": "purge_orders",
    "expires_in": 3600,   # snake_case in Python and over HTTP
})

# approval["id"] is what you keep. approval["status"] is "pending".
```

In Python, run `cohostly types --project orders-admin --lang python`. It writes `platform_gen.py`, which holds the `platform` object. The Python client has `request`, `get`, `cancel` and `signingKey`. It has no `wait` and no callback helper, so you check by `id` or verify the callback yourself.

## The fields you send

| Field | Type | Description |
| --- | --- | --- |
| `summary` | text | Required. One plain sentence saying exactly what will happen. It is trimmed, and must be 1 to 500 characters. |
| `details` | object | Optional. The facts the person needs, as a JSON **object**. An array or `null` is refused. It may be at most 16 KiB (16384 bytes) once written as JSON. Default `{}`. |
| `risk` | text | Optional. `low`, `medium` or `high`. Default `medium`. |
| `action` | text | Optional. A short key that rules can target, such as `purge_orders`. Lower-case letters, digits and `. _ : -`, starting with a letter or digit, 1 to 80 characters. |
| `expiresIn` | whole number | Optional. Seconds the request stays open, from 60 to 604800 (7 days). In Python and HTTP the name is `expires_in`. Default is the project rule's value, or 86400 (24 hours). |
| `callback_path` | text | HTTP only. Must equal the path registered in `cohostly.json`, or be left out. The TypeScript call does not take it. |

`details.quantity` is a number that only "Always allow" rules read. Without one, it counts as 1. See [who sees and answers](approvals-who-decides.md).

### The fingerprint

The reply carries a `details_hash`. It is a fingerprint of `action`, `summary`, `risk` and `details` together. An approver sends it back with their answer, so they are answering exactly what you wrote. Change any one of those and you have made a **different** approval: one changed byte, a new approval.

## What comes back

You get a handle. Over HTTP it is this JSON:

```json title="An approval"
{
  "id": "2b0c0b2e-…",
  "status": "pending",
  "summary": "Delete all orders older than 90 days",
  "action": "purge_orders",
  "risk": "high",
  "details_hash": "…",
  "created_at": "2026-10-28T09:00:00Z",
  "expires_at": "2026-10-28T10:00:00Z",
  "approvals": 0,
  "required": 1
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | text | The approval's id. Keep it somewhere durable. |
| `status` | text | One of the statuses below. |
| `summary`, `action`, `risk` | text | What you sent. `action` is left out if you sent none. |
| `details_hash` | text | The fingerprint described above. |
| `created_at`, `expires_at` | text | When it was made and when it stops being open. |
| `decided_at`, `decision_note` | text | Present once decided. The note is what the approver wrote, if anything. |
| `approvals` | whole number | Approving decisions so far. |
| `required` | whole number | Approving decisions needed. Default 1. |
| `callback` | object | Present if a path is registered: `{ path, status }`. `status` is `none`, `pending`, `delivered` or `failed`. |

Your app never sees who decided. The reply holds no approver's identity, and neither does a callback.

A pending request that has passed `expires_at` is reported as `expired` at once, even before the platform records it.

In TypeScript the handle also has `wait()`, `refresh()`, `cancel()` and `onDecision()`.

## Statuses

| Status | Description |
| --- | --- |
| `pending` | Waiting for an answer. |
| `approved` | Enough people approved. This is the only status that means "go ahead". |
| `denied` | Someone denied it. One denial denies the request at once. |
| `expired` | Nobody answered before `expires_at`. It is never approved afterwards. |
| `cancelled` | Your app cancelled it, an owner blocked the action, or (for platform kinds) the person who asked withdrew it. |

`cancelled` can be read with `get`, but it is **never sent in a callback**.

## Check or cancel by id

```js title="Check and cancel"
const now = await platform.approvals.get({ id: approval.id })
console.log(now.status, now.expires_at)

await platform.approvals.cancel({ id: approval.id })
```

```py title="Check and cancel"
now = platform.approvals.get(approval["id"])
print(now["status"], now["expires_at"])

platform.approvals.cancel(approval["id"])
```

Cancelling a request that is already decided fails with `not_pending`.

## Plain HTTP

Any language can call the binding. Send your app's binding token in the `X-Platform-Binding-Token` header. On the platform it is the `PLATFORM_TOKEN` setting. Never log it or send it to a browser.

```sh title="Raw HTTP"
curl -sS -X POST "$APPROVALS_URL" \
  -H "X-Platform-Binding-Token: $PLATFORM_TOKEN" \
  -H "Idempotency-Key: purge-orders-2026-10-28" \
  -H "content-type: application/json" \
  -d '{"summary":"Delete all orders older than 90 days","details":{"table":"orders"},"risk":"high","action":"purge_orders","expires_in":3600}'

curl -sS "$APPROVALS_URL/<id>" -H "X-Platform-Binding-Token: $PLATFORM_TOKEN"
curl -sS -X POST "$APPROVALS_URL/<id>/cancel" -H "X-Platform-Binding-Token: $PLATFORM_TOKEN"
```

| Call | Description |
| --- | --- |
| `POST $APPROVALS_URL` | Body `{summary, details?, risk?, action?, expires_in?, callback_path?}`. Optional `Idempotency-Key` header. Answers 200 with the approval. |
| `GET $APPROVALS_URL/<id>` | Answers 200 with the approval, or 404. |
| `POST $APPROVALS_URL/<id>/cancel` | Answers 200 with the cancelled approval, or 409 `not_pending` if it was already decided. |
| `GET $APPROVALS_URL/signing-key` | The key for checking callback signatures. See [callbacks and waiting](approvals-callbacks-and-waiting.md). |

A failed call answers with an error body holding a `code`, a `message` and a `how_to_fix`. Every code is on the [errors](approvals-errors.md) page. In the SDK, the call throws a `PlatformError`.

## Asking twice: idempotency

Idempotency means "asking twice has the same effect as asking once". It protects you when your app retries after a crash or a slow network.

- **Without a key,** every `request` makes a new approval. The SDK adds a random key to each call, but only so that its own network retries are safe.
- **With a key,** the platform remembers it for your project. The same key with the same summary and details returns the **original** approval. Over HTTP the reply carries the header `Idempotent-Replayed: true`.
- **Same key, different request:** a different summary or details fingerprint is refused with `idempotency_conflict`. Use a new key for a new request.

In TypeScript, pass the key as a second argument. Build it from the thing you are asking about, such as one ask per day:

```js title="Safe to repeat"
const approval = await platform.approvals.request(
  { summary: 'Delete all orders older than 90 days', details: { table: 'orders' }, risk: 'high', action: 'purge_orders' },
  { idempotencyKey: `purge_orders:${new Date().toISOString().slice(0, 10)}` },
)
```

Over HTTP, send the `Idempotency-Key` header. Keys are trimmed and only the first 200 characters count. Keys are unique per project, and no expiry for them is documented here, so treat a key as used for good.

> **Careful** The Python client **cannot set a key.** It makes a fresh random key on every call. To avoid asking twice in Python, store the approval `id` in your own database before you move on, or call the HTTP address yourself.

## Gotchas

- **Keep the id and what it was for.** Save the `id` together with the action and its inputs in your own database. When the answer arrives, act from what you stored, not from the callback body.
- **Do not hold a web request open for hours.** An idle app pauses. Answer the visitor with a `202`, store the `id`, and finish in the callback. See [callbacks and waiting](approvals-callbacks-and-waiting.md).
- **Ask once per real action.** Each project can make 10 requests a minute. See [limits](approvals-limits.md).
- **Your app does the action.** Approved does not mean done.
- **Held connection writes are a different flow.** A write held by a connection answers `202` and uses its own steps. See [write approval](connections-write-approval.md).
