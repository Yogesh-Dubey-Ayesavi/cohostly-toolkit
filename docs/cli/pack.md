---
title: Pack and inspect
description: "Seal a folder into one .cohostly file that only one account can deploy, look inside it safely, and deploy it."
nav: Pack and inspect
---

`cohostly pack` seals your app into a single `.cohostly` file. Think of a courier bag with a combination lock that only one person knows. You can hand the bag to a colleague, store it in a repository or move it to a build server. Only people in the account it was made for can deploy it, and only until it expires.

Three commands work with these files.

| Command | What it does |
| --- | --- |
| `cohostly pack` | Seals a folder into a `.cohostly` file. |
| `cohostly inspect <file>` | Shows what a file says about itself, without opening the sealed parts. |
| `cohostly deploy <file>.cohostly` | Deploys the file. |

> **Careful** Sealing keeps the code and the secret values unreadable to anyone who finds the file. It is **not** end-to-end encryption. Cohostly and its hosting infrastructure still see the code while building it.

## pack

```bash
cohostly pack [folder] --out <file> [--no-secrets] [--env-file <file>] [--expires 7d] [--account <id>]
```

| Flag | Type | Description |
| --- | --- | --- |
| `[folder]` | path | The folder to seal. Default is the current folder. |
| `--out <file>` | path | **Required.** Where to write the file. Without it: `Say where to write the file, for example: cohostly pack --out app.cohostly`. |
| `--no-secrets` | on or off | Seal no secret values. Default off. |
| `--env-file <file>` | path | Take secret values from this file. Only the names your settings declare under `env.secrets` are taken. |
| `--expires <Nd>` | days | How long the file stays valid. `1d` to `30d`, whole days only. Default `7d`. Otherwise: `--expires needs a number of days from 1d to 30d, for example --expires 3d.` |
| `--account <id>` | text | The account that may deploy it. Default: the first account on your key. If you are not a member: `You are not a member of that account.` |

You must be signed in, because the CLI fetches the platform's public key and your account list. Who may run it: anyone signed in.

### What goes in the file

- **A folder with `.cohostly/`** (and no `cohostly.json` of its own at the top): the snapshot is packed, meaning its settings and its generated Dockerfile. See [snapshot and check](snapshot.md).
- **Otherwise**, the folder's `cohostly.json` or `manifest.json`. With neither, the settings are empty.
- The code, without `node_modules`, `.git` and similar folders, and **without any `.env` file**.

### Where the secret values come from

- In a snapshot folder where the plain file `.cohostly/env.json` still exists, those values are sealed in unless you pass `--no-secrets`.
- With `--env-file`, only the names declared in `env.secrets` are taken. Names that are missing from the file are listed: `Not in <file>, so not in the file: A, B.`
- If the folder only has `.cohostly/env.enc`, its values are not copied in: `The values in .cohostly/env.enc are not in this file (they are sealed for deploying from the folder). Add them with --env-file if the file should carry them.`

`pack` refuses to seal if a secret value appears in the readable settings, or if one name is both a plain variable and a secret.

### What it prints

```
$ cohostly pack --out app.cohostly --expires 3d
Wrote app.cohostly (412 KB). It expires 2026-11-01. Sealed secrets: STRIPE_KEY, MAIL_KEY.
```

With no secrets it ends with `No secrets inside.` The file is written readable only by you (`0600`).

### What is inside

A compressed archive holding `snapshot.json`, a readable copy of the settings (`cohostly.json`), the sealed code (`source.enc`) and, if there are secrets, the sealed values (`secrets.enc`). The code and the values are encrypted. The readable settings, the account and the expiry are bound into the seal, so editing any of them afterwards makes the file fail with `snapshot_tampered`.

## inspect

```bash
cohostly inspect <file>
```

Reads the file on your computer. It makes **no network call** and decrypts nothing. It prints:

- the file name, when it was `made`, and when it `expires` (with `(EXPIRED: make a new one with cohostly pack --out)` if past)
- `account`: `only people in this account can deploy it`
- `secrets`: `sealed inside: A, B`, or `not included; the settings name A, B, to be set under Secrets`
- `tools`: the build tool and CLI versions it was made with
- a `Build settings:` table
- `The code and the secret values are sealed; this command did not open them.`

Errors: `That is not a Cohostly snapshot.` and `Update Cohostly to open this file. It was made by a newer version.` Both exit `1`.

## Deploy a file

```bash
cohostly deploy app.cohostly [--project <name>] [--verbose]
```

- The project name defaults to the file name, lower-cased, with anything that is not a letter or digit turned into `-`.
- It prints `Deploying <project> from <file> ...`, then the usual outcome (see [put an app online](deploy.md)), then `Live: <url>`.
- **It never asks a question.**
- Files up to 25 MiB go in the request. Bigger files are uploaded to a temporary address first (valid for 15 minutes), then deployed from there. This is how a `.cohostly` file gets past the 30 MB limit of a plain folder deploy.

If the platform cannot open the file, the failure has a `Code:`:

| Code | Description |
| --- | --- |
| `snapshot_invalid` | Not a valid snapshot. Make a new one with `cohostly pack --out`, or update the CLI if a newer one made it. |
| `snapshot_expired` | It has expired. Make a new one. |
| `snapshot_wrong_account` | It was made for a different account. Sign in to that account, or make a new one from your own. |
| `snapshot_tampered` | It was changed after it was made. Make a new one. Never edit these files by hand. |
| `snapshot_unavailable` | The server cannot open sealed files yet. Deploy the folder itself, or try later. |

## Files read and written

Reads the folder (and the env file you name). Writes the `.cohostly` file. Caches the platform's public key under `~/.cohostly/keys`. If you are offline, `pack` uses the newest cached key. Needs a saved key or `PLATFORM_API_KEY`.

## Exit codes

`0` on success, `1` on any failure.

## Examples

Seal the current folder for three days and take secrets from a file:

```bash
cohostly pack --out app.cohostly --expires 3d --env-file .env.staging
```

Look inside a file before sending it on:

```bash
cohostly inspect app.cohostly
```

Deploy it under another name from a build server:

```bash
export PLATFORM_API_KEY="$COHOSTLY_KEY_FROM_YOUR_CI_SECRET_STORE"
cohostly deploy app.cohostly --project shop-staging
```

## Related pages

- [Snapshot and check](snapshot.md): the folder that `pack` can seal.
- [Put an app online](deploy.md): the other way to deploy.
- [Sign in and keys](login-and-keys.md): `PLATFORM_API_KEY` for build servers.
