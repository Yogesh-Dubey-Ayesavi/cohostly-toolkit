---
title: Put an app online
description: "Deploy a folder with cohostly deploy: every flag, what gets uploaded, how .env files are handled, the settings question, and what the output means."
nav: Deploy
---

`cohostly deploy` takes a folder on your computer and puts it online. Think of posting a parcel. The CLI packs the box, the platform opens it, builds the app inside and starts it, and you get back the address.

Every deploy makes a new **version**. Older versions are kept, so you can go back (see [versions and rollback](versions-and-rollback.md)).

## Three kinds of deploy

`cohostly deploy` does one of three things. It picks by looking at what you gave it.

| You run | What happens |
| --- | --- |
| `cohostly deploy app.cohostly` | The sealed file is deployed. See [pack and inspect](pack.md). |
| `cohostly deploy [folder]` and the folder has `.cohostly/cohostly.json`, and you did not pass `--manifest` | The **snapshot** in that folder is deployed. See [snapshot and check](snapshot.md). |
| Anything else | The folder is deployed as it is. This page. |

> **Careful** The CLI works out "which folder is it" by taking the first word that does not start with `--` and does not directly follow `--project`. A flag **value** such as the `2048` in `--set compute.memory=2048` or the `3000` in `--port 3000`, or the short flag `-y`, can be mistaken for the folder if you put it before the real folder. A folder with no snapshot in it makes the CLI quietly fall back to the plain-folder deploy, so your snapshot is not used. **Always put the folder first**, for example `cohostly deploy . --port 3000`. This is current behaviour, read from the code. Also note that a snapshot deploy ignores `--set`, `--yes`, `--draft`, `--manifest` and `--no-env-file`. To change the machine size after a snapshot, edit `compute` in `.cohostly/cohostly.json`.

## Usage

```bash
cohostly deploy [folder] [--project <name>] [--manifest <file>] [--set <path>=<value>] [--yes] [--verbose]
```

The folder defaults to the current folder. Nothing is required.

| Flag | Type | Description |
| --- | --- | --- |
| `[folder]` | path | The folder to deploy. Default `.`. If it does not exist: `Error: directory not found: <path>`. Put it first. |
| `--project <name>` | text | The project to deploy to. Default: the folder's name. A new name makes a new project. |
| `--manifest <file>` | path | Use this settings file instead of `cohostly.json` or `manifest.json` in the folder. A missing file stops with `Error: manifest file not found: <path>`. Passing it also stops the snapshot deploy. |
| `--set <path>=<value>` | text, repeatable | Change one setting, for example `--set compute.memory=1024`. The value is read as JSON if it is JSON, otherwise as text. It wins over the file. A bad form stops with `Error: --set needs a setting and a value, for example --set compute.memory=1024`. |
| `--yes`, `-y` | on or off | Accept the settings without asking. Default off. |
| `--draft` | on or off | Ask the platform for the settings only. Default off. It does **not** always stop; see [the settings question](#the-settings-question). |
| `--show-settings` | on or off | After a successful deploy, also print `Settings used:` with each setting, its value and where it came from. Default off. |
| `--no-env-file` | on or off | Do not send values from `.env` files. Default off. |
| `--skip-types-check` | on or off | Do not check `platform.gen.ts` against the project's contract. Default off. |
| `--verbose`, `-v` | on or off | Print every build line. Default off. |

Without `--verbose`, a terminal shows one live line (`  42s  <newest build line>`). A pipe or a log file gets one line per stage. `PLATFORM_VERBOSE=1` does the same as `--verbose`.

### Shortcuts for common settings

Each shortcut is the same as a `--set`. A missing value stops with, for example, `Error: --port needs a value, for example --port 3000`.

| Flag | Type | Description |
| --- | --- | --- |
| `--language <name>` | text | Same as `--set runtime.language=<name>`. |
| `--node-version`, `--python-version`, `--go-version <v>` | text | All three set `runtime.version`, kept as text. |
| `--root <dir>` | path | Same as `runtime.root`: the folder inside your project that holds the app. |
| `--install <command>` | text | Same as `runtime.install_command`. |
| `--build <command>` | text | Same as `runtime.build`. |
| `--start <command>` | text | Same as `runtime.entrypoint`: the command that starts the app. |
| `--port <n>` | text | Same as `health.port`: the port the app listens on. |
| `--package-manager <name>` | text | Same as `runtime.package_manager`. |

Who may run it: an **editor** or higher of an existing project, or anyone with an account for a new project name. Names are global across all accounts. If a name belongs to someone you cannot see, you get `The name "<x>" is already taken. Pick another name, for example "<x>-2".`

## What deploy does, in order

1. Works out the folder and the project name.
2. Reads `--manifest` if you gave one.
3. **Checks `platform.gen.ts`**, if the folder has one. It asks the platform what the file should be and refuses to deploy if they differ. See [the types check](#the-types-check).
4. **Packs the folder** into a `.tar.gz` with the system `tar`.
5. **Checks the size** (see [upload size](#upload-size)).
6. **Reads your `.env` files** and prepares their values (see [.env files](#env-files-are-never-uploaded)).
7. Prints `Deploying <project> ...` and uploads. Progress streams back as labelled steps: `Analysing`, `[1/4] Uploading`, `[2/4] Building`, `[3/4] Starting`. The text after each label comes from the platform.
8. Prints the outcome.

### What is left out of the upload

These are never packed, at any depth: `node_modules`, `.git`, `.vercel`, `.next`, `__pycache__`, `.DS_Store` and files that start with `._`. The four root files `.env`, `.env.local`, `.env.production` and `.env.production.local` are also left out.

If nothing is left after that, you get `Could not pack <dir>: ...`, including `there is nothing to deploy here except .env files, and those are never uploaded`.

### .env files are never uploaded

The CLI does not upload your root `.env` files. It reads them and sends their **values as secrets** instead, stored with your project's secrets and not with your code.

- The four files are read in this order, and later files win: `.env`, then `.env.local`, then `.env.production`, then `.env.production.local`.
- Files over 1 MB and symbolic links are skipped.
- A name is dropped if it is not capital letters, digits and underscores starting with a letter (up to 64 characters), if it is a common system name (`HOST`, `NODE_ENV`, `PATH`, `HOME`, `PWD`, `TZ`, `LANG`, `CI`, `DEBUG`), if the platform sets it itself (`AI_API_KEY`, `AI_BASE_URL`, `APPROVALS_URL`, `DATA_URL`, `CRON_URL`, `PORT`, or anything starting with `PLATFORM_` or `CONNECTION_`), or if its value is empty.
- The CLI prints the **names**, never the values: `Found 3 value(s) in your .env files (STRIPE_KEY, MAIL_KEY, DB_URL). They are sent securely and stored with your secrets, not with your code.`
- With `--no-env-file` it prints `Your .env files were left out and no values were sent (--no-env-file).`
- More than 100 values stops the deploy: `Your .env files hold N values. A deploy can carry at most 100. ...` (exit `1`).

> **Careful** A `.env.local` that holds a throwaway test key will be sent as a secret too. Use `--no-env-file`, or move the file, if you do not want that. To manage values by hand instead, see [secrets](secrets.md).

### Upload size

Two limits apply, and they are different.

- The CLI checks the packed folder and refuses above **50 MB**: `The folder is N MB after packing; the limit is 50 MB (a hosted platform may accept less). Remove build output and large files (node_modules and .git are already left out).`
- The hosted platform accepts about **30 MiB** in one request. A folder between 30 and 50 MB passes the CLI check and is then refused by the server: `The server refused the upload because it is too large (about 30 MB is the most it accepts in one request). Leave out build output, large data files and dependency folders (node_modules and .git are already left out), then deploy again.`

Treat **30 MB** as the real limit. A plain folder deploy has no way around it. A sealed `.cohostly` file has one, described in [pack and inspect](pack.md).

### The types check

If your folder contains `platform.gen.ts` (the typed code from [`cohostly types`](develop.md)), deploy compares it with what the platform expects and **stops** when they differ (exit `1`):

- `platform.gen.ts was edited by hand. Run "platform types --local" to restore it, or deploy with --skip-types-check.`
- `platform.gen.ts is older than your manifest or migrations, so the code was written against types that no longer match. Run "platform types --local", fix any errors it shows in your code, then deploy again (or deploy with --skip-types-check).`

Run `cohostly types --local`, fix your code, and deploy again. Use `--skip-types-check` only when you know why the file differs.

## The settings question

Your **settings** are what the app needs: language, start command, port. They live in `cohostly.json`. If you have no settings file, the platform works them out from your code (with its build planner) and may ask you to confirm. This is the only question the CLI ever asks.

| Situation | What happens |
| --- | --- |
| The folder has `cohostly.json` (or our `manifest.json`), or you pass `--manifest` | No question. The platform deploys. This is true even with `--draft`. |
| No settings file, in a terminal, no flags | The CLI asks for a draft. If the plan is clean, it deploys at once. If not, it prints the draft and asks. So the question is often skipped. |
| No settings file, in a terminal, `--yes` | Deploys with the generated settings and does not ask. |
| No settings file, no terminal, no flags | Deploys with the generated settings and does not ask. |
| No settings file, no terminal, `--draft` | Prints the draft and `Nothing was deployed. Run again with --yes to accept these settings, or save them as cohostly.json in your folder.` Exit code `2`. |
| No settings file, **in a terminal**, `--draft` | Prints the draft and **still asks** `Deploy with these settings? [Y]es / [e]dit / [n]o:`. Yes deploys. |

A plan is "clean" when every setting came from the build planner, a default or your `.env` files, no model was needed to guess, nothing is risky against the live version, and every secret the app declares has a value.

The question:

```
There is no manifest, so here are the settings worked out from your code:

  runtime.language       node                               [high]
                         Railpack read package.json and planned this.
  runtime.entrypoint     npm start                          [high]
                         Railpack read package.json and planned this.
  health.port            3000                               (standard) [high]

Deploy with these settings? [Y]es / [e]dit / [n]o:
```

- `y`, `yes` or Enter deploys. The confirmation is valid for 15 minutes.
- `n` or `no` prints `Cancelled. Nothing was deployed.` and exits `0`.
- `e` or `edit` opens the settings as JSON in `$VISUAL` or `$EDITOR`. If it is not valid JSON, `That is not valid JSON, so the edit was ignored.` Then it asks again.

`(standard)` marks a value that is not in your settings file. The tag in brackets is how sure the planner is.

> **Good to know** In a script, the reliable pattern is to save the settings once as `cohostly.json`, then deploy. Then nothing ever asks. If you have no file yet, run `cohostly deploy --draft` where there is no terminal to read the plan, then deploy with `--yes` to accept it.

## What it prints

### Live

```
Deployed project: hello (version v3)
URL:    https://hello-4k2xq.cohostly.cloud
```

After that you may see `Notice: ...` lines, `Since version v2: <summary>` with up to 12 `+ added`, `- removed` and `~ modified` lines, a `Build settings:` table with where each value came from (`set by you`, `seen when you ran it`, `detected by Railpack`, `worked out from the code`, `the standard setting`), `Settings used:` (with `--show-settings`, or always for a snapshot deploy) and `Warning: ...` lines. Exit `0`.

A new project starts **private**. The CLI does not say so. A deploy never changes who can open the app. A `visibility` line in a settings file is ignored with a warning. Use [`cohostly share`](sharing.md) to change it.

### Held for approval

If the project holds new versions for an admin ([ship](ship.md)):

```
Version v4 is built and waiting for an admin to approve it. Visitors keep seeing v3.
  - <what is risky about it>
Approve it here: <request address>
Or run:          platform ship approve <project> <request>
```

A folder deploy exits `0` here. A snapshot deploy exits `1`. A deploy request stays open for **7 days**.

> **Careful** The line `Or run: platform ship approve ...` will not work for a version you deployed with the CLI, because a CLI key cannot approve a request another CLI key made. Approve it in the dashboard. See [ship](ship.md).

### Failed

```
Deployment failed while building.
  Code:            build_failed_dependency
  What went wrong: <cause>
  What to do:      <fix>
```

You may also see the last lines of the build log, `Try again in N seconds.` and exit code `1`.

| Code | Description |
| --- | --- |
| `unsupported_runtime` | This kind of app is not supported. Node, Python, Go and plain websites run today. |
| `not_detected` | The platform could not tell how to run it. Add a `package.json`, `requirements.txt`, `go.mod` or `index.html`, or write a `cohostly.json`. |
| `unsupported_version` | That runtime version is not available. Use Node 16, 18 or 20 to 24, Python 3.9 to 3.13, or Go 1.18 to 1.29. |
| `unsupported_build` | The build step cannot be run. Use `npm run <script>`, `pnpm run <script>`, `yarn <script>` or `npx next build`. |
| `build_failed_dependency` | A package could not be installed. Check its name and version, then deploy again. |
| `build_failed_command`, `build_failed` | The build failed. Run the same build on your computer and fix what it shows. |
| `build_out_of_memory` | The build ran out of memory. Build locally and upload the result, or make the build lighter. |
| `missing_secret` | A secret has no value. Add it under [secrets](secrets.md), then deploy again. |
| `port_mismatch` | Nothing listened on the expected port. Listen on `PORT`, or set `health.port`. |
| `binds_loopback` | The app listens only on `127.0.0.1`. Listen on `0.0.0.0`, or read `HOST`. |
| `start_crashed` | The app stopped as soon as it started. Read the output and fix the error. |
| `upload_too_large` | The upload is too large. Leave out build output and big data files. |
| `provider_busy` | The hosting service is busy. Wait a few minutes. Nothing is wrong with your app. |
| `snapshot_invalid`, `snapshot_expired`, `snapshot_wrong_account`, `snapshot_tampered`, `snapshot_unavailable` | Problems opening a sealed `.cohostly` file. See [pack and inspect](pack.md). |

A version must answer on its port before it goes live. If it does not, the deploy fails at the `starting` stage with a diagnosis. For more fixes see [troubleshooting](../limits/troubleshooting.md).

Other refusals you may meet: `There is nothing in this upload: no files were found...`, account limits in the form `Your account has reached its limit of N <what> (you have M). <how to fix>`, and `The platform is busy right now ...`. For the numbers see [limits](../limits/limits.md).

## Files read and written

Reads the folder, the settings file, the four root `.env` files, and `platform.gen.ts` if present. Reads the saved key (`PLATFORM_API_KEY`, or `credentials.json` in `PLATFORM_CONFIG_DIR`). Writes nothing to your folder.

## Exit codes

| Code | Description |
| --- | --- |
| `0` | Live, held for approval (folder deploy), or you answered `n`. |
| `1` | Any failure, or held for approval in a snapshot deploy. |
| `2` | `--draft` with no terminal and no settings file. Nothing was deployed. |

## Examples

Deploy the current folder under its folder name:

```bash
cohostly deploy
```

Deploy another folder, set the port and the machine size, and accept the settings:

```bash
cohostly deploy ./api --project shop-api --port 3000 --set compute.memory=1024 --yes
```

Check the settings without deploying (see below), then deploy without sending `.env` files:

```bash
cohostly manifest check ./api
cohostly deploy ./api --no-env-file
```

## cohostly manifest check

Prints the effective settings and every error and warning a deploy would give, **without deploying or storing anything**. Use it after editing `cohostly.json`.

```bash
cohostly manifest check [folder] [--manifest <file>] [--set <path>=<value>] [--project <name>]
```

It accepts the same `--set` and shortcut flags as deploy. Anything other than `check` as the first word prints a usage line and exits `1`.

| Flag | Type | Description |
| --- | --- | --- |
| `[folder]` | path | The folder to read. Default `.`. |
| `--manifest <file>` | path | Check this file. |
| `--set <path>=<value>` | text, repeatable | Check with this override applied. |
| `--project <name>` | text | Check against an existing project. You must be an editor of it. The answer also says who can ship there, and whether this settings file would make a deploy wait for an admin. |

It reads `cohostly.json`, or `manifest.json` if it is ours. If both exist it uses `cohostly.json` and says `Both cohostly.json and manifest.json are here; cohostly.json was used.` A `manifest.json` that is a web-app manifest is ignored.

Output, in order: `Manifest: <path> (version N)` or `Manifest: none found in <dir>`; `Errors (a deploy would stop):` (exit `1`); `Warnings:`; `Notices:`; with `--project`, `Who can ship in <project>: <label>`; a table of each setting with its value and its source (`flag`, `file` or `default`); and `Environment a bound app will see (set by the platform, never by you):` with `NAME=value` lines. Those values are made by the platform. They are not your secrets.

Failures: `Error: settings file not found: <path>`, `Check failed: <error>`. For the settings themselves see [the settings file](../settings/cohostly-json.md).

## Related pages

- [Start from a template](new-templates.md): a tiny project to deploy.
- [Snapshot and check](snapshot.md): deploy an app that is already running on your machine.
- [Ship](ship.md): hold new versions for approval.
- [Secrets](secrets.md): values your app needs.
- [Exit codes and environment variables](exit-codes-and-env.md): for scripts.
