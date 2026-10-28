# How apps run: what to promise and what not to

Read this before telling a person what their app will do once it is online, and before designing anything that keeps state, runs on a clock or needs a lot of memory. Numbers are in `platform://reference/limits`; this file says what they mean.

## Apps sleep

- An app that has had no requests for its idle time (a default, set in `lifetime.idle_timeout`) is paused to save resources. The next request wakes it. The first request after a sleep is slower than the others; say so if the app will be shown to people.
- A pause keeps memory by default (`pause_mode: "memory"`), so an app comes back where it was. Never rely on it: a restart, a deploy or a platform fault starts the app fresh.
- A single run has a length cap. When it ends the app pauses and wakes on the next request, so an app that must be up continuously is not what the platform does.

## Nothing important lives on the app's disk

- The app's own disk is not durable. A restart, a new version or a wake after a long time can lose files written at run time. Do not keep uploads, a SQLite file or anything the person would miss there.
- Keep rows in the managed database (`cohostly-app-code/references/data.md`), not in a file. A pause is not a backup.
- `storage.stateful` exists in the settings file, but do not promise that disk will be kept. Say that data belongs in the managed database.

## Timers do not run while the app sleeps

A `setInterval` or a background thread stops when the app is paused. For anything on a clock use the cron binding (`schedules.md`, `cohostly-app-code/references/cron.md`), which wakes the app, delivers the job and expects it to be safe to run twice.

## Memory and size

- An app gets one of a few memory sizes. A setting between two sizes is rounded up. The default is the second smallest. A large framework build or a bigger model in memory needs a bigger size, within what the account may run at once.
- The account's limit is total memory across the apps running at the same moment, not per app. A paused app does not count. When it is reached, a deploy or a wake is refused with the limit named; wait for another app to sleep or lower the size.
- The upload for a deploy is limited. Leave out build output and dependency folders (`node_modules` and `.git` are already left out); for a big archive use `get_upload_url`.

## Health and start

- After a deploy the platform asks the app's health path on its health port until it answers, up to `health.timeout_ms`. An app that needs longer to start (a large model, a slow install at start) must raise that, or it fails at the starting stage as `port_mismatch` or `start_crashed`.
- The app must listen on `0.0.0.0` on the health port. `127.0.0.1` is `binds_loopback`.

## Network and requests

- Outbound traffic is open by default (`network.egress`). It can be narrowed in the settings file.
- The app never sees the visitor's network address. Rate limits are per address and per project and are set per account (`platform://reference/limits`).
- A request to the app is HTTP on its address. The platform's reserved paths under `/__platform/` belong to the platform and are not passed to the app.

## Builds

- Node, Python, Go and plain websites build today. Builds run as one stage on a Debian base. A framework value that must exist while building (Next.js public keys, Vite variables) is found by `cohostly snapshot` (`snapshot.md`, "Values the build needs").
- Every deploy is a build and counts toward the hourly and daily build limits. Do not redeploy to "see if it works".

## Say these plainly

- Costs and AI spend are not measured yet, so do not quote a price.
- Slack connections are not set up yet; Google and Microsoft work.
- Approval emails are not sent yet; approvals appear in the dashboard and in `list_approvals`.
