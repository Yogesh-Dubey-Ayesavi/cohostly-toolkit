---
title: Build and test locally
description: "Run your app on your own computer with a project's services using cohostly dev, generate typed code with types, and check bindings."
nav: Develop locally
---

Three commands help you work on your own computer. `dev` runs your app with the real platform services plugged in. `types` writes typed code for those services. `bindings check` shows which services a project uses. Think of a test kitchen that is wired to the real pantry: you cook at home, with real ingredients.

Cost estimates have their own page: [cost](cost.md). Checking settings before a deploy is `cohostly manifest check`, on [put an app online](deploy.md#cohostly-manifest-check).

## dev

```bash
cohostly dev --project <name> [--no-secrets] [--env-file <file>] -- <command ...>
```

`--project` is required. Everything after `--` is your command.

| Flag | Type | Description |
| --- | --- | --- |
| `--project <name>` | text | **Required.** The project whose services and secrets you use. |
| `--no-secrets` | on or off | Do not load the project's secrets. Default off. |
| `--env-file <file>` | path | Your own values, which replace the platform's secrets of the same name. Default `.env.local`. |

Who may run it: an **editor**. Secrets are only loaded for a person, never for an assistant.

### What it does

1. Asks the platform for a [dev token](tokens.md) for this project and this computer. It lasts 12 hours and reaches only the dev environment.
2. Builds your command's environment (see the order below).
3. Runs your command. Ctrl-C and termination signals are passed on to it.
4. When your command ends, it deletes the token (on a best-effort basis; the token would end by itself in 12 hours anyway).

Nothing is written to disk.

```
$ cohostly dev --project shop -- npm start
Dev token ready for shop, valid until 11:42:08 PM. It reaches only the dev environment.
Loaded 2 secrets from the platform (1 replaced by your own: STRIPE_KEY).
Not set on the platform yet: MAIL_KEY.
Running: npm start
```

A command of one word runs through a shell. A command of several words runs directly.

### Which value wins

| Kind of value | Order, strongest first |
| --- | --- |
| The platform's own variables (token, service addresses) | Always win. |
| Secrets | Your shell's environment, then your local file (`.env.local` or `--env-file`), then the platform's value. |

A missing `--env-file` stops with `<file> was not found.` (exit `1`). A missing default `.env.local` is fine.

### Things that are different from the real thing

> **Careful** `cohostly dev` uses the project's **single live database**. There is no separate test copy. Rows you write while testing are real rows.

- A locally run app has **no visitor context**. There is no signed-in visitor, because nobody is visiting through the platform. Your code must cope with a missing context.
- It **cannot sync schedules or create timers**. Code schedules are not registered, and timers fail with a read-only-token error. See [schedules](jobs-and-approvals.md).
- Your project's plain settings (`env.vars`) are not delivered. Put them in your local file.

### Exit code

Your command's own exit code. If it could not start: `Could not run "<command>": <message>` and exit `127`.

## types

Generates the typed `platform` object that your code imports to use [bindings](../bindings/overview.md).

```bash
cohostly types --project <name> [--check] [--out <dir>] [--lang python]
cohostly types --local [--check] [--out <dir>] [--lang python]
```

| Flag | Type | Description |
| --- | --- | --- |
| `--project <name>` | text | Read the contract of a **live** project. Needs an editor. |
| `--local` | on or off | Work the contract out from your folder **before you deploy**. Needs only sign-in. |
| `--check` | on or off | Write nothing. Exit `1` if the file is out of date. Good for CI. |
| `--out <dir>` | path | Where to write. Default: the current folder. |
| `--lang <name>` | text | `typescript` (the default) or `python`. Otherwise: `--lang can be typescript or python. Other languages can use the OpenAPI documents the gateway serves, at <address>/openapi.json.` |

### The two modes

- **`--project`** makes a dev token, asks the platform for a description of each binding the **live version** declares, generates the code on your computer, then ends the token.
- **`--local`** reads `cohostly.json` (or `manifest.json`) and `migrations/*.sql` in your folder and asks the platform what the contract would be. Use it before the first deploy, and whenever `cohostly deploy` says `platform.gen.ts` is stale.

### What it writes

`platform.gen.ts` and `platform.contract.md`, or `platform_gen.py` and `platform.contract.md` with `--lang python`.

```
Wrote platform.gen.ts and platform.contract.md for: ai, data.
```

With no bindings: `Wrote platform.gen.ts. No bindings are declared yet.` With `--check`: `platform.gen.ts is up to date.` A failed read: `Could not read the project's contract (HTTP N).`

Commit `platform.gen.ts`. `cohostly deploy` stops when it is stale or edited by hand (see [put an app online](deploy.md#the-types-check)). Regenerate it after you change the settings file or a database migration.

## bindings check

```bash
cohostly bindings check <project>
```

Shows which platform services a project uses. Needs an **editor**. The project is positional.

```
ai            active    last used 10/27/2026, 9:14 AM    <what it provides>
data          declared  last used never                  <what it provides>
Available, not used: connections, cron
App token <hint> (<slot>), running, last used 10/27/2026, 9:14 AM.
```

- One line per **declared** binding: its name, `active` if the project has a live version or `declared` if not, when it was last used, and what it provides.
- `This project declares no bindings. Add one under "bindings" in cohostly.json and deploy.` if none.
- `Available, not used: a, b` lists the ones you could add.
- The app token line shows whether the app is running.
- If the app's token was used from two different places, you see `The app's token was used from a different place: first <a>, then <b> (<time>). Give it a new token in the dashboard if you do not recognise it.`

## Files read and written

`types` reads `cohostly.json` or `manifest.json` and `migrations/*.sql` (with `--local`), and writes `platform.gen.ts` or `platform_gen.py`, and `platform.contract.md`. `dev` reads `.env.local` or `--env-file`. `bindings check` touches no files.

## Exit codes

`0` on success, `1` on failure. `types` exits `1` when `--check` finds a stale file. `dev` returns your command's code.

## Examples

Run a server against a project's real services, with your own test key:

```bash
echo 'STRIPE_KEY=sk_test_123' > .env.local
cohostly dev --project shop -- node server.js
```

Make the types before the first deploy, and fail CI when they drift:

```bash
cohostly types --local
cohostly types --local --check
```

See which services a project really uses:

```bash
cohostly bindings check shop
```

## Related pages

- [Dev tokens](tokens.md): the pass `dev` makes for you.
- [Secrets](secrets.md): what `dev` loads.
- [Bindings](../bindings/overview.md): the services you are connecting to.
