---
title: What your app receives
description: "How the platform wakes a sleeping app for a job, the request it sends, how to check the caller, and what a command job sees."
nav: What your app receives
---

When a job is due, the platform runs it in one of two ways. Which one depends on how the schedule is defined and what kind of project it is.

| Kind of run | Description |
| --- | --- |
| Web call | The platform sends a `POST` to your app. Used for `run.http`, and for code schedules and timers on a project that has a web port and is not `kind: "job"`. |
| Command | The platform starts a command in a sandbox. Used for `run.command`, and for code schedules and timers on a script (`kind: "job"`, or an app with no port). |

## The web call

### How a sleeping app is woken

The platform sends the request to your app's public address, the same door visitors use. Two things are special about it:

- It is let through even if the app is private. The platform carries a short-lived pass that works only for that one path, so you do not have to share the app for jobs to work.
- If the app is paused, the request **wakes it** and waits for it to start. The platform keeps your app awake while the request is open, so the app cannot fall asleep in the middle of a job.

Think of a night-shift delivery. The courier does not need the shop to be open. They ring the bell, the shopkeeper wakes up, takes the parcel and stays up until it is signed for.

### The path

- Jobs defined in code (and timers) arrive at `POST /__platform/jobs/<name>`. The name is URL-encoded.
- Jobs defined in the settings file arrive at your own `run.http.path`.

### The body

```json
{
  "run_id": "6c1f6b9e-7c1d-4d52-9d77-2c1b6f4a8a10",
  "name": "daily-report",
  "scheduled_for": "2026-11-02T03:30:00.000Z",
  "attempt": 1,
  "payload": null
}
```

| Field | Type | Description |
| --- | --- | --- |
| `run_id` | text | A unique id for this run. The same id is used for every retry of it. Use it to ignore a repeat. |
| `name` | text | The schedule's name, or the timer's name. |
| `scheduled_for` | text | The time the run was planned for, in UTC, as an ISO date. |
| `attempt` | whole number | 1 on the first try, 2 on the first retry, and so on. |
| `payload` | any JSON | `null` for a schedule. For a timer, the payload you gave when you created it. |

### The headers

| Header | Description |
| --- | --- |
| `X-Platform-Context` | A signed token that proves who is calling. Verify it. |
| `X-Platform-Run-Id` | The same as `run_id` in the body. |
| `X-Platform-Scheduled-For` | The same as `scheduled_for`, in UTC. |
| `Idempotency-Key` | `<run_id>:<attempt>`. It **changes with every attempt**, so do not use it to spot a repeat of the same run. Use the run id. |

The platform strips any `X-Platform-*` header a caller tries to send, except the two run headers, and only when they have the right shape. The platform's own login token is removed before the request reaches your app.

### How to check the caller

Anyone on the internet can send a `POST` to a public path of your app. Before you do any work, make sure the caller is the platform's scheduler.

1. Verify the `X-Platform-Context` token ([verify the token](../sdk/request-context.md)).
2. Require `caller.kind` to be `"platform"`.
3. Require `caller.label` to be `"scheduler"`.

Both caller fields are always present in the context, even when your app asks for no other facts about callers.

**If the job is defined in code**, mount the helper. It does all of this for you, and it answers only at `/__platform/jobs/<name>`:

```js title="server.js"
import express from 'express'
import platform from './platform.gen.js'

const app = express()

platform.cron.schedule('every 15 minutes', async (run) => {
  await syncInbox()
}, { name: 'sync-inbox', timeZone: 'UTC' })

app.use(platform.cron.express())
app.listen(Number(process.env.PORT) || 3000)
```

The helper answers: 405 for anything but `POST`, 401 when the context cannot be verified, 403 when the caller is not the scheduler, 404 when no handler has that name, 400 for a body that is not JSON, 500 when your handler throws, and 200 with `{ "ok": true }` when it worked.

**If the job is defined in the settings file with `run.http`**, the path is your own route and nothing checks it for you. Do the three steps yourself:

```js title="server.js"
import express from 'express'
import { context } from '@cohostly/sdk'
import platform from './platform.gen.js'

const app = express()
app.use(express.json())

app.post('/jobs/daily-digest', async (req, res) => {
  const ctx = await context(req).catch(() => undefined)
  if (ctx?.caller?.kind !== 'platform' || ctx.caller.label !== 'scheduler') {
    return res.status(403).json({ error: 'platform only' })
  }

  const runId = String(req.headers['x-platform-run-id'] ?? req.body?.run_id ?? '')
  const seen = await platform.data.$app.digest_runs.findMany({ where: { run_id: runId }, take: 1 })
  if (seen.length) return res.json({ ok: true, repeat: true })   // delivery is at least once

  await buildAndSendDigest()                                     // finish the work, then answer 2xx
  await platform.data.$app.digest_runs.create({ data: { run_id: runId, ran_at: new Date().toISOString() } })
  res.json({ ok: true })
})

app.listen(Number(process.env.PORT) || 3000)
```

```py title="main.py"
import os
import jwt
from fastapi import FastAPI, HTTPException, Request

app = FastAPI()
AUTH_URL = os.environ["PLATFORM_AUTH_URL"].rstrip("/")
keys = jwt.PyJWKClient(f"{AUTH_URL}/.well-known/jwks.json", cache_keys=True)

def platform_context(request: Request) -> dict:
    token = request.headers.get("x-platform-context")
    if not token:
        raise HTTPException(401, "This app must be opened through the platform.")
    host = next((v.split(",")[0].strip() for v in (
        request.headers.get("x-platform-app-host"),
        request.headers.get("x-forwarded-host"),
        request.headers.get("host")) if v), "").lower()
    try:
        claims = jwt.decode(token, keys.get_signing_key_from_jwt(token).key, algorithms=["ES256"],
                            audience=host, issuer=AUTH_URL, leeway=30,
                            options={"require": ["exp", "iat", "iss", "aud"]})
    except jwt.PyJWTError:
        raise HTTPException(401, "The platform's context for this request could not be verified.")
    return claims.get("ctx", {})

@app.post("/jobs/daily-digest")
async def daily_digest(request: Request):
    caller = platform_context(request).get("caller", {})
    if caller.get("kind") != "platform" or caller.get("label") != "scheduler":
        raise HTTPException(403, "This address is for the platform, not for visitors.")
    body = await request.json()
    run_id = request.headers.get("x-platform-run-id") or body.get("run_id")
    # if run_id was already handled, return 200 now; otherwise do the work, record run_id, return 200
    return {"ok": True}
```

For Python code-defined schedules in a web app, `platform.cron.handle(name, body, caller)` returns a status and a body for you to send back, after you verify the context. See [code-defined schedules](cron-code-and-timers.md).

### What to answer

| Your answer | What the platform does |
| --- | --- |
| Any 2xx | The run succeeded. |
| 5xx | The run failed. It is retried if you set `retries`. |
| 4xx | The run failed and is **never retried**. A 4xx means your app refused the request, and sending it again would not change that. |
| 3xx | Counts as a failure. Redirects are not followed. |
| No answer before `timeout` | The run is `timed_out` and is retried if you set `retries`. |

Do all the work **before** you answer 2xx. Work that carries on after the reply is not protected by the platform's keep-awake, and the app may be paused under it.

## The command run

For a command, the platform writes the command and its environment into a sandbox and starts it. Your command's output goes to the app's logs. The platform records the exit code: 0 is success and any other number is a failure, which is retried if you set `retries`. The scheduler's deadline still ends the run if the command never finishes.

A project that keeps no files between starts gets a **fresh sandbox for every run**, and the sandbox is removed afterwards. A project with `storage.stateful` reuses the project's own sandbox and leaves it alone afterwards. Set `fresh_sandbox` to change either default.

The command sees the sandbox's normal environment ([environment variables](environment.md)) plus these:

| Variable | Description |
| --- | --- |
| `PLATFORM_RUN_ID` | The run id. |
| `PLATFORM_SCHEDULE_NAME` | The schedule's name, or the timer's name. |
| `PLATFORM_SCHEDULED_FOR` | The planned time, in UTC, as an ISO date. |
| `PLATFORM_RUN_ATTEMPT` | 1 on the first try, 2 on the first retry, and so on. |
| `PLATFORM_RUN` | The handler name. Set only for jobs defined in code. |
| `PLATFORM_RUN_PAYLOAD_FILE` | The path of a JSON file that holds the payload. Set only for jobs defined in code. |

> **Careful** A command run on a fresh sandbox does **not** get `PLATFORM_LOGIN_URL` or `PLATFORM_AUTH_URL`. Those are added only when the platform starts your app for a visitor. A command job has no visitor, so it does not need to verify one. If your script reaches your data, it uses `PLATFORM_TOKEN`, which is always there.

A settings-file `run.command` does not set `PLATFORM_RUN`. Read the variables above instead.

```py title="cleanup.py"
import os, sys
from platform_gen import platform

run_id = os.environ["PLATFORM_RUN_ID"]
attempt = os.environ.get("PLATFORM_RUN_ATTEMPT", "1")
scheduled_for = os.environ["PLATFORM_SCHEDULED_FOR"]       # ISO, UTC
print(f"cleanup run={run_id} attempt={attempt} scheduled={scheduled_for}")

deleted = platform.data.app.old_rows.delete_many({"created_at": {"lt": "2026-01-01"}})
print("deleted", deleted)
sys.exit(0)        # non-zero means failed, and it is retried if retries remain
```

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "nightly-cleanup",
  "kind": "job",
  "bindings": {
    "cron": {
      "schedules": [
        {
          "name": "cleanup",
          "when": "every day at 02:30",
          "time_zone": "Europe/Berlin",
          "timeout": "20m",
          "retries": 1,
          "run": { "command": "python cleanup.py" }
        }
      ]
    },
    "data": { "managed": true }
  }
}
```

### Code-defined jobs in a script

When the job is defined in code and runs as a command, the platform sets `PLATFORM_RUN=<name>`. The SDK then runs **only that handler** and exits. It exits 0 when the handler finishes, 1 when it throws, and 127 if the name is not defined within 30 seconds of starting. Your script needs nothing more than the `platform.cron` calls.

## The run object in your handler

A handler gets the run as its argument.

| Field | Type | Description |
| --- | --- | --- |
| `id` | text | The run id. In TypeScript the field is `id`. |
| `name` | text | The schedule's or timer's name. |
| `scheduledFor` | `Date` | The planned time. In Python the key is `scheduled_for` and it is a text string. |
| `attempt` | whole number | 1 on the first try. |
| `payload` | any JSON | `null` for a schedule, the timer's payload for a timer. |

In Python the run is a plain dict, so read `run["id"]`, `run["scheduled_for"]` and so on.

## Read next

- [Failures and history](cron-failures-and-history.md)
- [Code-defined schedules and timers](cron-code-and-timers.md)
- [Environment variables](environment.md)
