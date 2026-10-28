---
title: Cron errors
description: "Every error the clock binding can give, when it happens and how to fix it."
nav: Errors
---

Errors come from three places: your app talking to the clock, a deploy, and the SDK on your own side. In the SDK, an error from the platform is a `PlatformError` with the status, a stable `code`, a plain message and a `howToFix` sentence.

## From the clock binding

| Status and code | Description |
| --- | --- |
| `400 invalid_schedule` | A schedule your app sent is not valid, or its version does not match. The first problem is in `message`, and all of them are in `how_to_fix`. Fix the schedule and restart the app. |
| `400 invalid_timer` | A timer's name, time or payload is not valid. A timer needs the name of a handler, a time that is in the future (and no more than 366 days ahead), and a payload of at most 8 KB. |
| `403 read_only_token` | A token that is not your running app's tried to send schedules or work with timers. This is what `cohostly dev` and access keys get. Only the running app can change schedules and timers. |
| `403 binding_not_declared` | The project has not declared `bindings.cron`. Add `"cron": { "code": true }` (or a schedule) to the settings file and deploy. |
| `401 invalid_token` | The binding token is missing or revoked. On the platform it is added for you. |
| `429 rate_limited` | Your project made too many binding calls in a minute. Slow down and honour `retry-after`. |
| `503 scheduler_unavailable` | The clock service could not be reached. Nothing changed. Try again. |

## At deploy

A bad schedule stops the deploy. The previous version stays live, and the message says what to change.

| Message | Description |
| --- | --- |
| Schedule gaps shorter than the minimum | The shortest gap between runs is below the platform minimum (15 minutes by default). Use a longer gap. |
| Timeout above the maximum | `timeout` is above the longest run the platform allows (30 minutes by default). Lower it. |
| Too many schedules | More than 20 in the project or 100 in the account. Remove some. |
| Name already used | The same `name` is in the settings file and in your code, or twice in one place. Rename one. |
| No time zone | There is no `time_zone` and your profile has none to fall back on. Add `time_zone`. |
| `when` not understood | The text is not a schedule the platform can read. The message names the problem, such as "no seconds field" or "add a time". See [schedules and syntax](cron-schedules-and-syntax.md). |
| A date that never happens | The cron rule asks for a day that does not exist, such as 31 February. |
| Both `http` and `command` | A `run` can hold only one. Remove one. |
| `run.http.path` under `/__platform` | That prefix belongs to the platform. Choose another path. |
| Code schedules never arrived | The project says `"code": true` but no schedule reached the platform within 90 seconds, or the app crashed first. Either remove `bindings.cron`, or make sure start-up code calls `platform.cron.schedule()` and the app starts cleanly. |

## In the SDK

These are thrown in your own process.

| Error | Description |
| --- | --- |
| Name missing or invalid | The schedule has no `name`, or it does not match the pattern. Give it a lower-case name with letters, digits, `_` and `-`. |
| Timer payload too large | The payload is over 8 KB. Store the data in your database and send only its id. |

## When your app answers a job call

These are not errors the platform sends. They are the answers your app gives, and what the platform makes of them. See [what your app receives](cron-what-your-app-receives.md).

| Your answer | Description |
| --- | --- |
| 401 or 403 | The platform's scheduler failed your own caller check, or the context could not be verified. Check that you verify `X-Platform-Context` and compare `caller.kind` and `caller.label` correctly. A 4xx is never retried. |
| 404 | No handler has that name. For code schedules, make sure the handler is registered when the app starts. A 404 is never retried. |
| 405 | The path got something other than `POST`. |
| 500 | Your handler threw. It is retried if you set `retries`. |

## Read next

- [Failures and history](cron-failures-and-history.md)
- [Limits](cron-limits.md)
