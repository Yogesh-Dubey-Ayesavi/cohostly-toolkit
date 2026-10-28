---
title: Callbacks and waiting
description: "Learn the answer by waiting, or by being called back: the retry schedule, the signature check, and what to do while a request is open."
nav: Callbacks and waiting
---

After you ask, you need the answer. There are two ways, and an app can use both together. Checking by id never depends on the platform reaching your app.

| Way | Good for |
| --- | --- |
| **Wait** (also called polling) | Short waits, or when you have no path to receive calls. Your app asks again and again until the status changes. |
| **Callback** | Long waits. The platform calls **your** app when the answer is in, and wakes it if it is asleep. |

## Waiting

`wait` checks the request again and again, starting one second apart and doubling the gap up to 15 seconds. It returns as soon as the status is not `pending`.

```js title="Wait for the answer"
import { PlatformError } from '@cohostly/sdk'

try {
  const done = await approval.wait({ timeoutMs: 30_000 })   // keep it short; a visitor may be waiting
  if (done.status !== 'approved') return res.status(409).json({ status: done.status, note: done.decision_note })
  await sendReport()
  return res.json({ sent: true })
} catch (e) {
  if (e instanceof PlatformError && e.code === 'wait_timeout') {
    return res.status(202).json({ approval_id: approval.id, status: 'pending' })
  }
  throw e
}
```

```py title="Wait for the answer"
import time

def wait_for(approval_id, seconds=30):
    gap, end = 1, time.time() + seconds
    while time.time() < end:
        status = platform.approvals.get(approval_id)["status"]
        if status != "pending":
            return status
        time.sleep(gap)
        gap = min(gap * 2, 15)
    return "pending"
```

- You can also call `platform.approvals.wait(id)` when you only have the id.
- The default time-out is **15 minutes**. Pass `timeoutMs` to change it.
- If time runs out, `wait` throws a local `PlatformError` with the code `wait_timeout` (status 0). **The request is still pending.** Keep the id somewhere durable and wait again, or use a callback.
- If an `AbortSignal` you passed fires, it throws `aborted`.
- Python has no `wait`. The loop above is your own and uses the same 1 to 15 second spacing.

> **Careful** Do not wait for hours inside one web request. An idle app pauses, and a long open request is a poor way to hold a place. Prefer this: answer the visitor with `202`, store the id, and finish the work in the callback.

## Callbacks

Register a path in `cohostly.json` as `callback_path`. When a person decides, or the request expires, the platform sends a `POST` to that path. It goes through the public edge with a short-lived pass (valid 5 minutes) that works even if the app is private, and it wakes an app that is paused.

### The path is your choice

`/__platform/hooks/approvals/decision` is only a **convention**. The SDK has **no** default path. `platform.approvals.callback()` gives you a handler, and you mount it on the exact path you registered.

```js title="Mount the callback"
import express from 'express'
import platform from './platform.gen.js'

const app = express()
app.use(express.json())

app.post('/__platform/hooks/approvals/decision', platform.approvals.callback({
  handler: async (d) => {
    const [row] = await platform.data.$app.pending_actions.findMany({ where: { approval_id: d.id }, take: 1 })
    if (!row || row.state !== 'waiting') return          // unknown, or already handled: a repeat ends here
    await platform.data.$app.pending_actions.update({ where: { approval_id: d.id }, data: { state: d.status } })
    if (d.status !== 'approved') return                  // denied or expired: do nothing
    await purgeOrders(JSON.parse(row.params))            // act on what you stored, not on the callback body
    await platform.data.$app.pending_actions.update({ where: { approval_id: d.id }, data: { state: 'done' } })
  },
}).express)
```

The Python client has no callback helper. A hand-made handler is further down.

### What the platform sends

The body is JSON:

```json title="A callback body"
{
  "id": "2b0c0b2e-…",
  "status": "approved",
  "action": "purge_orders",
  "details_hash": "…",
  "decided_at": "2026-10-28T09:12:00Z",
  "decision_note": "Looks fine",
  "approvals": 1,
  "required": 1
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | text | The approval's id. |
| `status` | text | `approved`, `denied` or `expired`. **Never `cancelled`.** If your app or an owner cancels, no callback is sent, so a cancel is something you learn only by asking with `get`. |
| `action` | text | Present if your request had one. |
| `details_hash` | text | The fingerprint of what was asked. |
| `decided_at` | text | When the decision was made. |
| `decision_note` | text | Present if the approver wrote one. |
| `approvals`, `required` | whole number | Approving decisions received, and needed. |

The decision never names the approver.

These headers come with it:

| Header | Description |
| --- | --- |
| `X-Approval-Signature` | `t=<unix time>,v1=<hex signature>`. See below. |
| `X-Approval-Id` | The approval's id. |
| `Idempotency-Key` | `<id>:<status>`. The same decision always carries the same key. |

The platform removes any `X-Platform-*` headers that a caller sent and adds its own signed request context. For a callback, that context says the caller is the platform (`caller.kind` is `platform`, `caller.label` is `approvals`).

### Your reply

Answer with any **2xx** status within **60 seconds**. Anything else counts as a failure, including a time-out and a redirect (a 3xx is not followed).

### Retries

If an attempt fails, the platform tries again on this schedule, counted from the failed attempt:

| Try after | Wait |
| --- | --- |
| 1st failure | 10 seconds |
| 2nd failure | 30 seconds |
| 3rd failure | 2 minutes |
| 4th failure | 10 minutes |
| 5th failure | 30 minutes |
| After that | every 30 minutes |

Retries stop 24 hours after the decision. The real spacing is rounded up to the next minute, because the retry check runs once a minute. The first attempt is made right after the decision. If it cannot finish quickly, the next check delivers it.

After 24 hours the callback is marked `callback_failed`. A project admin can press **Retry** on the request in the dashboard, or call `POST /v1/approvals/<id>/callback/retry`. You can always read the real answer with `get`, so a failed callback never loses the decision.

Because the platform may deliver the same decision more than once, **make your handler safe to repeat.** The example above ignores a row that is not `waiting`. Use the approval `id`, or the `Idempotency-Key` header, to spot a repeat.

## Check the signature

Anyone who can reach your callback path could pretend to be the platform. The signature proves the call is real and untouched.

The SDK handler does all of this for you:

- It refuses anything but `POST` (405).
- It checks the platform's request context is present and that the caller is the platform (401 or 403).
- It needs a JSON body holding `id`, `status` and `details_hash` (400).
- It checks the signature (401). It answers 503 if it cannot fetch the signing key.
- Then it runs your handler. If your handler throws, the SDK answers 500 and the platform retries.

To do it by hand, for instance in Python:

1. Fetch the signing key from `GET $APPROVALS_URL/signing-key` (in Python, `platform.approvals.signingKey()["key"]`). It answers `{ key, algorithm: "hmac-sha256", header: "x-approval-signature", signed: "t.id.status.details_hash", tolerance_seconds: 300 }` and must not be cached by browsers. The key is per project and checks callbacks only.
2. Read the header. It must look like `t=<digits>,v1=<64 hex characters>`.
3. Refuse it if `t` is more than 300 seconds from your clock.
4. Compute HMAC-SHA256, using the key text as UTF-8 bytes, over the text `<t>.<id>.<status>.<details_hash>`, written as hex.
5. Compare it with `v1` using a constant-time comparison.

```py title="Check a callback by hand"
import hashlib, hmac, re, time
from fastapi import FastAPI, HTTPException, Request
from platform_gen import platform

app = FastAPI()
_key = {"v": None, "at": 0.0}

def signing_key() -> str:
    if not _key["v"] or time.time() - _key["at"] > 3600:
        _key.update(v=platform.approvals.signingKey()["key"], at=time.time())
    return _key["v"]

@app.post("/__platform/hooks/approvals/decision")
async def decision(request: Request):
    d = await request.json()
    m = re.fullmatch(r"t=(\d{1,12}),v1=([0-9a-f]{64})", request.headers.get("x-approval-signature", ""))
    if not m or abs(time.time() - int(m.group(1))) > 300:
        raise HTTPException(401, "The signature is missing or too old.")
    signed = f"{m.group(1)}.{d['id']}.{d['status']}.{d['details_hash']}".encode()
    want = hmac.new(signing_key().encode(), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, m.group(2)):
        raise HTTPException(401, "The signature does not match, so the decision was ignored.")
    # Look up d["id"] in your own table. If it is already handled, return 200.
    # If d["status"] == "approved", do the stored action.
    return {"ok": True}
```

```js title="Check a callback by hand"
import crypto from 'node:crypto'

function signatureOk(header, d, key) {
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? '')
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false
  const want = crypto.createHmac('sha256', key).update(`${m[1]}.${d.id}.${d.status}.${d.details_hash}`).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(m[2]))
}
```

For an app that is open to visitors, also check the platform's signed request context on this route, the same way you do for any other route, and make sure the caller is the platform. The SDK handler does that check for you. A hand-made handler like the Python one above must add it.

## While you wait

- **Save the id and what it was for** in your own database, keyed by the id. Act from that record.
- **After `approved`,** do only what the stored record says.
- **After `denied` or `expired`,** do nothing and tell the person who asked. After a `cancelled` you read with `get`, do the same.
- **Make the handler safe to repeat.**
- **Never log or return `PLATFORM_TOKEN`.**

> **Good to know** Waiting is the safer fallback. If a callback never reaches your app, the platform keeps retrying for 24 hours and your id still answers `get`. Do not rely on a background `wait` surviving a pause of your app. Store the id and check again later.
