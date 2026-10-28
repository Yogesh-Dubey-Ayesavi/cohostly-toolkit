---
title: Snapshot and check
description: "Run your app once on your own machine, let Cohostly write down what it needs, test it with check, and deploy it from the .cohostly folder."
nav: Snapshot and check
---

Some apps are not a clean template. They read settings, need a special package, or start with an unusual command. Instead of describing all that by hand, you run the app once and let Cohostly watch. Think of a removal firm that photographs every room before it packs: nothing is guessed, and the photos say what goes where.

```bash
cohostly snapshot -- npm start
cohostly check
cohostly deploy
```

Three commands, three jobs:

| Command | Job |
| --- | --- |
| `snapshot` | Runs your app, watches it, writes the `.cohostly/` folder. |
| `check` | Builds that folder's Dockerfile on your machine and proves it answers like the original. Needs Docker. Optional. |
| `deploy` | Deploys the `.cohostly/` folder. See [deploy from the snapshot](#deploy-from-the-snapshot). |

## What you need

- **macOS or Linux**, Intel or Arm. On Windows both commands stop with `Capture runs on macOS and Linux. On Windows, use WSL2.`
- **No Docker** for `snapshot`. **Docker** for `check`.
- **Your own toolchain.** `snapshot` runs your project's real build in a scratch copy. If your app needs Node or Python to build, they must be installed.
- **Railpack**, the open-source build planner. The CLI downloads it once, the first time it is needed, and checks it against a fixed checksum. Messages: `Downloading Railpack 0.43.0 (once) ...`, `Could not download Railpack (<status>). Check your connection and try again.`, `The downloaded Railpack did not match its checksum. Nothing was run.`
- **To be signed in**, so the values can be sealed (see [secrets in a snapshot](#secrets-in-a-snapshot)).

## snapshot

```bash
cohostly snapshot [--expires <Nd>] [--account <id>] [--root <dir>] [--timeout <duration>] [--probe-path <path>] [--compare-status] [--forward-loopback] -- <start command ...>
```

Only options **before** the `--` belong to the CLI. Everything after it is your start command.

| Flag | Type | Description |
| --- | --- | --- |
| `--root <dir>` | path | The application root. Default: the current folder. |
| `--timeout <duration>` | time, such as `60s` or `2m` | How long to wait for the app to start listening. Default `30s`. |
| `--probe-path <path>` | text | The page used to compare the original app and the container. Default `/`. |
| `--compare-status` | on or off | Make `check` compare only the status and content type, for pages whose body changes on every visit. Default off. |
| `--forward-loopback` | on or off | Forward the port of an app that listens only on `127.0.0.1`. Adds a small helper (`socat`) to the image. Default off. |
| `--expires <Nd>` | days | How long the sealed `env.enc` stays valid. `1d` to `30d`. Default `30d`. |
| `--account <id>` | text | Which account may deploy it. Default: the first account on your key. |

### Run it the right way

1. **Use your production start command**, the one you would run for real: `npm start`, `python app.py`, `gunicorn app:app`. Not a dev server with hot reload, which records the wrong command and port.
2. The command runs **directly, with no shell**. For `cd`, `&&` or `VAR=value`, say so:

```bash
cohostly snapshot -- sh -c "cd web && npm start"
cohostly snapshot -- env PORT=3000 npm start
```

3. **Sign in first**, so the values are sealed.

### What it does

1. Starts your command and waits up to `--timeout` for it to listen on a port.
2. Probes `--probe-path` and records the answer.
3. Reads the environment values your app was started with.
4. Asks the build planner (Railpack) for a plan.
5. **Runs your project's own build in a scratch copy, for up to 20 minutes**, to find build-time variables (see [values the build needs](#values-the-build-needs)).
6. Chooses a machine size.
7. Writes the `.cohostly/` folder.

The watching step takes seconds. An app with a build step can take much longer. All progress goes to your terminal's error stream.

### Files it writes

| File | Description |
| --- | --- |
| `.cohostly/Dockerfile` | The build plan. Single-stage and generated. Rewritten every time you snapshot. Notes at the top start with `TODO(cohostly):`, `WARNING(cohostly):` or `NOTE(cohostly):`. |
| `.cohostly/cohostly.json` | The settings: name, `runtime.language` (set to `dockerfile`), start command, `health.port`, `health.path`, optional `compute` and the **names** of the secrets. A `compute` you edited by hand is kept on the next snapshot. |
| `.cohostly/capture.json` | What was observed. `check` adds a verification record to it. |
| `.cohostly/env.json` | The values it saw. Readable only by you (`0600`). Replaced by `env.enc` after sealing. |
| `.cohostly/.gitignore` | Contains `env.json`, so the plain values never reach git. |
| `.cohostly/env.enc` | The values, sealed so only your account can deploy them. Readable only by you (`0600`), safe to commit. |

The Dockerfile is an ordinary Dockerfile, and `cohostly.json` is the same settings file the platform always reads.

### What it prints

```
snapshot (.cohostly/capture.json)
  runtime:  node on node:22-slim [observed]
  start:    npm start [observed]
  ports:    3000
  env:      API_KEY, STRIPE_KEY (values in .cohostly/env.json, owner-only)
  no value: STRIPE_KEY

Wrote .cohostly/ (Dockerfile, cohostly.json, capture.json). Next: cohostly check, then cohostly deploy.
Sealed 1 value(s) into .cohostly/env.enc (only your account can deploy them; expires 2026-11-26). The file is safe to commit.
```

The exact wording of the first lines can differ. The last two lines are the important ones.

### Notes in the Dockerfile

Only three kinds of note exist.

**`TODO(cohostly)`** is a question the tool could not answer. `cohostly deploy` stops while one is open.

- The app never listened on a port while it was observed. Which port does it serve on? Run snapshot again with a longer `--timeout`, or fix the port in `cohostly.json`.
- No start command was recorded. What command starts the app?
- The original app answered HTTP 500 or more at the probe path, and that answer is what `check` compares against. If that failure is not expected, run snapshot again with `--probe-path` set to a page that works.

**`WARNING(cohostly)`** never blocks. The one it gives: the app accepts connections on `127.0.0.1` only. Listen on `0.0.0.0` (or read `HOST`), or use `--forward-loopback`.

**`NOTE(cohostly)`** is information: the machine size it chose, the build-time variables it found, and variables that had no value.

### Secrets in a snapshot

Values come from the environment your app was started with, or from a `.env` file. They are never written into the Dockerfile, `cohostly.json`, a command line or any output. Names are written, values are not.

- **Signed in:** the values are sealed into `.cohostly/env.enc` and the plain `env.json` is deleted. `Sealed N value(s) into .cohostly/env.enc (only your account can deploy them; expires YYYY-MM-DD). The file is safe to commit.`
- **Not signed in, or offline:** sealing fails. The plain `env.json` stays: `Could not seal the values: <why>` and `.cohostly/env.json now holds them in plain text (git-ignored, but readable on this machine). Fix the above and run cohostly snapshot again to seal them, then delete env.json.`

A deploy carries at most 100 secrets. `env.enc` belongs to one account and expires. After that, or for another account, run `snapshot` again.

### Values the build needs

Some frameworks copy a value into the files the build produces, for example a public address inside a browser bundle. That value must exist while the app is **built**, not only when it starts. If it does not, the built app acts as if it were unset. A login button that never appears is the usual sign.

Snapshot finds these without knowing any framework. It builds a scratch copy once, gives every variable your app reads a unique marker value, and searches the files the build wrote for the markers. Variables it finds get a bare `ARG NAME` line before the build step. On deploy the platform turns each `ARG NAME` into `ENV NAME="value"` from the sealed values, for those names only. If you write your own Dockerfile, add `ARG NAME` before the step that needs it. Only public values belong here: anything copied into browser code is visible to every visitor. Changing one means deploying again.

## check

```bash
cohostly check [--generated] [--root <dir>] [--wait <duration>]
```

`check` builds the Dockerfile that would be deployed, starts it, and compares it with what snapshot saw. Think of a test drive before you buy. **It needs Docker.**

| Flag | Type | Description |
| --- | --- | --- |
| `--generated` | on or off | Use `.cohostly/Dockerfile` even if you have your own `./Dockerfile`. Default off. |
| `--root <dir>` | path | The application root. Default: the current folder. |
| `--wait <duration>` | time, such as `2m` | How long to wait for the container to answer. Default `90s`. |

It uses your own `./Dockerfile` if you have one, otherwise `.cohostly/Dockerfile`.

- **Success:** `ok: built and answered like the original app (42s)`.
- **Failure:** `the <phase> step failed (step: <step>):` followed by the last 25 log lines with secret values removed, then what it observed. That can be a module the app could not import, or system packages that provide files a command looked for. If nothing explains the failure it says `cannot decide: nothing observed explains this failure; read the log above.` Use that evidence. Do not guess a package name.
- For your own Dockerfile it says it was not changed, and offers `cohostly check --generated` and `cohostly deploy --generated`. For the generated one it says to copy `.cohostly/Dockerfile` to `./Dockerfile`, edit that, and run check again.

**`check` rewrites `.cohostly/capture.json`.** After every run, pass or fail, it adds a `verification` record (verified yes or no, the time, the image and a hash of the source). It never edits the Dockerfile.

Without Docker it stops with a message that Docker is needed to build the image, and adds that the snapshot is still deployable: the platform builds it. So you can skip `check`.

Exit code: the capture tool's. Zero on success, non-zero on failure. Output goes to the error stream.

## Deploy from the snapshot

```bash
cohostly deploy [folder] [--project <name>] [--generated] [--force] [--verbose]
```

Chosen when the folder has `.cohostly/cohostly.json` and you gave no `.cohostly` file and no `--manifest`. **Put the folder first** if you give one. See the warning on [put an app online](deploy.md).

| Flag | Type | Description |
| --- | --- | --- |
| `[folder]` | path | The folder with `.cohostly/` in it. Default `.`. |
| `--project <name>` | text | Project name. Default: the `name` in `.cohostly/cohostly.json`, which is the folder name. |
| `--generated` | on or off | Use the generated Dockerfile even if the root has its own. |
| `--force` | on or off | Deploy even if `TODO(cohostly)` questions are still open. |
| `--verbose`, `-v` | on or off | Print every build line. |

A snapshot deploy **never asks** a question. It ignores `--set`, `--yes`, `--draft`, `--manifest` and `--no-env-file`.

It prints `Deploying <project> with your Dockerfile ...` when the root has its own `Dockerfile`, or `... with the generated Dockerfile ...`. Then the outcome as on [put an app online](deploy.md), with the settings always shown.

**What is uploaded:** the app folder without `.cohostly`, `node_modules`, `.git`, `.next`, `.venv`, `venv`, `__pycache__`, and without root `.env`, `.env.local`, `.env.production` and `.env.production.local`. The generated Dockerfile is added unless the root has its own. The settings go as they are (with `name` replaced by the project). Values go only as secrets, from `env.json` or `env.enc`.

**Stops and refusals:**

| Message | What to do |
| --- | --- |
| `The snapshot has N open question(s) that were not decided (TODO lines in .cohostly/Dockerfile): ... Settle them, or deploy anyway with --force.` | Answer the TODO lines, or pass `--force`. Exit `1`. |
| `There is no snapshot in <dir>. Make one with: cohostly snapshot -- <start command>` | Run `snapshot` first. |
| `.cohostly/cohostly.json has no health.port. The app never listened while it was observed; set the port there, or snapshot again with a longer --timeout.` | Set the port, or snapshot again. |

Current behaviour: the last two refusals appear as `Fatal: Error: ...` followed by a stack trace, not as a tidy message. The first line is the one to read.

`WARNING(cohostly)` lines print as `Warning: ...` and `NOTE(cohostly)` lines as `Note: ...`. They never stop the deploy. A snapshot deploy that is held for approval exits `1`.

## Changing the build

- **Take over the Dockerfile.** Copy `.cohostly/Dockerfile` to `./Dockerfile` in the project root and edit that. A root Dockerfile is used as it is and must be single-stage. If it fails, its own error is shown and it is left alone. `check --generated` and `deploy --generated` use the generated one instead.
- **Change settings** (port, health path, bindings) in `.cohostly/cohostly.json`.
- **Change the machine size.** Snapshot writes `compute` only when the default (512 MB and 1 vCPU) is not enough, for example 2048 MB for `next build`. Edit `compute` in `.cohostly/cohostly.json`. A size you set by hand is kept when you snapshot again. A build killed partway through an install or build is usually out of memory, so raise the size one step.

## Files read and written

Writes `.cohostly/*` (snapshot) and `.cohostly/capture.json` (check). Reads `.cohostly/*` (check, deploy). Caches Railpack under `~/.cohostly/tools/` and the public key under `~/.cohostly/keys/`. Needs a saved key or `PLATFORM_API_KEY` for sealing and for deploy. `COHOSTLY_CAPTURE` and `COHOSTLY_RAILPACK` can point at your own copies of the tools.

## Exit codes

| Code | Description |
| --- | --- |
| `0` | Success. |
| `1` | A failed deploy, an open `TODO(cohostly)` without `--force`, or a deploy held for approval. |
| other | `snapshot` and `check` return the capture tool's own exit status. |

## Examples

Snapshot a Node app, give the build a longer wait, then test it:

```bash
cohostly snapshot --timeout 90s -- npm start
cohostly check --wait 3m
```

Snapshot an app whose home page changes on every visit, using a health page instead:

```bash
cohostly snapshot --probe-path /health --compare-status -- gunicorn app:app
```

Snapshot an app in a sub-folder, then deploy it under a name:

```bash
cohostly snapshot --root web -- npm start
cohostly deploy . --project shop-web
```

A full worked story is in [put your app online](../examples/put-your-app-online.md).

## Related pages

- [Put an app online](deploy.md): the plain folder deploy.
- [Pack and inspect](pack.md): seal a snapshot folder into one file.
- [Secrets](secrets.md): managing values by hand.
