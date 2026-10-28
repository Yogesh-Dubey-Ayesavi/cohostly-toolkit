---
title: Request context
description: Find out who is visiting, where from and why they are allowed in, using facts the platform has signed.
nav: Request context
---

Every visit that reaches your app comes with a short description of the visitor, written by the platform. We call it the **context**. Anything unknown is simply missing.

## What arrives

| Group | Answers | Examples |
| --- | --- | --- |
| `request` | What is this request? | `request.id`, `request.time` (UTC), `request.protocol` (`http`, `websocket`, `sse`) |
| `caller` | Who or what is calling? | `caller.kind` (`person`, `machine`, `anonymous`, `platform`), `caller.id`, `caller.label` (a key's name), `caller.client`, `caller.name`, `caller.email`, `caller.avatar_url` |
| `access` | Why are they allowed in? | `access.how`, `access.role`, `access.account_id`, `access.account_role`, `access.scopes` |
| `place` | Where are they? | `place.country`, `place.city`, `place.time_zone`, `place.utc_offset`, `place.locale` |
| `device` | What are they using? | `device.type`, `device.browser`, `device.os` |

- `caller.name`, `caller.email` and `caller.avatar_url` are personal. They need the person's consent. When your app asked for one and the person does not share it, the value is `null` and a status next to it (for example `caller.email_status`) says `not_shared`. That lets you tell "not shared" from "never asked".
- `place.city` is a guess from the network. Say "around" or "approximate" if you show it. It is not given to machines unless you list it.
- The visitor's network address is never passed to your app.

### How much arrives: presets

Set `context.preset` in `cohostly.json`:

| Preset | Meaning |
| --- | --- |
| `none` | The least. Use it when the app does not care who visits. |
| `basic` | The default. |
| `friendly` | Adds the visitor's name, if they agreed to share it. The greeting sample uses this. |
| `full` | Adds the most, including the email, if they agreed to share it. A database row rule that matches on email needs this. |

`context.expose` adds individual fields on top of a preset. The platform keeps a reference that lists, for every field, which preset reveals it, who it applies to and whether it needs the person's consent. Ask for it when the question is "does my app get this field?".

## Checking it with the SDK

The platform sends the facts twice: as plain headers (`X-Platform-Caller-Email` and so on) and inside a signed token (`X-Platform-Context`). The token is valid for 5 minutes and tied to that one request. **Make decisions from the token, not the plain headers.** Anyone can send any header, but only a token that checks out against the platform's public keys is the platform's own statement.

```js title="One request" tab="One request"
import { context } from '@cohostly/sdk'

const ctx = await context(req.headers)      // undefined when there is no valid context
if (ctx?.caller.kind === 'person') {
  // ctx.caller.name may be null if the person has not shared it
}
```

```js title="One request" tab="Whole app"
import { middleware } from '@cohostly/sdk'

app.use(middleware({ required: false }))   // anonymous visitors are let through
// app.use(middleware({ required: true })) // refuse anyone without a valid context
// later: req.platform.caller, req.platform.access, ...
```

The SDK fetches the platform's public keys from `PLATFORM_AUTH_URL` and keeps them. It checks the signature, the expiry (allowing 30 seconds of clock difference), who issued it, and that it was issued for this app's address.

### Other helpers

| Function | What it does |
| --- | --- |
| `me()` | Asks the app's own `/__platform/me` route for the context as JSON. Useful for a single-page app that needs the current person on load. |
| `loginUrl(returnTo)` | Builds the address to send an anonymous visitor to, so they sign in and come back. Use it for a "Sign in" link. |
| `platformFetch(url, init)` | Calls another platform address with the right headers attached. |
| `appHost(request)` | The address the token must have been issued for, for code that checks tokens itself. |
| `verifyContextToken(token, options)` | The lower-level check, if you want to do it yourself. |

Paths under `/__platform/` belong to the platform. Only `session`, `logout`, `login` and `me` are answered there. Do not define routes of your own under it.

## Rules worth keeping

- **An anonymous visitor is normal.** Design the page for them too. "No context" is not a bug.
- **A missing field means unknown, not a default.** Do not show "Guest" as if it were a name the person gave.
- **Do not store what you learned as a credential.** Context is per request. Store only what the person chose to save, and say so in the app.
- **Do not log emails or locations.** The platform does not log them, and your app should not either.
- **Check roles on the server.** `access.role` is the caller's role on this project (`viewer`, `editor`, `admin`, `owner` or `machine`). Hiding a button is not a check.
- **Pass the token on.** When your app calls a binding on behalf of the visitor, the SDK forwards their context when the call happens inside a request handled by `middleware()`. Row rules and "act as the visitor" connections depend on that.

## Machines

A program with an access key arrives with `caller.kind` set to `machine`, `caller.label` set to the key's name and `access.scopes` listing what the key may do. See the `machine-access` sample app in [the overview](../examples/overview.md).
