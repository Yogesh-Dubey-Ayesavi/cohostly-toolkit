# Capture: deploy what already runs

Read this when you have a shell, the app runs on this machine, and the person wants it online. Also read it when a detected setting is wrong, or when someone wants a single file to hand over (a `.cohostly` file). Flags are in `cli.md`; the failure codes are in `troubleshooting.md`.

## What capture does

`cohostly capture -- <start command>` runs the app here, watches it for a few seconds and records what it really did: the start command, the port it answered on and the address it listened on, the runtime and its version, the packages it loaded and the environment variables it read. Railpack, the same planner the server uses, adds the build step, the package manager and system packages. Then it checks the result **before uploading anything**, and uploads only if nothing blocks.

Why run it instead of guessing from the files: a guess can be wrong about the port, the start command or a missing variable, and each wrong guess costs a build. A run on this machine cannot be wrong about what happened on this machine.

## Run it like this

1. Start command = the one production uses: the `start` script, `python app.py`, `gunicorn app:app`. Not `npm run dev` or a reloader; they record the dev command and may listen somewhere else.
2. `cohostly capture --json -- npm start` (swap in the real command). `--json` prints one result an agent can read; without it the same facts are printed as text.
3. The result has `ok`, `stage` (`checks`, `upload`, `build`, `start` or `live`), `problems` and `settings`. Each problem has `code`, `blocking`, `message` and `fix`. Each setting has a `value` and a `source`.
4. Fix every **blocking** problem, then run capture again. Warnings (`blocking: false`) do not stop a deploy; mention the ones that matter to the person.
5. `ok: true` with `stage: "live"` means it is online, and `url` is the address. Say that only then. Capture does not choose who can open the app: from a shell, `cohostly ls` shows the project's visibility (there is no `cohostly describe`; `describe_project` is an MCP tool). Tell the person what it is and ask before changing it.

Capture runs the app directly and never needs Docker. It does not work on native Windows (use WSL2) and needs an app with an HTTP port; a worker or a script has no port to find.

## Problems and what to do

| Code | Blocking | Do this |
| --- | --- | --- |
| `binds_loopback` | yes | The app listens on `127.0.0.1` only. Make it listen on `0.0.0.0` (for example `app.listen(port, '0.0.0.0')`) or read the `HOST` variable. Then run again. |
| `local_service` | yes | A variable points at `localhost`: the database is on this machine. Use a hosted address. `--allow-local-urls` deploys anyway; only use it when the person says the app can run without that service. |
| `no_http_port` | yes | Nothing answered HTTP in time. Check the start command starts a web server. If it is just slow, add `--timeout 60`. |
| `start_crashed` | yes | The app exited. The last output lines are in the message; fix that error first. |
| `secret_in_command` | yes | The start command contains a secret. Move it into an environment variable. |
| `absolute_start_path` | yes | The command uses a path on this machine. Use a command that works from the app folder. |
| `unsupported_runtime`, `unsupported_version` | yes | Only Node, Python, Go and static sites run today, at the versions the message lists. Do not try to work around this. |
| `unsupported_build` | yes | The build step is not one the platform runs. Use `npm run <script>`, `pnpm run <script>`, `yarn <script>` or `npx next build`, or pass `--build`. |
| `railpack_disagrees`, `not_detected` | yes | The folder is not the app's folder, or holds nothing Railpack knows. Check `--dir`. |
| `too_many_secrets` | yes | More than 100 variables. Remove the ones the app does not need. |
| `extra_ports` | no | The app also listens on other ports; only the one it answered on is online. |
| `unlisted_packages` | no | The app loaded packages its lockfile does not name. Capture pins them for this deploy; add them to the lockfile and tell the person. |
| `extra_program` | no | The app runs a program (for example `ffmpeg`) a plain image may lack. Ask the person which Debian package provides it and put it in `runtime.system_packages`; never guess a package name. |
| `value_not_found` | no | The app read a variable and it was set, but its value is not in the environment or a `.env` file. Ask the person to set it here, then capture again. |
| `reserved_name` | no | A variable name is one the platform sets itself (`PLATFORM_*`, `CONNECTION_*`, `AI_API_KEY` and a few more); it was not sent. Nothing to do. |
| `unset_variable` | no | The app read a variable that was not set here. Ask the person whether it is needed; if so, they set it and capture again. |

## When a detected value is wrong

Each setting says where its value came from: `you`, `capture`, `railpack`, `ai` or `default`. When a deploy fails and the failure names a field, fix **only that field**: pass its flag (`--build`, `--start`, `--port`, `--language`, `--package-manager`, `--install`, `--root`, or a version flag) or write that one key into `cohostly.json`. Then redeploy. A value you set shows as `you`, and everything else is still detected.

Do not copy every detected value into `cohostly.json`. A value in the file always wins over detection, so a full copy pins everything: the next change to the app's dependencies or version is then ignored, and the pin only shows up as a failure later.

`--save` writes the result to `cohostly.json`. Use it only when the person asks to keep the settings in the project, and say that it pins them. It refuses to overwrite a file unless `--force`.

## Secrets

Capture reads the values of variables the app read, from the environment it was started with or from a `.env` file, and sends them with the deploy request. They are never written into a file, a command line or the output; names are. `.env` files are never uploaded as source. If the person does not have a value set here, ask them to set it in their own terminal, not to tell you.

## A single file: `.cohostly`

`cohostly capture --out app.cohostly -- <command>` (or `cohostly pack --out app.cohostly` for a folder) seals the app's files and its secret values into one file, instead of deploying. Its settings stay readable on purpose, so you and the person can see what will be built: `cohostly inspect app.cohostly` prints them with their sources, the expiry and the secret names, and opens nothing.

- It is made for one account and expires in 7 days (`--expires 1d` to `30d`). Someone from another account, or after it expires, cannot deploy it. `--no-secrets` leaves the secret values out.
- `cohostly deploy app.cohostly` sends it. Over MCP: `get_upload_url`, upload the file, then `deploy` with the `upload_id`.
- **What sealing is, plainly:** the file's code and secrets cannot be read by anyone who finds the file. It is not end-to-end encryption: Cohostly and its hosting provider still see the code while building and running it. Never describe it as end-to-end.
- Failures: `snapshot_invalid`, `snapshot_expired`, `snapshot_wrong_account`, `snapshot_tampered`. In every case make a fresh file; do not try to edit one.
