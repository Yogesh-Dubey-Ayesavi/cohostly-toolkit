# Scheduled jobs

Read this when the app has to do something on a clock: a daily report, a nightly cleanup, a reminder at a set time. **Do not use `setInterval` or a timer library inside the app.** A sandbox that is idle is paused, and a paused app runs nothing. The platform owns the clock and wakes the app (or starts a command) when a job is due.

## Two ways to define a job

**In the manifest** (no code needed):

```json
{
  "bindings": { "cron": { "schedules": [
    { "name": "daily-report", "when": "every weekday at 9:00", "time_zone": "Asia/Kolkata",
      "run": { "http": { "path": "/jobs/daily-report" } } }
  ] } }
}
```

`run` is either `{ "http": { "path": "/jobs/x" } }` (the platform calls your app and wakes it) or `{ "command": "python report.py" }` (runs a command in the sandbox, no web server needed).

**In code** with `platform.cron` (set `"cron": { "code": true }` in the manifest). The argument order is node-cron's, so moving from that library is an import change:

```ts
import platform from './platform.gen.js'

platform.cron.schedule('every weekday at 9:00', async (run) => { await sendReport(run.id) },
  { name: 'daily-report', timeZone: 'Asia/Kolkata' })

platform.cron.on('trial-ending', async (run) => { await sendReminder(run.payload.userId) })
await platform.cron.once('2026-11-01T09:00:00Z', 'trial-ending', { userId })   // payload up to 8 KB
```

Define schedules while the app starts. They are sent to the platform once, shortly after start-up. A job's `name` is its identity across versions, and the same name cannot be in both the manifest and the code.

A web app serves the platform's call at `POST /__platform/jobs/<name>`. Mount it with `app.use(platform.cron.express())`. Only the platform's scheduler can reach that path. A script with no server needs nothing more: the platform starts it with `PLATFORM_RUN=<name>`, the SDK runs only that handler, and the process exits 0, or 1 if the handler throws.

## `when`

Plain English (`every 15 minutes`, `every day at 8:30`, `every weekday at 9:00`, `every Monday at 10:00`, `on the 1st of each month at 07:00`) or a five-field cron expression. **Always give a time zone.** The platform never assumes UTC, and a job at "9:00" means 9:00 where the person is.

## Options worth knowing

| Option | What it does |
| --- | --- |
| `timeout` | How long one run may take (default 10 minutes). |
| `overlap` | If the last run is still going: `skip` (default), `queue` or `allow`. |
| `retries` | 0 to 5 more tries after a failure. |
| `misfire` | If the platform is late by more than this, the run is recorded as missed, not started. |
| `catch_up: "latest"` | After an outage, run once instead of skipping everything missed. |
| `exact` | Start on the minute, with no random delay of up to a minute. |

## Rules

- **Delivery is at least once.** A handler can run twice. Use `run.id` to ignore a repeat, or write the work so repeating it is harmless.
- The handler receives `{ id, name, scheduledFor, attempt, payload }`.
- A job reaches the app's own data through `platform.data.$app` (there is no visitor in a job). See `data.md`.

Worked example: `assets/examples/scheduled-report/`. In Python: `@platform.cron("0 9 * * 1-5", name="daily-report", time_zone="Asia/Kolkata")`.
