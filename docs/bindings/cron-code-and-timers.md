---
title: Code-defined schedules and timers
description: "Define schedules in TypeScript or Python with platform.cron, create one-off timers, and understand what happens at deploy and in local development."
nav: Code and timers
---

You can define schedules in your code instead of the settings file. You can also create **timers**: one-off jobs that run once at a time you pick, such as "remind this user in 13 days".

Turn it on first:

```json title="cohostly.json"
{ "bindings": { "cron": { "code": true }, "data": { "managed": true } } }
```

Generate the typed object once ([the platform object](../sdk/platform-object.md)):

```sh
cohostly types --project my-app
```

## A schedule in code

```js title="server.js"
import express from 'express'
import platform from './platform.gen.js'

const app = express()

platform.cron.schedule('every 15 minutes', async (run) => {
  const seen = await platform.data.$app.sync_runs.findMany({ where: { run_id: run.id }, take: 1 })
  if (seen.length) return                         // a repeat: ignore it
  await syncInbox()
  await platform.data.$app.sync_runs.create({ data: { run_id: run.id, ran_at: new Date().toISOString() } })
}, { name: 'sync-inbox', timeZone: 'UTC', retries: 1, overlap: 'skip', timeout: '5m' })

app.use(platform.cron.express())                  // serves POST /__platform/jobs/<name>, scheduler only
app.listen(Number(process.env.PORT) || 3000)
```

```py title="jobs.py"
from platform_gen import platform

@platform.cron("0 9 * * 1-5", name="daily-report", time_zone="Asia/Kolkata", retries=2)
def daily_report(run):          # run is a dict: id, name, scheduled_for, attempt, payload
    print("report for", run["id"], "attempt", run["attempt"])
```

Options in TypeScript are `name`, `timeZone` (node-cron's `timezone` also works), `timeout`, `overlap`, `retries`, `misfire`, `catchUp` (`'latest'`), `freshSandbox` and `exact`. In Python they are `name`, `time_zone`, `timeout`, `overlap`, `retries`, `misfire`, `catch_up`, `fresh_sandbox` and `exact`. Their meaning is the same as in [schedules and syntax](cron-schedules-and-syntax.md).

Rules for the name:

- It must match the settings-file pattern: lower-case letters, digits, `_` and `-`, up to 63 characters, no dots. The SDK itself is a little looser and accepts a dot, but the platform refuses it when the schedule is sent, so do not use one.
- It must not also appear in the settings file.

## When schedules are sent

Define schedules while the app **starts**, at the top level of your file. About a quarter of a second after the first `schedule()` or `on()` call, the SDK sends everything to the platform. It tries up to 6 times with growing waits, and it does not retry a 4xx answer except 429 (too many requests).

## The throwaway start at deploy

When you deploy a project with `"code": true`, the platform has to learn your schedules. It does so by starting your app once in a **throwaway sandbox**, waiting for the SDK to send them, and then closing that sandbox.

- The deploy waits up to **90 seconds** for the schedules to arrive.
- If none arrive, or the app crashes first, the deploy fails and **the previous version stays live**.
- Your start-up code therefore runs once at every deploy, in a sandbox nobody uses. Do not do anything in start-up code that must happen only once, such as sending an email or charging a card.

If you do not define schedules in code, remove `bindings.cron` or set up the schedules in the settings file instead.

## Timers

A timer is a one-off job. Register a handler with `on`, then create the timer with `once`.

```js title="timers.js"
platform.cron.on('trial-ending', async (run) => {
  await sendReminder(run.payload.userId)
})

app.post('/start-trial', express.json(), async (req, res) => {
  const when = new Date(Date.now() + 13 * 86_400_000)
  const { id } = await platform.cron.once(when, 'trial-ending', { userId: req.body.userId })
  res.json({ timer: id })       // keep the id if you may need to cancel it
})
```

```py title="timers.py"
from datetime import datetime, timedelta, timezone
from platform_gen import platform

@platform.cron.on("trial-ending")
def trial_ending(run):
    print("remind", run["payload"]["userId"])

def start_trial(user_id):
    when = datetime.now(timezone.utc) + timedelta(days=13)    # a time-zone-aware datetime
    timer = platform.cron.once(when, "trial-ending", {"userId": user_id})
    return timer["id"]
```

The calls are `platform.cron.once(at, name, payload?)`, `platform.cron.timers()` to list the pending ones, and `platform.cron.cancel(id)`.

Timer rules:

- The `name` follows the same pattern as a schedule name, and a handler with that name must exist.
- The time must be a real date, no more than 1 minute in the past and no more than **366 days** ahead.
- The payload is at most **8 KB**.
- You can have at most 1000 waiting timers per project.
- A timer run uses the default 10-minute timeout, allows overlap, and gets **one attempt with no retries**.
- Calling `once` twice creates two timers. Nothing removes duplicates by name.
- Timers survive deploys and rollbacks. A handler with that name must keep existing in later versions, or the timer will find nothing to run.
- Pass a time-zone-aware time in Python. A time with no zone is sent as it is, with no zone.

From the command line:

```sh
cohostly schedules timers --project my-app
cohostly schedules cancel-timer <id> --project my-app
```

## Local development

`cohostly dev` runs your app on your machine with a temporary development token. That token is read-only for the clock:

- Schedules are **not** registered. The SDK logs the failure and your app keeps running.
- `once`, `timers` and `cancel` answer 403 `read_only_token`.

So you cannot test a schedule end to end on your computer. To test one handler by hand, run the app in run mode, which makes the SDK run only that handler and exit:

```sh
PLATFORM_RUN=daily-report PLATFORM_RUN_ID=test-1 cohostly dev --project digest -- node server.js
```

This combination uses the documented variables, but treat it as a convenience to try, not a promise. To test the real thing, deploy and use `cohostly run <name>` ([failures and history](cron-failures-and-history.md)).

## Python in a web app

In a web app, mount your own route and hand the call to the helper after you have verified the context:

```py title="main.py"
@app.post("/__platform/jobs/{name}")
async def job(name: str, request: Request):
    ctx = platform_context(request)                       # verify X-Platform-Context, as on the previous page
    status, body = platform.cron.handle(name, await request.json(), ctx["caller"])
    return JSONResponse(body, status_code=status)
```

`platform_context` is the verifying function from [what your app receives](cron-what-your-app-receives.md). `handle` returns the status code and body to send back.

## Read next

- [What your app receives](cron-what-your-app-receives.md)
- [Errors](cron-errors.md)
