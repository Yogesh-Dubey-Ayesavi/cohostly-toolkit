---
title: Approval limits
description: "Sizes, rates and time limits for approvals in one place."
nav: Limits
---

These are the limits you can hit when you use approvals. Going over a size limit is refused with `invalid_request` or `details_too_large`. Going over a rate limit is refused with a `429`. Every code is on the [errors](approvals-errors.md) page.

## Request size

| Limit | Description |
| --- | --- |
| `summary` | 1 to 500 characters, trimmed. |
| `details` | A JSON object, at most 16 KiB (16384 bytes) once written as JSON. |
| `action` | 1 to 80 characters. Lower-case letters, digits and `. _ : -`, starting with a letter or digit. |
| `callback_path` | Starts with `/`, at most 200 characters. |
| `Idempotency-Key` | Trimmed, and only the first 200 characters count. |

## Time

| Limit | Description |
| --- | --- |
| Open time (`expiresIn`) | 60 seconds to 604800 seconds (7 days). Default 24 hours for app actions, unless the project rule says otherwise. |
| Platform kinds | Deploy, make public and spend or limit raise stay open for 7 days. |
| `wait` | Default time-out 15 minutes. Gap between checks starts at 1 second and doubles to 15 seconds. |
| Callback reply | A 2xx within 60 seconds. |
| Callback retries | 10 seconds, 30 seconds, 2 minutes, 10 minutes, 30 minutes, then every 30 minutes, until 24 hours after the decision. |
| Callback pass | Valid for 5 minutes. |
| Signature age | 300 seconds either side of your clock. |
| Expiry check | Runs every minute, so an expiry callback goes out within about a minute. |
| Reminder | One, when a quarter of the time is left, at most 6 hours before the end. |
| Email link | Single use, lasts up to 24 hours or until the request expires. |
| Delegation | At most 30 days. |
| Always allow rule | 1 to 90 days. |

## Rates

| Limit | Description |
| --- | --- |
| Requests from an app | 10 per minute, per project. Over it: `approval_rate_limited`, retry after 60 seconds. |
| Open requests | 200 pending at once, per project. Over it: `too_many_pending`, retry after 300 seconds. |
| Platform kinds | 10 per kind, per project, per hour. Platform-made requests are not held to the 10 per minute. |
| All bindings together | The platform keeps one rate limit for all binding calls from a project. The enforced default is 600 a minute, with `x-ratelimit-*` headers and a `429` `rate_limited` when you go over it. Your platform may set a different value. |

## People

| Limit | Description |
| --- | --- |
| Approvers needed | 1 to 5. The default is 1. |
| Bulk decision | At most 25 requests, low-risk app actions only, all of one kind. |

Email volume is not limited yet.
