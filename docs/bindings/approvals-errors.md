---
title: Approval errors
description: "Every error code the approvals binding can answer with, what it means, and how to fix it."
nav: Errors
---

When a call to the approvals binding is refused, you get an error with a code you can test for. The body looks like this:

```json title="An error body"
{
  "error": {
    "code": "approval_rate_limited",
    "message": "…",
    "how_to_fix": "…"
  }
}
```

`message` says what happened. `how_to_fix` says what to do. In the SDK the call throws a `PlatformError` with `.status`, `.code`, `.message`, `.howToFix` and `.requestId`.

```js title="Test for a code"
import { PlatformError } from '@cohostly/sdk'

try {
  const approval = await platform.approvals.request({ summary: 'Delete 12 rows from orders' })
} catch (e) {
  if (e instanceof PlatformError && e.code === 'approval_rate_limited') return res.status(429).send('Too many asks. Try again in a minute.')
  throw e
}
```

```py title="Test for a code"
from platform_gen import platform, PlatformError

try:
    approval = platform.approvals.request({"summary": "Delete 12 rows from orders"})
except PlatformError as e:
    if e.code == "approval_rate_limited":
        return {"error": "Too many asks. Try again in a minute."}
    raise
```

## Errors from the binding

| Code | Type | Description |
| --- | --- | --- |
| `invalid_request` | 400 | **When:** the summary is not 1 to 500 characters, `details` is not an object, `risk` is not `low`, `medium` or `high`, `action` does not match the allowed pattern, or `expires_in` is not a whole number from 60 to 604800. **Fix:** correct the field named in the message. |
| `details_too_large` | 400 | **When:** `details` is over 16 KiB. **Fix:** send only what the approver needs, and refer to big data by name or id. |
| `callback_path_not_registered` | 400 | **When:** you sent a `callback_path` that differs from the manifest value, or none is registered. **Fix:** set `bindings.approvals.callback_path`, deploy, and leave `callback_path` out of the request. |
| `invalid_token` | 401 | **When:** the binding token is missing or revoked. **Fix:** send it in the `X-Platform-Binding-Token` header. It is the `PLATFORM_TOKEN` setting, and on the platform it is added for you. |
| `binding_not_declared` | 403 | **When:** the project did not declare approvals. **Fix:** add `bindings.approvals` to `cohostly.json` and deploy. |
| `approval_blocked` | 403 | **When:** an owner blocked this action, or the whole app, from asking. **Fix:** ask the owner to remove the block. Blocks can be changed only through the platform's API today. |
| `not_found` | 404 | **When:** the id is unknown, belongs to another project, or is not a valid id. **Fix:** use the id the request returned. |
| `idempotency_conflict` | 409 | **When:** you reused an idempotency key with a different summary or details. **Fix:** use a new key for a new request. |
| `not_pending` | 409 | **When:** you cancelled a request that was already decided. **Fix:** read its status with `get`. |
| `approval_rate_limited` | 429 | **When:** more than 10 requests in a minute from the project. **Fix:** wait a minute, and ask once per real action. |
| `too_many_pending` | 429 | **When:** 200 requests are already waiting. **Fix:** wait for answers, or cancel requests you no longer need. Retry after 300 seconds. |
| `rate_limited` | 429 | **When:** the project went over the shared limit for all bindings. **Fix:** slow down and honour the `retry-after` header. |
| `not_implemented` | 501 | **When:** the binding is declared but not available on your platform. **Fix:** contact whoever runs your platform. |

## Errors that only the SDK makes

These come from your own process, not from the platform. They have no HTTP status.

| Code | Type | Description |
| --- | --- | --- |
| `wait_timeout` | status 0 | **When:** `wait` ran out of time. The approval is **still pending**. **Fix:** wait again with the id, or use a callback. |
| `aborted` | local | **When:** the `AbortSignal` you passed fired. **Fix:** call `wait` again if you still need the answer. |
| `network_error` | local | **When:** the call could not reach the platform. **Fix:** retry, and check you are on the platform or running `cohostly dev`. |
| `not_configured` | local | **When:** there is no `PLATFORM_TOKEN`, so the app is not on the platform. **Fix:** run on the platform, or with `cohostly dev`. |

## What your callback route can answer

When the platform calls your `callback_path`, the SDK handler answers with these. The platform retries **every** answer that is not a 2xx. See [callbacks and waiting](approvals-callbacks-and-waiting.md).

| Status | Description |
| --- | --- |
| 405 | The call was not a `POST`. |
| 401 | The platform context or the signature is missing, wrong or too old. |
| 403 | The caller was not the platform. |
| 400 | The body had no `id`, `status` or `details_hash`. |
| 503 | The signing key could not be fetched. The platform will try again. |
| 500 | Your handler threw. The platform will try again. |

## Refusals people see

When a person answers in the dashboard or the CLI, a refusal uses one of these words. They are not codes your app receives.

| Word | Description |
| --- | --- |
| `not_found` | The request is gone or never existed. |
| `not_pending` | It was already decided, expired or cancelled. |
| `expired` | It ran out of time. |
| `not_eligible` | This person may not decide this request. |
| `already_decided` | This person already answered it. |
| `hash_mismatch` | What was on screen is no longer what the request says. |
| `superseded` | A newer request on the same thing replaced it. |
| `own_request` | The person asked for it, and someone else can decide. |
| `separation_of_duties` | It came from an AI assistant or service key, and the answer came through an assistant channel. |
| `signin_required` | A high-risk request needs a signed-in person. |
| `used`, `expired_link` | An email link was already used, or has run out. |
| `unknown` | Something else went wrong. |
