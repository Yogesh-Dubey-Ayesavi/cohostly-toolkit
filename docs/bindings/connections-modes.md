---
title: Owner and visitor mode
description: "Whose account your app acts as: one shared account for everyone, or each visitor's own."
nav: Owner and visitor mode
---

Every connection has an `access` setting. It decides whose Google or Microsoft account the app acts as.

Picture a shared mailbox at an office front desk, and a row of personal mailboxes. In `owner` mode there is one shared mailbox and everyone who walks in uses it. In `user` mode each visitor has their own mailbox, and the app can only ever open the one that belongs to the person standing at the desk.

```json title="cohostly.json"
{
  "bindings": {
    "connections": {
      "sheet": { "provider": "google-workspace", "permissions": ["sheets.files"], "access": "owner" },
      "agenda": { "provider": "google-workspace", "permissions": ["calendar.read"], "access": "user" }
    }
  }
}
```

A mix is fine: the two connections above can sit in one manifest. Anything other than the word `user` is treated as `owner`.

## Owner mode

`owner` is the default. Every caller of the app acts through **one** connected account.

Use it for "every sign-up goes into my sheet", "the shop emails customers from the shop's address" or "a nightly job posts a summary".

How it works:

- An account owner or admin connects the Google or Microsoft account in the dashboard, under Connections.
- A project admin of the **same** account gives that connection to the tool (the binding). A connection from a different account cannot be used here.
- Each call looks up the one connection given to this tool. It needs no visitor, so it works from timers and jobs as well.
- Until someone has connected and given it, calls answer `403 no_grant`. This is a normal state. Show "not set up yet" and tell the owner to open Connections.

A grant is the record that says "this connection may be used by this tool, with these permissions". An owner binding has one grant. Connecting another account and giving it to the tool replaces the previous one.

> **Good to know** The rate limit counts per connection. In owner mode every visitor shares one connection, so they share one limit too. See [limits](connections-limits.md).

## Visitor mode

With `access: "user"`, each visitor connects their **own** account, and the app acts as that visitor.

Use it for "your agenda", "your to-dos live in your own sheet" or "read my inbox". Your app never runs a sign-in, never holds a token and never keeps a table of who connected what. The platform picks the right connection for each request.

How it works:

- A visitor connects on a page the platform provides, the first time they need it. The app sends them there with a link called `connect_url`. One page, one consent screen, done. The steps are in [connect, reconnect, switch and disconnect](connections-connect-flows.md).
- The platform finds the connection by three things together: this project, this tool name and this visitor. The connection of one visitor can never be used for another visitor, and a connection given to one project can never be used by another project.
- A visitor's own connection is given to the tool by that visitor, from the tool's connect page. An admin cannot pick someone else's account for them.
- The visitor must be signed in to Cohostly. The connection is kept under their Cohostly sign-in. Offer anonymous visitors a sign-in link instead (`loginUrl('/')` in the SDK).
- Nothing is shared between modes. A `user` tool can never reach the owner's connection, and the other way round.

### How the platform knows the visitor

The platform learns who is asking only from the signed request context, the header `X-Platform-Context`. It checks the signature, checks that the context was made for this project's address, and then requires a signed-in person. Anything else counts as nobody.

With the SDK this is automatic: a call made inside a request handled by `middleware()` forwards the context for you ([request context](../sdk/request-context.md)). If you call over plain HTTP, forward the header exactly as you received it ([calling the API](connections-calling-the-api.md#over-plain-http)).

A call with no verified person answers `401 caller_unknown`. That happens in three cases:

- The call was made outside a request, for example from a timer, a job, a webhook or at start-up. No visitor exists there.
- The call was made inside a request but without the middleware.
- The visitor is anonymous, not a signed-in person.

For background work, use an `owner` connection.

## What to do when the visitor is not connected yet

A first-time visitor is not an error. The call answers `409 connection_required` and includes a `connect_url`. Show a button, not a failure.

```js title="Handle a first-time visitor"
import { PlatformError } from '@cohostly/sdk'

try {
  events = await platform.connections.agenda.get({ path })
} catch (e) {
  if (e instanceof PlatformError && e.code === 'connection_required') return res.redirect(e.connectUrl)
  throw e
}
```

```py title="Handle a first-time visitor"
reply = requests.get(url, headers=headers, timeout=35)
if reply.status_code == 409:
    error = reply.json()["error"]
    if error["code"] == "connection_required":
        return redirect(error["connect_url"])
```

Better still, ask first with [`allowed()`](connections-allowed.md), then draw the right button for each state before making the real call.

> **Careful** Do not catch only `connection_required`. A person who disconnects later gets `410 connection_revoked` with no link in the error, and a person whose login expired gets `409 connection_needs_reauth`. Treat any state other than `active` from `allowed()` as "show a connect button".

## Building an app for many visitors

A multi-visitor app stores nothing about anyone. Follow these steps:

1. Mark each binding `access: "user"`.
2. Wrap every request in `middleware({ required: false })`. Use `required: true` if requests that did not come through the platform should be refused.
3. For each request, check that `req.platform?.caller?.kind === 'person'`. If not, show a sign-in link.
4. Call `allowed()` and show one of the states: connected (with the account name and a "use a different account" link), needs to be connected again (a reconnect button), or not connected (a connect button). All three buttons go to `connect_url`.
5. Also catch `connection_required` and `connection_needs_reauth` from the real calls. A connection can disappear between two calls.
6. Use a separate named binding for each provider, for example `google` and `microsoft`.
7. Set the app's sharing so the right people can open it: `link`, `public` or `signed_in`. A visitor needs a Cohostly account to connect ([sharing and roles](../settings/sharing-and-roles.md)).

[Worked examples](connections-examples.md) has this pattern in full.

## Who can do what

| Action | Who can do it |
| --- | --- |
| Connect an account to the project's account | An account owner or admin, signed in as a person. A service key is refused. An AI assistant cannot do it. |
| Give a connection to an owner tool | A project admin. The connection must belong to the same account as the project. |
| Take a connection away from a tool | A project admin. The account stays connected. Only this tool loses it. |
| Connect your own account for a `user` tool | Any signed-in visitor, from the tool's connect page. The grant is made for them automatically. |
| Disconnect an account | An account owner or admin, or the person who owns a personal connection. Calls then answer `connection_revoked`. |
| Pick files in Google's picker | An account owner or admin, or the person who owns the connection. Never an AI assistant, never the tool. |

Connections belong to an account, not a person. If you belong to several accounts, connect inside the account that owns the project. A connection made in a different account cannot be given to this project.

Next: [connect, reconnect, switch and disconnect](connections-connect-flows.md).
