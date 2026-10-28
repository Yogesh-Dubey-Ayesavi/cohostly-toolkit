---
title: A morning summary
nav: Morning summary
description: Run a job by itself every weekday at 9:00, even though the app sleeps in between, and make sure a repeat never does the work twice.
---

## What you will build

An app that does one small thing on a schedule: every weekday at 9:00 in the morning, India time, it builds a report. You could swap in anything: send yourself an email, tidy old rows, check a price.

The interesting part is **when**. Apps go to sleep when nobody is visiting, and a sleeping app runs nothing. So a timer inside the app, such as `setInterval`, would never fire. Instead you tell the platform the schedule. The platform keeps the clock, wakes your app at 9:00, and hands it the job.

## What you need

- Node 20 or later, and the command line (`npm install -g cohostly`).
- The six files below.

## The files

```json title="package.json"
{
  "name": "scheduled-report",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx server.ts",
    "types": "cohostly types --project scheduled-report",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "@cohostly/sdk": "^0.2.1",
    "express": "^4.19.2",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "scheduled-report",
  "health": { "port": 3000 },
  "bindings": { "cron": { "code": true }, "data": { "managed": true } }
}
```

```sql title="migrations/001_init.sql"
-- policy: app_only
CREATE TABLE report_runs (run_id TEXT PRIMARY KEY, ran_at TEXT NOT NULL, note TEXT NOT NULL);
```

```ts title="server.ts"
import express, { type Response } from 'express'
import platform from './platform.gen.js' // generated: run `npm run types`

const app = express()

// The platform owns the clock: a paused app runs nothing, so a timer inside the app would never fire. This registers the schedule
// with the platform, which wakes the app when it is due. Define schedules while the app starts.
platform.cron.schedule('every weekday at 9:00', buildReport, { name: 'daily-report', timeZone: 'Asia/Kolkata', retries: 2 })

async function buildReport(run: { id: string; attempt: number }) {
  // Delivery is at least once, so a run can arrive twice. The run id is the key: a second delivery finds the row and stops.
  const seen = await platform.data.$app.report_runs.findMany({ where: { run_id: run.id }, take: 1 })
  if (seen.length) return
  // ... build and send the report here ...
  await platform.data.$app.report_runs.create({ data: { run_id: run.id, ran_at: new Date().toISOString(), note: `attempt ${run.attempt}` } })
}

// Where the platform calls in (POST /__platform/jobs/<name>). Only the platform's scheduler can reach it.
app.use(platform.cron.express())

app.get('/', (_req, res: Response) => { res.send('scheduled-report is running') })
app.listen(Number(process.env.PORT) || 3000)
```

Add the same `tsconfig.json` as in [Private notes](./private-notes.md).

## What each part does

**`cohostly.json`** asks for two services. `cron` (a timer the platform runs for you) with `code: true` says the schedule is written in the app's code. `data` is the small database, used here as a notebook where the job writes down "I did this one".

**The table.** `-- policy: app_only` means only the app's own trusted code can use it. Visitors can not read or write it at all. This is the notebook for the job, not for people.

**`server.ts`**

- `platform.cron.schedule('every weekday at 9:00', buildReport, {...})` is the heart of it. It says: at 9:00 on weekdays, call `buildReport`. You can write the time in plain English, or as the five-field codes some people already know.
- `name: 'daily-report'` is the job's name. The platform remembers it from one version of your app to the next.
- `timeZone: 'Asia/Kolkata'` says whose 9:00. **Always give a time zone.** The platform never guesses UTC, so "9:00" means 9:00 where you are.
- `retries: 2` means if a run fails, try up to two more times.
- `buildReport(run)` is the job. It receives `run`, a small note with an `id` and an `attempt` number.
- **Why it checks first.** The platform promises to deliver every run at least once, which means sometimes twice. So `buildReport` first looks in the notebook for this run's `id`. If it is there, the job already happened and it stops. If not, it does the work and then writes the `id` down. A repeat now does no harm. This habit is called being "safe to run twice".
- `platform.data.$app` means "the app itself". A job has no visitor, so it uses the app's own trusted access.
- `app.use(platform.cron.express())` adds the one doorway the platform uses to hand over a job. Only the platform's scheduler can open it.

> **Good to know** The schedule is sent to the platform once, shortly after the app starts. Define schedules at start-up, not inside a request.

## Put it online

```sh
cohostly login
npm install
cohostly types --project scheduled-report
cohostly deploy --project scheduled-report
cohostly schedules list --project scheduled-report
```

If `cohostly types` says it cannot find the project, deploy once first, then run it again. You do not have to share the app with anyone: the platform reaches the job on its own.

## Try it

- `cohostly schedules list --project scheduled-report` shows the job in plain English with its time zone, its next five run times and whether it is on.
- Do not wait until 9:00. Run it now: `cohostly run daily-report --project scheduled-report`. It starts within a minute.
- `cohostly schedules runs daily-report --project scheduled-report` shows the latest runs and how they ended.
- Open the app's address. You should see `scheduled-report is running`.

> **Good to know** `cohostly run` really does the job. If your job emails people or deletes things, it will do that too.

## Make it yours

1. Change the time: `'every Monday at 10:00'`, `'every 15 minutes'` or `'on the 1st of each month at 07:00'`. Remember the time zone.
2. Do real work where it says `build and send the report here`. Anything you send or change should be safe if it happens twice.
3. A job that is only a web call or a command does not need code at all. Put a schedule in `cohostly.json` instead; see [Cron](../bindings/cron.md).

## If something goes wrong

- **It never runs.** An app that is paused runs nothing by itself, but the platform wakes it for a job. Check `cohostly schedules list`. A schedule switches itself off after repeated failures, so check the last result before turning it back on with `cohostly schedules resume daily-report`.
- **The job ran twice.** That is allowed. Look at the notebook check in `buildReport`: it must use `run.id`.
- **A pause did not catch up.** If you stop a schedule with `cohostly schedules pause`, the runs it would have made are not made up afterwards.
- **A name clash.** The same name can not be in both the settings file and the code.

More in [Cron](../bindings/cron.md) and [Jobs and approvals](../cli/jobs-and-approvals.md).
