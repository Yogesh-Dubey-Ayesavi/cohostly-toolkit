---
title: Troubleshooting
description: What a failed deploy is telling you, and the fix for each stable failure code.
---

Start with the platform's own words, then fix the one thing it names.

## Reading a failure

A failed deploy prints:

- **A code**, a stable name such as `build_failed_dependency`. This is the first thing to act on.
- **What failed**, and **which stage**: `uploading`, `building`, `starting` or `live`. "Building" points at your code or dependencies. "Starting" points at the start command or the port.
- **The cause and a fix** in plain words.
- **The end of the log**, when the cause is not recognised.

Add `--json` to get the code in a form a script can read.

## By stage

| Stage | What it usually means | What to do |
| --- | --- | --- |
| uploading | The archive is too big, or was not sent. | Leave out `node_modules` and `.venv`. |
| building | A dependency is missing from the lock file or requirements, or the language version is not supported. | Fix the dependency file. |
| starting | No start command was found, or the app did not listen on the expected port. | Listen on `0.0.0.0` on the `health.port`. Set `runtime.entrypoint`. Reading `PORT` is the usual way. |
| live, but the page is an error | The app crashed on its first request. | Check the code that serves `/`. Run it locally with `cohostly dev`, and read `cohostly logs`. |

## Codes

| Code | Meaning | What to do |
| --- | --- | --- |
| `unsupported_runtime` | A kind the platform does not run (PHP, Ruby, Rust and others). | Node, Python, Go and plain websites run today. |
| `not_detected` | Nothing to build was found, or it does not say how to start. | Check the folder holds a `package.json`, `requirements.txt`, `go.mod` or `index.html`. Otherwise set `runtime.entrypoint`. |
| `unsupported_version` | The Node, Python or Go version is not one the platform builds. | Use Node 16, 18 or 20 to 24, Python 3.9 to 3.13, Go 1.18 to 1.29. |
| `unsupported_build` | The build step is not one the platform runs. | Use `npm run <script>`, `pnpm run <script>`, `yarn <script>` or `npx next build`. |
| `build_failed_dependency` | A package could not be installed. | Fix the name or version in your dependency file. |
| `build_failed_command` | The build command failed. | Run the same command on your machine, fix the error, deploy again. |
| `build_failed` | The build failed for a reason not recognised. | Read the end of the log. It usually names the problem. |
| `build_out_of_memory` | The build needs more memory than builds get. | Build on your machine and upload the result, or make the build lighter. A bigger app size does not help. |
| `missing_secret` | A declared secret has no value. | `cohostly secrets set NAME --project <name>` ([secrets](../cli/secrets.md)). |
| `port_mismatch` | The app started but nothing listened on the expected port. | Read `PORT`, or set `health.port`. |
| `binds_loopback` | The app listens only on `127.0.0.1`. | Listen on `0.0.0.0`. |
| `start_crashed` | The app exited right after starting. | Read the output in the reply, fix that error, deploy again. |
| `upload_too_large` | The upload is over the limit. | Leave out build output and large data files. |
| `provider_busy` | The hosting service is throttling or full. | Not your app's fault. Wait the `Retry-After` time and try once more. |
| `snapshot_invalid`, `snapshot_expired`, `snapshot_wrong_account`, `snapshot_tampered`, `snapshot_unavailable` | A `.cohostly` file could not be opened. | Make a fresh one with `cohostly snapshot` or `cohostly pack`. Never edit one by hand. |

Snapshot-time codes (`secret_in_command`, `no_http_port` and others) are in [snapshot](../cli/snapshot.md#warnings-snapshot-can-give).

> **Good to know** Fix the cause the code names, deploy, and stop after two tries. A third guess costs another build and usually repeats the second. If it still fails, write down what you changed and what the platform said last.

## Common questions

**The app opens for me but not for others.** Check visibility first. An outsider sees "not found" when the project is `private` or `account` and they have no access. That does not mean the app is down. `cohostly share --project <name>` shows who can open it.

**"Needs a secret called X".** The deploy worked and the app started without the value. Set it with `cohostly secrets set X --project <name>`.

**"Name is already taken".** Project names are global. Choose another.

**The first visit after a while is slow.** The app was asleep. See [how apps run](../start/how-apps-run.md).

**My timer inside the app never fires.** A sleeping app runs nothing. Use [the clock](../bindings/cron.md).

**My files disappeared.** The disk is not durable. Use [the database](../bindings/data.md).

**A table returns no rows.** It has no `-- policy:` line, or the policy hides other people's rows. See [data](../bindings/data.md).

**`caller_unknown` from a connection.** A `user` connection was called outside a request. Call it inside a request handled by `middleware()`.

**A login page never appears for visitors.** Your own login is behind a platform check. Own login needs `public` or `link` ([sharing and roles](../settings/sharing-and-roles.md)).

**Rate limited (429).** Wait the `Retry-After` seconds. See [limits](limits.md).
