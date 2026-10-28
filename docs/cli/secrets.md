---
title: Secrets
description: "Give your app passwords and keys without ever putting them in code: list, set, import, delete, share and request secrets from the command line."
nav: Secrets
---

A secret is a value your app needs but that must never be in your code: a payment key, a password, a database token. The rule is simple. The value goes from your keyboard into the platform's secret store. It does not pass through a chat, a settings file, a repository or a log. Think of a hotel safe. You put the valuables in once, and the staff hand them to your room when you arrive.

This page covers `cohostly secrets`. Keys for scripts are on [dev tokens](tokens.md), and keys for AI providers are on [AI keys](ai-keys.md).

## How your app gets a secret

1. List the **names** your app needs in `cohostly.json` under `env.secrets`:

```json title="cohostly.json"
{ "env": { "secrets": ["STRIPE_KEY"] } }
```

2. Set the value with `cohostly secrets set STRIPE_KEY --project shop`.
3. When the app starts, the platform puts each value in its environment. Your code reads it by name: `process.env.STRIPE_KEY` or `os.environ["STRIPE_KEY"]`.

- A project's own secret wins. If it has none, the account's **shared** secret of that name is used.
- Values reach an app when it **starts**. A running app picks up a new value the next time it starts.
- If a deploy fails with `missing_secret`, a secret the app declares has no value. Add it, then deploy again.

## Usage

```bash
cohostly secrets <list | set NAME | import --file .env | delete NAME | share NAME | request NAME> --project <name>
```

`--project <name>` is **required**. With no project or no subcommand, the usage line prints and the command exits `1`.

### Names and sizes

- The CLI **upper-cases** the name. `secrets set stripe_key` sets `STRIPE_KEY`.
- A name is capital letters, digits and underscores, starts with a letter, and is up to 64 characters: `A secret name is upper-case letters, digits and underscores, starting with a letter, up to 64 characters, for example STRIPE_KEY.`
- Reserved names are refused, because the platform sets them: `AI_API_KEY`, `AI_BASE_URL`, `APPROVALS_URL`, `DATA_URL`, `CRON_URL`, `PORT`, and anything starting with `PLATFORM_` or `CONNECTION_`. The message is `<name> is a name the platform sets itself, so it cannot be used for a secret. Pick another name.`
- A value can be up to **64 KB**: `That value is too large. A secret can be up to 64 KB.`

### Who may run what

| Subcommand | Role needed |
| --- | --- |
| `list`, `set`, `import`, `delete` | editor |
| `share` | editor, **and** an account owner or admin, **and** a signed-in person (a key is refused) |
| `request` | editor, **and** a signed-in person (a key is refused) |

Revealing a value is **not** in the CLI. It is in the dashboard, for project admins who signed in within the last 5 minutes.

> **Careful** A CLI sign-in produces a **key**, not a signed-in person. So `secrets share` and `secrets request` cannot succeed from the CLI today. Their error says `Run "platform login" to sign in as yourself, then try again.` That advice does not help, because `login` makes a key. Do those two in the dashboard. See [sign in and keys](login-and-keys.md).

## list

```bash
cohostly secrets list --project shop
```

```
STRIPE_KEY                    this project            changed 10/27/2026   used by shop v7
MAIL_KEY                      shared by the account   changed 10/20/2026   not asked for by any version

This project needs a secret called DB_URL. Add it under Secrets.
```

Each line is the name (padded), where it is set (`this project` or `shared by the account`), when it changed, and which versions ask for it. A message after a blank line names secrets the live version asks for that have no value. With none: `No secrets yet.` **Values are never printed.**

## set

```bash
cohostly secrets set STRIPE_KEY --project shop
printf %s "$VALUE" | cohostly secrets set STRIPE_KEY --project shop
```

The value is typed at a **hidden prompt** on a terminal, or read from a pipe (one trailing newline is removed). It is never a command argument, so it never lands in your shell history. Ctrl-C at the prompt exits `130`.

Prints `STRIPE_KEY was added.` or `STRIPE_KEY has a new value.` followed by `A running app picks it up the next time it starts.` An empty value: `No value was given, so nothing was changed.`

## import

```bash
cohostly secrets import --file .env.production --project shop
```

Sends the file's text, and the platform reads the `KEY=value` lines. `export` and quotes are accepted. The default file is `.env`. At most **100** values per call.

```
Set 3 secret(s) (STRIPE_KEY, MAIL_KEY, DB_URL).
Skipped line 7: <reason>.
```

Skipped lines give a reason: an invalid name, no value, or not in the form `NAME=value`. A missing file: `<file> was not found.`

## delete

```bash
cohostly secrets delete OLD_KEY --project shop
```

Prints `OLD_KEY was deleted.` It does not ask first. It is refused while the live version still asks for it: `OLD_KEY is still used by shop v7. Remove it from env.secrets in the manifest and deploy first, then delete it.`

## share

```bash
cohostly secrets share MAIL_KEY --project shop
```

Makes a project's secret available to **every project in the account**. On success: `MAIL_KEY is now shared with every project in the account. A project's own secret with the same name still wins.` Refusals: `Only an account owner or admin can share a secret across the account.` (always, for a CLI key) and `The account already has a shared secret called MAIL_KEY. Rename or delete one of them first.`

## request

```bash
cohostly secrets request STRIPE_KEY --project shop
```

Prints `Open this link signed in as yourself and type the value. It works once, for 15 minutes:` and a link. **The link works only for the person who made it.** Anyone else gets `This link is not for you, or it does not exist.` So it is not a way to let someone else type a value. To have another person supply a value, ask them to run `cohostly secrets set` themselves, or to use the dashboard. And a CLI key is refused outright (see above).

## Files read and written

`import` reads the file you name. Nothing is written to your folder. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. A network failure prints `Fatal: TypeError: fetch failed`; see [exit codes](exit-codes-and-env.md).

## Exit codes

`0` on success, `1` on any failure, `130` for Ctrl-C at the hidden prompt.

## Examples

Add a key from a password manager without it touching a file:

```bash
pass show shop/stripe | cohostly secrets set STRIPE_KEY --project shop
```

Load a whole file, then check the names:

```bash
cohostly secrets import --file .env.production --project shop
cohostly secrets list --project shop
```

Retire a key, in the right order:

```bash
cohostly deploy .          # a version that no longer lists OLD_KEY in env.secrets
cohostly secrets delete OLD_KEY --project shop
```

> **Careful** Never print a secret in a log line, an error message or a web page. Never send one to a visitor's browser. Never commit a `.env` file with real values. For how `cohostly deploy` treats `.env` files, see [put an app online](deploy.md).

## Related pages

- [Dev tokens](tokens.md): let code on your machine reach one project.
- [AI keys](ai-keys.md): bring your own model key.
- [Build and test locally](develop.md): `cohostly dev` loads a project's secrets for you.
