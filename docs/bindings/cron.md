---
title: The clock (cron)
description: "Run work at set times, even while your app is asleep. The platform keeps the clock, wakes your app, and records every run."
nav: Clock (cron)
---

The clock binding runs work at times you choose: every weekday at 9:00, every 15 minutes, on the 1st of the month. You write what should happen. The platform decides when.

## Why not `setInterval`?

Do **not** use `setInterval`, `setTimeout` or a timer library inside your app to do scheduled work. An app that nobody is using is paused to save resources, and a paused app runs no code at all. The timer would simply stop.

Think of an alarm clock. If you build the alarm into the sleeping person, it cannot wake them. The alarm has to sit outside, on the bedside table. Here the bedside table is the platform. It keeps one clock for every app, checks it once a minute, and when a job is due it wakes your app (or starts a fresh command) and hands over the work.

This also gives you things a timer in your app cannot: a record of every run, retries when a run fails, protection against two runs overlapping, and a switch that turns a broken schedule off.

## Two ways to define a job

**In the settings file.** No code is needed for the schedule itself. The platform calls your app, or runs a command.

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "digest",
  "health": { "port": 3000 },
  "bindings": {
    "cron": {
      "schedules": [
        {
          "name": "daily-report",
          "when": "every weekday at 9:00",
          "time_zone": "Asia/Kolkata",
          "run": { "http": { "path": "/jobs/daily-report" } }
        }
      ]
    }
  }
}
```

`run` is one of two things, never both:

- `{ "http": { "path": "/jobs/daily-report" } }`: the platform sends a `POST` to that path of your app and wakes the app if it is asleep.
- `{ "command": "python report.py" }`: the platform runs that one-line command. No web server is needed.

**In your code**, with `platform.cron`. Set `"cron": { "code": true }` under `bindings` first. The argument order matches the node-cron library, so moving from it is mostly an import change.

```js title="jobs.js"
import platform from './platform.gen.js'

platform.cron.schedule('every weekday at 9:00', dailyReport, {
  name: 'daily-report',
  timeZone: 'Asia/Kolkata',
})
```

```py title="jobs.py"
from platform_gen import platform

@platform.cron("0 9 * * 1-5", name="daily-report", time_zone="Asia/Kolkata")
def daily_report(run):
    ...
```

A job's `name` is its identity across versions. The same name cannot be in both the settings file and your code. Details are in [code-defined schedules and timers](cron-code-and-timers.md).

## The one thing to get right

> **Careful** `platform.cron.express()` serves only `POST /__platform/jobs/<name>`. That is the address the platform uses for jobs defined in code. A settings-file schedule with `run.http.path` such as `/jobs/daily-report` calls **your own route**, and `express()` does not protect it. Your route must check the caller itself. See [what your app receives](cron-what-your-app-receives.md).

## Rules that always apply

- **Delivery is at least once.** A job can run twice, for example when a run finishes but the answer is lost and the platform retries. Use the run id to ignore a repeat, or write the work so repeating it is harmless.
- **A job has no visitor.** Nobody is signed in. Reach your database as the app, with `platform.data.$app` ([data](data.md)).
- **Pausing does not make up for missed runs.** Runs that fall in a paused period are skipped for good.
- **Times are written in a time zone you name.** The platform never silently assumes UTC. See [schedules and syntax](cron-schedules-and-syntax.md).
- **There are limits.** The shortest gap between runs is 15 minutes by default, and there are caps on schedules and runs. See [limits](cron-limits.md).

## A job-only project

A project with `"kind": "job"` has no web address and runs only on the clock. It needs `bindings.cron` with at least one schedule, or `"code": true`. Use it for a nightly cleanup or a weekly export that nobody visits. Its runs are always commands, so write `run.command` or use a script that defines schedules in code.

## Look and steer from the command line

```sh
cohostly schedules list --project digest
cohostly schedules runs daily-report --project digest
cohostly run daily-report --project digest
```

Anyone with viewer access can list, show and read runs. Running now, pausing, resuming and timers need editor access. All commands are on [failures and history](cron-failures-and-history.md).

## Read next

- [Schedules and syntax](cron-schedules-and-syntax.md): the `when` text, time zones, every option.
- [What your app receives](cron-what-your-app-receives.md): how a sleeping app is woken, the request, and how to check the caller.
- [Code-defined schedules and timers](cron-code-and-timers.md): `platform.cron` in TypeScript and Python, one-off timers, deploy and local development.
- [Failures and history](cron-failures-and-history.md): retries, overlap, missed runs, switching off, the CLI.
- [Limits](cron-limits.md): every number in one place.
- [Errors](cron-errors.md): every error and its fix.
- [Environment variables](environment.md): the variables a job run sees.
- [A morning summary](../examples/morning-summary.md): a small app that uses this binding from start to finish.
