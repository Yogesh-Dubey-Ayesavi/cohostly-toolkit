---
title: Schedules and syntax
description: "The fields of a schedule, the times you can write in `when`, how time zones work, and every option."
nav: Schedules and syntax
---

This page covers a schedule in the settings file. A schedule defined in code takes the same options ([code-defined schedules](cron-code-and-timers.md)).

## A full schedule

```json title="cohostly.json"
{
  "bindings": {
    "cron": {
      "schedules": [
        {
          "name": "daily-report",
          "when": "every weekday at 9:00",
          "time_zone": "Asia/Kolkata",
          "run": { "http": { "path": "/jobs/daily-report" } },
          "timeout": "10m",
          "overlap": "skip",
          "retries": 2,
          "misfire": "15m",
          "catch_up": "latest",
          "fresh_sandbox": true,
          "exact": false
        }
      ]
    }
  }
}
```

Only `name`, `when`, `run` and (usually) `time_zone` are needed. The rest have defaults.

| Field | Type | Description |
| --- | --- | --- |
| `name` | text | Required. Lower-case letters, digits, `_` and `-`, 1 to 63 characters, starting with a letter or digit. No dots. It is the job's identity across versions, and it must be unique across your settings file and your code. |
| `when` | text | Required. When to run. See below. Only the first 200 characters are kept. |
| `time_zone` | text | An IANA zone name such as `Asia/Kolkata`, `America/New_York` or `UTC`. Required unless your profile has a zone. See below. |
| `run` | object | Required. Exactly one of `{ "http": { "path": "..." } }` or `{ "command": "..." }`. Giving both is an error. |
| `run.http.path` | text | A path in your app that starts with a single `/`, has no spaces, is at most 200 characters, and is **not** under `/__platform`. |
| `run.command` | text | One line, 1 to 1000 characters, no line breaks. |
| `timeout` | text or number | How long one run may take. Write `"90s"`, `"10m"`, `"2h"`, `"1h30m"`, or a number of seconds. Default 10 minutes. A value above the allowed maximum is an error at deploy. See [limits](cron-limits.md). |
| `overlap` | text | What to do if the last run is still going: `skip` (default), `queue` or `allow`. |
| `retries` | whole number | 0 to 5 more tries after a failure. Default 0. |
| `misfire` | text | How late a run may be and still start, from 1 minute to 24 hours. Default: half the shortest gap between runs, but never less than 1 minute and never more than 15 minutes. |
| `catch_up` | text | `"latest"` runs the newest missed time once after an outage. Leave it out to run none of them. |
| `fresh_sandbox` | true or false | Whether each command run gets a brand-new sandbox. Default: yes for a project that keeps no files between starts, no for a project with `storage.stateful`. |
| `exact` | true or false | Start right on the minute, with no random delay. Default false. |

> **Good to know** `cohostly manifest check` applies the shape rules only (for example a 1-minute minimum and a 2-hour maximum). The plan limits, such as the 15-minute minimum gap and the 30-minute maximum run, are checked when you deploy. A bad schedule stops the deploy with a plain message and the previous version stays live.

## Writing `when`

Use plain English or a five-field cron expression. Capital letters, extra spaces and a trailing dot do not matter.

### Plain English

```text
every minute
every 15 minutes
every hour
every 6 hours
every day at 8:30
every weekday at 9:00
every weekend at 10:00
every Monday at 10:00
on the 1st of each month at 07:00
every day at 6:45 pm
every day at 9am
```

What each form allows:

- `every N minutes`: N must divide 60 evenly, so 1, 2, 3, 4, 5, 6, 10, 12, 15, 20 or 30. `every 7 minutes` is refused with a hint, because the gaps would not be even across the hour.
- `every N hours`: N must divide 24 evenly, so 1, 2, 3, 4, 6, 8 or 12. These run at minute 0.
- `every day at ...`, `every weekday at ...` (Monday to Friday), `every weekend at ...` (Saturday and Sunday), and `every Monday at ...`. Day names can be written in full or with three letters.
- `on the 1st of each month at ...`: any day from 1 to 31. `every month` also works.
- A time is `H` or `H:MM`, optionally followed by `am` or `pm`. So `9:00`, `18:45`, `8:30 pm`, `9am` and `9 pm` are all fine. Minutes are 00 to 59.

### Five-field cron

```text
0 9 * * 1-5
*/15 * * * *
30 2 1 * *
```

The five fields are minute, hour, day of the month, month, day of the week. You can use ranges (`1-5`), lists (`1,15`), steps (`*/15`), and month and day names. Sunday is 0 or 7.

If you restrict **both** the day of the month and the day of the week, a day matches when **either** one matches. That is how cron has always worked, and it surprises people. `0 9 1 * 1` runs on the 1st of the month **and** on every Monday.

### What is refused

- Six or more fields. There is no seconds field.
- `every N seconds`. The clock checks once a minute.
- `every Monday` with no time. Add one, such as `every Monday at 9:00`.
- Shortcuts such as `@daily`. Write the time out.
- A date that never happens, such as the 31st of February. It is an error at deploy.
- Anything that would run more often than the minimum gap. See below.

## Time zones

> **Careful** Always give a time zone. "9:00" means 9:00 where the person is, and the platform will not guess for you.

- `time_zone` is an IANA name, checked when you deploy. `UTC`, `Asia/Kolkata` and `America/New_York` all work.
- If you leave it out and the account owner's profile has a zone, the platform uses that zone and prints a warning in the deploy output. If neither exists, the deploy fails with an error. Do not rely on the fallback. Write the zone.
- The schedule follows the wall clock of its zone, so a job at 9:00 stays at 9:00 on both sides of a daylight-saving change.
- When clocks go **forward**, a time that does not exist (say 02:30) runs at the next valid minute, once.
- When clocks go **back**, a time that happens twice runs only once, the first time.
- The command line prints run times in **UTC**, not in the schedule's zone. A job set for 9:00 in Asia/Kolkata shows as 03:30 UTC.

## The shortest gap

The gap between two runs must be at least the platform's minimum. By default that is **15 minutes**. `every 15 minutes` is fine. `every 5 minutes` is refused at deploy. For an irregular rule, the shortest gap it ever produces is the one that counts.

This is a current default, and the platform can change it. Read it from the deploy message if you are unsure. See [limits](cron-limits.md).

## Start delay (jitter)

Unless you set `exact: true`, a run starts after a small random delay. This spreads out the load when many jobs share a minute. The delay is up to 60 seconds, or a quarter of the gap between runs if that is smaller. Set `exact: true` when the second matters, and accept that the platform may be a little busier at that moment.

## Misfire and catch-up

A run is "late" when the platform gets to it after its planned time. If it is more than `misfire` late, the run is recorded as `missed` and is **not started**. This is deliberate. After an outage you do not want 40 old runs firing at once. At most the latest 50 missed runs are recorded, and the platform never starts a burst.

If you want one run to happen anyway, set `catch_up` to `"latest"`. After an outage, the newest missed time runs once, and the older ones are recorded as missed.

## Read next

- [What your app receives](cron-what-your-app-receives.md)
- [Failures and history](cron-failures-and-history.md)
- [Limits](cron-limits.md)
