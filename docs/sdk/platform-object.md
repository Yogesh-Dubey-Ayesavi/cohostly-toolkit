---
title: The platform object
description: Typed methods for every service your app declared, with retries, timeouts and plain errors built in.
nav: Platform object
---

When your app declares a [binding](../bindings/overview.md) in `cohostly.json`, the SDK can give you a `platform` object with one group of methods per binding. You do not write web requests by hand.

## Generate it

```bash
cohostly types --project my-app
```

This writes `platform.gen.ts` (and `platform.contract.md`, a readable list of what you can call). Import it:

```js title="app.js"
import platform from './platform.gen.js'

const reply = await platform.ai.messages({
  model: 'gemini-3.5-flash-lite',
  messages: [{ role: 'user', content: 'hi' }],
})
```

Commit `platform.gen.ts`. Regenerate it after you change `cohostly.json` or a database migration. In CI, `cohostly types --project my-app --check` fails when the file is out of date.

If a call is not in the generated file, your code cannot use it, and `cohostly deploy` checks your code against it before building.

## What the object does for you

| Behaviour | Detail |
| --- | --- |
| Token | Reads `PLATFORM_TOKEN` and sends it. You never handle it. |
| Request ids | Each call carries an id, so a problem can be traced. |
| Safe repeats | Approval requests accept an `Idempotency-Key`: the same key with the same request returns the first result instead of making a second one. For other writes, do not count on the platform to drop repeats; make your own code safe to run twice. |
| Timeouts | 30 seconds per attempt by default (`timeoutMs`). |
| Retries | Two extra attempts for network errors and for status 429, 502, 503 and 504 (`retries`). |
| Errors | Anything else throws a `PlatformError`. |

You can build your own with `createPlatform(routes, options)` if you need different timeouts or a test `fetch`.

## Handling errors

```js title="errors.js"
import { PlatformError } from '@cohostly/sdk'

try {
  await platform.data.notes.create({ data: { id, user_id, body } })
} catch (e) {
  if (e instanceof PlatformError) {
    // e.status   the HTTP status
    // e.code     a stable name, such as 'invalid_request' or 'connection_required'
    // e.message  a plain sentence you can show
    // e.howToFix what to do about it
    // e.requestId, e.details, e.connectUrl (for a connection that needs connecting)
    return res.status(502).json({ error: e.message })
  }
  throw e
}
```

Show the message and stop. Do not retry every error: retrying a refused call (a cap reached, a rule that said no) only repeats the refusal. If a call is refused for a policy reason, the policy belongs to whoever owns the project. Do not reach around it by calling the provider directly.

## The groups

| Group | For |
| --- | --- |
| `platform.ai` | Asking AI models. See [AI](../bindings/ai.md). |
| `platform.data` | A small database, one entry per table. See [data](../bindings/data.md). |
| `platform.connections.<name>` | A person's Google or Microsoft account. See [connections](../bindings/connections.md). |
| `platform.approvals` | Asking a person to confirm. See [approvals](../bindings/approvals.md). |
| `platform.cron` | A clock. See [the clock](../bindings/cron.md). |

## Rules

- **Declare what you use.** A call to a binding the settings file does not declare fails. Add it, then regenerate.
- **Do not hold the token.** Do not log it, return it to a browser or save it to a file.
- **Values the settings limit are part of the contract.** For example, a model not listed under `bindings.ai.models` fails with a plain message. The fix is to change the settings, which is the owner's decision.
