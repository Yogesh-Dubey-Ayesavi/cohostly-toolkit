---
title: Asking what is allowed
description: "Use allowed() to learn whether a connection works, which permissions are in effect and where to send a visitor to connect."
nav: allowed() and connect_url
---

`allowed()` is a question you ask before you make the real call: "Is this connection ready, and what can I do with it?" It makes no call to Google or Microsoft. It only reads what the platform knows.

Use it to draw the right screen. A first-time visitor sees a Connect button. Someone who needs to sign in again sees a Reconnect button. Someone who is ready sees their data.

## Call it

```js title="Ask first"
const s = await platform.connections.agenda.allowed()

if (s.status === 'active') {
  // connected: s.account is the account name, for example an email
} else {
  // anything else: show a button that goes to s.connect_url
}
```

```py title="Ask first"
reply = requests.get(f"{base}/__allowed", headers=headers, timeout=35)
s = reply.json()

if s["status"] == "active":
    ...
else:
    ...  # show a button that goes to s.get("connect_url")
```

`allowed()` takes no arguments and returns an `Allowed` object (the type is generated for you). Over HTTP it is `GET` on the connection's address plus `/__allowed`, with the binding token.

In `user` mode it needs the visitor's context like any other call. Outside a request it answers `401 caller_unknown`, and it does the same for an anonymous visitor.

A connection that is not connected is **not** an error here. You get a normal answer with `status: "not_connected"`, never a 403 or 409. The real calls would answer `connection_required` or `no_grant`.

## The four states

| Status | Description |
| --- | --- |
| `active` | The connection works. Make the call. |
| `needs_reauth` | The provider no longer accepts the login. The person has to connect again. In `user` mode, send them to `connect_url`. In `owner` mode, the person who connected it does this under Connections. |
| `revoked` | Someone disconnected it. Calls answer `410 connection_revoked` until it is connected again. In `user` mode, `connect_url` is still there. |
| `not_connected` | Nobody has connected or given a connection to this tool yet. In `user` mode, send the visitor to `connect_url`. In `owner` mode, an owner has to connect it. |

Treat every state other than `active` as "this needs a connect button". The two states you will meet most are `not_connected` for a new visitor and `needs_reauth` for someone whose login lapsed.

## What comes back

| Field | Type | Description |
| --- | --- | --- |
| `connection` | string | The name of the connection, as in your manifest. |
| `provider` | string | The connector id, for example `google-workspace`. |
| `access` | `owner` or `user` | The mode. |
| `status` | string | One of the four states above. |
| `account` | string, optional | The name of the connected account, usually an email. Left out when not connected. |
| `permissions` | list | One entry for each permission your manifest declares, and only those. An empty list when not connected. See below. |
| `restrict_to` | list of strings, optional | Present only when the grant is narrowed to certain files ([picked files](connections-picked-files.md)). |
| `require_approval_for_writes` | true or false | True when your manifest or the grant holds writes for approval. Left out when not connected. |
| `connect_url` | string, optional | Where to send a visitor to connect. Only in `user` mode. Present in every state, even `active`. An `owner` connection never has one. |

Each entry in `permissions` looks like this:

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | The permission name, such as `calendar.read`. |
| `label` | string | The plain-words sentence the person saw. |
| `granted` | true or false | The person gave it to this tool. |
| `covered_by_scopes` | true or false | The provider's login covers it. |
| `effective` | true or false | Granted **and** covered. This is what calls can actually use. |

That is the three locks from [the overview](connections.md#three-locks-all-must-open), shown one permission at a time. If `effective` is false for something you need, the person has to reconnect and allow it, or the owner has to give it.

A not-connected answer looks like this:

```json title="A visitor who has not connected"
{
  "connection": "agenda",
  "provider": "google-workspace",
  "access": "user",
  "status": "not_connected",
  "permissions": [],
  "connect_url": "(the page to send them to)"
}
```

And a ready one:

```json title="A visitor who is connected"
{
  "connection": "agenda",
  "provider": "google-workspace",
  "access": "user",
  "status": "active",
  "account": "sam@example.com",
  "permissions": [
    { "name": "calendar.read", "label": "This lets your tool see your Google calendars and their events. It cannot change them.", "granted": true, "covered_by_scopes": true, "effective": true }
  ],
  "require_approval_for_writes": false,
  "connect_url": "(the page to send them to)"
}
```

## About connect_url

`connect_url` is the one page where a visitor connects: one page, the provider's own consent screen, and the connection is made and given to your tool for that visitor. Use the value exactly as you got it. It is built by the platform, so do not assemble it yourself. The steps the visitor goes through are in [connect, reconnect, switch and disconnect](connections-connect-flows.md#connect-as-a-visitor).

Use the same link for "Connect", "Connect again" and "Use a different account".

The link needs a signed-in Cohostly person. Send anonymous visitors to sign in first.

## Using it in an app

The [connect-accounts example](connections-examples.md#connect-accounts-many-visitors-two-providers) calls `allowed()` for each provider and draws a card for each state. The steps are:

1. Not signed in as a person? Show a sign-in link.
2. Call `allowed()`.
3. `active`: show the account name, then make the real call and show the data. Add a "Use a different account" link to `connect_url`.
4. `needs_reauth`: show a "Connect again" button to `connect_url`.
5. Anything else: show a "Connect" button to `connect_url`.
6. Also catch `connection_required` and `connection_needs_reauth` from the real call, in case the state changed in between.

Next: [holding writes for approval](connections-write-approval.md).
