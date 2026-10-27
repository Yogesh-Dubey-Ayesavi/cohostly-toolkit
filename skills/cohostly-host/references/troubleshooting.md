# Troubleshooting

Read this when a deploy fails, the app does not open, or a person says "it's broken". Always start from the platform's own words, then translate them.

## Read the failure

A failed deploy reply has these parts (MCP and CLI both):

- **Code:** a stable name for what went wrong, for example `build_failed_dependency`. It is the first line of an MCP failure (`code: ...`), a `Code:` line in the CLI and `code` in `--json`. Act on the code; the sentences below explain it to the person. The table further down says what to do for each.
- **What failed:** the error line, for example "Deploy failed".
- **Which stage:** `uploading`, `building`, `starting` or `live`. "It stopped while: building" tells you the code is the likely cause; "starting" points at the start command or the port.
- **Cause and fix:** plain sentences from the classifier, for example a missing dependency, a wrong Python or Node version, no start command, or a port not read from the environment.
- **Log tail:** the last lines of the log when the classifier does not know the cause.

Report the cause and fix first. Quote the log only if the cause is unclear.

## Common causes

| Stage | What it usually means | What to do |
| --- | --- | --- |
| uploading | The archive is too big, or was not sent | Pack without `node_modules` and `.venv`. For big archives use `get_upload_url`. |
| building | A dependency is missing from the lock or requirements file, or the language version is unsupported | Ask the person to fix the dependency file; do not edit their code without asking. |
| starting | No start command was found, or the app did not listen on the port it was given | The app must listen on the port the health check uses (`health.port` in the manifest). Add or fix the start command in the manifest's `runtime.entrypoint`. Reading `PORT` from the environment is the usual approach; see `cohostly-app-code/references/environment.md`. |
| live, but the page is an error | The app crashed on the first request | Check the code path that serves `/`. There are no logs tool yet, so run the app locally with `platform dev` or `start_dev_session` to see the error. |

## What each code means

The complete, current list of codes (with each title and fix) is `platform://reference/failure-codes`; read it when a code is not in this table. This table says what to do about the ones a deploy returns.

| Code | Meaning | What to do |
| --- | --- | --- |
| `unsupported_runtime` | The project is a kind the platform does not run (PHP, Ruby, Rust and others). | Tell the person plainly. Node, Python, Go and plain websites run today. Do not try to convert the app. |
| `not_detected` | Railpack found nothing to build, or the project does not say how to start. | Check the folder holds a `package.json`, `requirements.txt`, `go.mod` or `index.html`; otherwise set `runtime.entrypoint` in `cohostly.json`. |
| `unsupported_version` | The Node, Python or Go version is not one the platform builds. | Use Node 16, 18 or 20 to 24, Python 3.9 to 3.13, Go 1.18 to 1.29 (`engines` in `package.json`, or the version flag). |
| `unsupported_build` | The build step is not one the platform runs. | Use `npm run <script>`, `pnpm run <script>`, `yarn <script>` or `npx next build`. |
| `build_failed_dependency` | A package could not be installed (missing, wrong version, conflict). | Fix the name or version in the dependency file; ask before editing the person's file. |
| `build_failed_command` | The build command, or the compile, failed. | Run the same command locally, fix the error it shows, redeploy. |
| `build_failed` | The build failed and the cause is not recognised. | Read the log tail the reply includes; it usually names the problem. |
| `build_out_of_memory` | The build needs more memory than builds get. | Nothing is wrong with the code. Build locally and upload the result, or make the build lighter. A bigger app size does not help. |
| `missing_secret` | A declared secret has no value. | `request_secret` and the secure link; see `secrets-and-tokens.md`. |
| `port_mismatch` | The app started but nothing listened on the expected port. | Read `PORT`, or set `health.port`. |
| `binds_loopback` | The app only listens on `127.0.0.1`. | Listen on `0.0.0.0`. |
| `start_crashed` | The app exited right after starting. | Read the output in the reply, fix that error, redeploy. |
| `upload_too_large` | The upload is over the limit. | Leave out build output and large data files; for archives that are just big, `get_upload_url`. |
| `provider_busy` | The hosting service is throttling or full. | Not the app's fault. Wait the `Retry-After` time and try again once; do not change the code. |
| `snapshot_invalid`, `snapshot_expired`, `snapshot_wrong_account`, `snapshot_tampered`, `snapshot_unavailable` | A `.cohostly` file could not be opened. | Make a fresh one (`snapshot.md`). Never edit one by hand. |

The snapshot tool finds these on the person's own computer, before anything is uploaded. It writes them as `TODO(cohostly)` and `NOTE(cohostly)` lines in `.cohostly/Dockerfile` (see `snapshot.md`):

| Code | Meaning | What to do |
| --- | --- | --- |
| `secret_in_command` | The start command contains a secret. | Move it into an environment variable, then capture again. |
| `no_http_port` | The app did not answer HTTP while it was captured. | Check it starts a web server, or give it longer with `--timeout`. |
| `absolute_start_path` | The start command uses a path on this computer. | Start it with a command that works from the app folder, such as `node server.js`. |
| `railpack_disagrees` | The app and the folder do not match. | Capture from the folder that holds the app, or pass `--dir`. |
| `too_many_secrets` | One deploy carries up to 100 secrets and there are more. | Drop variables the app does not need. |
| `local_service` | A variable points at this computer. | Use a hosted address, or `--allow-local-urls`. |
| `extra_ports` | The app listens on more than one port. | Only the port it answers on is online; tell the person. |
| `unlisted_packages` | The app loaded packages its own list does not name. | Add them to `package.json` or `requirements.txt`. |
| `extra_program` | The app starts a program a plain image may lack. | Add the Debian package to `runtime.system_packages`. |
| `reserved_name` | A variable name is set by the platform. | Nothing: it was not sent. |
| `unset_variable` | The app read a variable that was not set. | Set it before deploying if the app needs it. |
| `value_not_found` | A variable is set but its value was not found. | Set it in the environment or a `.env` file and capture again. |

**How many tries.** Fix the cause the code names, redeploy, and stop after two tries. If it still fails, tell the person what you changed, what the platform said last and what you think is still wrong. A third guess costs another build and usually repeats the second.

## The app opens for the owner but not for others

Check visibility before anything else. `describe_project` shows it. A "not found" for an outsider usually means the project is `private` (or `account`) and they have no access, not that the app is down. Share with them, or set visibility, after asking the person.

## "Needs a secret called X"

The deploy worked; the app starts without the value. Follow `secrets-and-tokens.md`: `request_secret`, then the link.

## "Name is already taken"

Someone else owns that project name. Names are global. Propose another name and ask the person before deploying under it.

## confirm_token rejected or expired

Tokens expire (`expires_in_s` in the draft reply). Call `deploy` again with the same code to get a new draft, then confirm.

## Redeploy asks for confirmation again

The new code changed something that the saved settings depend on. That is intended. Show the draft and what changed; do not force it with `skip_confirmation` unless the person said so.

## "The platform's context for this request could not be verified" (401)

The app's SDK `middleware()` got a context token and could not verify it. The reason is in the app's log (`get_logs`), on a line starting `[platform] context not verified:`.

- `the token is for a different app`: the app checked the token against the wrong host. A project deployed before the proxy sent `X-Forwarded-Host` needs a redeploy; an app that sets `audience` by hand must use its public address.
- `the platform's public keys could not be fetched`: the app cannot reach `PLATFORM_AUTH_URL`. Check the manifest's `network` rules allow it.
- `the token has expired`: the app's clock is wrong, or the request was replayed.

## Rolling back

If the new version broke things and the person wants it undone now: `rollback`. It makes the previous ready version live. Then `list_versions` to confirm which one is live, and tell the person which version it is.

## Still stuck

Say what you checked and what the platform said, in that order, and ask the person for the one thing you cannot see (a screen, a log they ran locally, the error from their own browser). Do not guess a fix and deploy it.

## Things the platform cannot do yet

Say these plainly rather than working around them:

- Send approval emails (approvals show in the dashboard and through `list_approvals`; no email goes out yet).
- Connect Slack (Google and Microsoft work; Slack is not set up yet).
- Costs and AI spend figures (not measured yet).
