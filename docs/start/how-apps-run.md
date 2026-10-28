---
title: How apps run
description: What to expect once your app is online, so you do not promise anything the platform does not do.
---

Plan your app around five facts. They explain most surprises.

## 1. Apps sleep

An app that gets no visits for a while is put to sleep to save resources. The idle time is a setting (`lifetime.idle_timeout`), and the default is 10 minutes. The next visit wakes it. That first visit is slower than the rest, so if you are about to show the app to someone, open it once yourself.

A sleeping app usually keeps its place in memory (`pause_mode` defaults to `memory`), so it wakes up where it stopped. Do not depend on that. A restart, a new version or a platform problem starts the app from scratch.

A single run also has a length limit. When it ends, the app pauses and wakes on the next visit. An app that must stay awake all day is not what this platform does.

## 2. Nothing important lives on the app's disk

Files the app writes while running can disappear when it restarts, when a new version goes out, or when it wakes after a long sleep. Do not keep uploads, notes, or a SQLite file there.

Keep information in the [managed database](../bindings/data.md). It survives restarts and comes back with the right version on a rollback.

> **Good to know** There are no mounted volumes. The settings file has fields named `storage.persistent` and `mount_path`, but setting them only produces a warning. The CLI can back up and restore an app's `/data` folder (see [projects](../cli/projects.md)), which is a safety copy, not a promise that the disk survives.

## 3. Timers do not run while the app sleeps

A `setInterval` or a background thread stops when the app is paused. To do something at a set time (a daily report, a reminder), use the [clock binding](../bindings/cron.md). The platform keeps the clock, wakes your app when a job is due, and hands it the job.

## 4. Memory comes in a few sizes

The sizes are 256, 512, 1024 and 2048 MB. The default is 512. A number between two sizes rounds up. The account has a limit on total memory across apps that are awake at the same moment. A sleeping app does not count. When the limit is reached, a deploy or a wake is refused and the message names the limit.

## 5. Listen on the right address and port

After a deploy, the platform asks your app's health address until it answers, for up to `health.timeout_ms` (5 seconds by default). Your app must listen on `0.0.0.0`, not `127.0.0.1`, on the health port. Reading the `PORT` environment variable is the usual way. An app that needs longer to start, such as one that loads a large model, must raise that timeout.

## Also good to know

- **Outgoing connections** are open by default. The settings file can narrow them to a list of allowed hosts.
- **Your app never sees the visitor's network address.** Rate limits are applied before the request reaches you.
- **Paths that start with `/__platform/`** belong to the platform and are not passed to your app, apart from the few it answers on your behalf.
- **Every deploy is a build** and counts toward the hourly and daily build limits. Do not redeploy just to see whether something works. Use `cohostly dev` on your own machine ([develop](../cli/develop.md)).
- **Costs are estimates.** AI and hosting costs are not measured everywhere yet, so there is no bill to quote.
- **Slack connections and approval emails are not available yet.** Google and Microsoft connections work, and approvals appear in the dashboard.

See [limits](../limits/limits.md) for the numbers.
