---
title: Sign in and keys
description: "Sign in with login, use a key in CI, and understand what the saved key can do."
nav: Sign in and keys
---

Before most commands work, the CLI needs a key. A key is a long secret string that starts with `plk_`. Think of it as a house key, not a visitor pass: whoever holds it can open every door in that account.

## What the key is, plainly

When you run `cohostly login`, you end up with an **API key** saved on your computer. Be clear about what that means:

- It is **account-wide**. It acts as an **admin** on every project in the account you approved with, whatever your own role on a single project is.
- It **never expires**. It lasts until you revoke it in the dashboard.
- It carries all three permissions a key can have: read, deploy and manage.
- It is named `CLI login` with the date, so you can find it in the dashboard.

A plain member of an account who signs in with the CLI gets this same account-wide admin key. Treat the saved file like a password.

## login

```bash
cohostly login [--token plk_...] [--no-browser]
```

| Flag | Type | Description |
| --- | --- | --- |
| `--token <key>` | text | Skip the browser. Use a key you made in the dashboard. It must start with `plk_`. |
| `--no-browser` | flag | Do not open a browser. Print the address and the code, and open the page yourself. This is not in the printed command list, but it works. |

### The browser way

1. The CLI asks the platform for a one-time code, like `K7PM-2XQD`.
2. It prints the sign-in address and the code, then opens the page in your browser (unless you passed `--no-browser`).
3. You sign in to the dashboard as yourself and approve the code.
4. The CLI checks every 2 seconds. When you approve, it saves the key.

```
$ cohostly login

Open https://<dashboard>/cli-login and enter the code:

    K7PM-2XQD

Signed in. Your key is saved on this computer.
```

The code is valid for **10 minutes**. If you are on a server with no browser, add `--no-browser`, open the address on another device, and type the code there.

### The key-you-paste way

```bash
cohostly login --token plk_1a2b3c4d_...
```

The CLI checks the key with the platform. If it works, it prints `Signed in with the key you pasted.` If the value does not start with `plk_`, it prints `That is not an API key. Keys start with "plk_".` If the platform refuses it, it prints `The API did not accept that key.`

> **Careful** `--token` puts the key on the command line, and your shell may keep it in its history. For scripts and CI, use the `PLATFORM_API_KEY` variable below instead. It never touches a file or the history.

### If login fails

| Message | What to do |
| --- | --- |
| `Could not start sign-in: <error>` | The CLI could not reach the platform. Check your connection and `API_URL`. Exit code `1`. |
| `The code expired before it was approved. Run "platform login" again.` | You took longer than 10 minutes. Run `cohostly login` again. Exit code `1`. |
| `That code is wrong or has expired...` (shown in the dashboard) | Retype the code, or start again. |

## The saved key

The key is stored in `credentials.json`:

- Default place: `~/.config/cohostly/credentials.json`.
- Change the folder with `PLATFORM_CONFIG_DIR`.
- The folder is readable only by you (`0700`), and the file too (`0600`).
- The file is a map from **API address** to key, so one file can hold a key for each server you use.
- The platform stores only a hash of the key. It cannot show you the key again.

## PLATFORM_API_KEY, for CI

If `PLATFORM_API_KEY` is set, the CLI uses it and ignores the saved key. This is the way to run the CLI in a pipeline.

```bash
export PLATFORM_API_KEY="$COHOSTLY_KEY_FROM_YOUR_CI_SECRET_STORE"
cohostly deploy --project my-app --yes
```

Put the key in your CI system's secret store. Never put it in the repository.

## whoami

```bash
cohostly whoami
```

Asks the platform who the key belongs to. With a CLI key, the answer always looks like this:

```
key (key)
  account 3f6c0b5e-7a21-4d0e-9b57-1c2d8a4f6e90
```

It tells you that you hold a key, and which account the key belongs to. It never prints an email address. If the request fails, it exits with code `1`.

## logout

```bash
cohostly logout
```

Deletes the saved key for the **current API address** from `credentials.json` and prints `Signed out. The key on this computer was removed (revoke it in the dashboard to disable it everywhere).`

This only removes your local copy. The key still works for anyone who has a copy. To end it everywhere, revoke it in the dashboard. `logout` does not touch `PLATFORM_API_KEY`.

## When a key is refused

Any command prints one of these when the platform answers 401, and then the command's own error follows:

- `Your key was not accepted (revoked or expired). Run "platform login" again.`
- `You are not signed in. Run "platform login".`

You may see two lines. Run `cohostly login` again, or fix `PLATFORM_API_KEY`.

A key made in the dashboard can have fewer permissions than a login key. If one is too weak you will see `This API key can only <what>, so it cannot <what>. Make a key with the "<scope>" scope under Account settings, API keys.`

## Current behaviour to know about

- **Only your own account's projects.** `cohostly ls` lists the projects of the key's account, each with `you are admin`. Projects shared with you by invitation from another account are not reachable from the CLI.
- **Some actions need a signed-in person, not a key.** `secrets share` and `secrets request` are refused for a key. Their error says to run `login`, but `login` makes a key, so the advice does not help. Do these in the dashboard. See [secrets and keys](secrets.md).
- **Approving a CLI deploy.** A deploy made from the CLI is made by a key, and a key cannot approve a deploy that another key made. See [put an app online](deploy.md).

## Read next

- [Exit codes and environment variables](exit-codes-and-env.md): `API_URL`, `PLATFORM_CONFIG_DIR` and the rest.
- [Put an app online](deploy.md): your first deploy.
