---
title: Cron limits
description: "Every number that limits schedules, runs, timers and history, in one place."
nav: Limits
---

These are the **current defaults**. The platform can change them, and they may differ for your account in future. Your deploy messages and the dashboard always show the numbers that apply to you.

| Limit | Description |
| --- | --- |
| Shortest gap between runs | 15 minutes by default. A schedule that could run sooner is refused at deploy. |
| Default run time | 10 minutes for one run, unless you set `timeout`. |
| Longest run time | 30 minutes by default. A `timeout` above it is refused at deploy. The platform has a hard ceiling of 2 hours that no setting can pass. |
| Schedules per project | 20. Only schedules in the live version count. |
| Schedules per account | 100. Only schedules in live versions count. |
| Runs a month | 3000 started runs per project, counted in UTC calendar months. Runs beyond that are recorded as `skipped` with the reason. Skipped and missed runs do not count. |
| History kept | 30 days. Older runs are deleted. Runs that are still queued or running are never deleted. |
| Waiting timers | 1000 per project. |
| Timer payload | 8 KB. |
| Timer reach | At most 366 days ahead, and no more than 1 minute in the past. |
| Retries | 0 to 5 per schedule. A timer gets none. |
| Misfire window | 1 minute to 24 hours. |
| Failures in a row | 10. After that the schedule is switched off. |
| Missed runs recorded | The latest 50 after an outage. |
| Calls to the platform | All bindings of a project share one rate limit of calls per minute. Slow down when you see a 429 answer and keep to the `retry-after` header. |
| Schedule text | `when` keeps the first 200 characters. A `run.command` is one line of up to 1000 characters. A `run.http.path` is up to 200 characters. |

## What happens at a limit

- **Too many schedules.** The deploy fails with a message that names the limit. Remove a schedule you no longer need, or combine two into one that takes a payload.
- **Gap too short or run too long.** The deploy fails and says which value to change.
- **Out of runs for the month.** The run is recorded as `skipped` and shows the reason. Look at `cohostly schedules runs` to see it. Runs resume at the start of the next UTC month.
- **Platform busy.** If the platform cannot start a sandbox for a command run right now, the run waits and shows a reason. It starts when there is room. If it waits past its misfire window, it is recorded as `missed`.

## How the numbers fit together

- A manual run with `cohostly run` counts toward the monthly total.
- The total is the number of runs started. The platform does not publish a separate count for retries, so leave a margin if you use `retries`.
- A schedule of `every 15 minutes` starts about 2,880 runs in a 30-day month. That fits in 3000 with little room for manual runs and retries. Use a longer gap when you can.

## Read next

- [Schedules and syntax](cron-schedules-and-syntax.md)
- [Failures and history](cron-failures-and-history.md)
