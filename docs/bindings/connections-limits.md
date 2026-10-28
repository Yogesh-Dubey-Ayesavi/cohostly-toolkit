---
title: Connection limits
description: The rate, size and time limits on calls through a connection, and how long a consent link or an approval stays good.
nav: Limits
---

These limits are there to protect the person's account and the platform. Design your app so a normal day stays well inside them.

## How many calls

Calls are counted for each **connection**, each minute. Go over and the call answers `429 connection_rate_limited`, with a `retry-after` header that says how many seconds are left in the minute.

| Provider id | Calls per minute |
| --- | --- |
| `google-workspace` | 120 |
| `microsoft-graph` | 120 |
| `google-sheets` | 60 |
| `google-drive` | 60 |
| `slack` | 50 |

> **Good to know** The count belongs to the connection, not to the app. In `owner` mode every visitor shares one connection, so they share one limit. In `user` mode each person has their own connection and so their own limit.

Google and Microsoft also have limits of their own, which they set. If they answer with their own error, it comes back unchanged.

## How big

| Limit | Value |
| --- | --- |
| Request body, `google-workspace` | 5,000,000 bytes |
| Request body, `google-drive` | 5,000,000 bytes |
| Request body, `microsoft-graph` | 4,000,000 bytes |
| Request body, `google-sheets` | 2,000,000 bytes |
| Request body, `slack` | 1,000,000 bytes |
| Provider answer | 8,000,000 bytes (Slack: 1,000,000) |
| Path | 2,048 characters |
| Query string | 4,096 characters |
| Connection name | 32 characters |

A body that is too big answers `413 request_too_large`. An answer that is too big answers `502 response_too_large`. Ask for less: a smaller range, one page at a time.

## How long

| Limit | Value |
| --- | --- |
| One call to the provider | 30 seconds, then `504 upstream_timeout` |
| Redirects followed | 3 at most, `GET` and `HEAD` only |
| SDK retries | 2 more tries, on a network error, `429`, `502`, `503`, `504` |
| Consent link | Works once, and expires after 10 minutes |
| Starting a connect | 10 a minute for each person |
| An approval, once approved | Good for 1 hour, and for one use |

## How many permissions and files

| Limit | Value |
| --- | --- |
| Permissions on one grant | 1 to 40 |
| Files in `restrict_to` | 200, each up to 512 characters |

## Renewing logins

A login is renewed by the platform a little before it runs out, once at a time, so a burst of calls does not cause a burst of renewals. Calls that arrive in the middle wait up to 5 seconds for it. If a provider says no for good, the connection becomes `needs_reauth` ([reconnect](connections-connect-flows.md#reconnect)).

See also: [limits for the whole platform](../limits/limits.md).
