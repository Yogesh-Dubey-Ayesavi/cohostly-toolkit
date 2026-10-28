---
title: Your own values
description: "Plain settings and secrets for your app: how to declare them, the name rules, how a secret is delivered, and how .env files are read at deploy."
nav: Your own values
---

There are two kinds of value you add yourself. A **plain setting** is not secret, and lives in `cohostly.json`. A **secret** has its name in `cohostly.json` and its value stored by the platform, never in your folder.

## Plain settings: `env.vars`

```json title="cohostly.json"
{
  "env": {
    "vars": { "SHEET_ID": "abc123", "LOG_LEVEL": "info" },
    "secrets": ["STRIPE_KEY"]
  }
}
```

- Values are text only.
- Names match `^[A-Za-z_][A-Za-z0-9_]{0,127}$`: letters, digits and `_`, starting with a letter or `_`, up to 128 characters.
- A reserved name is **silently dropped** when the app starts. It may even pass `cohostly manifest check` and then not appear. See Reserved names below.
- Never put a secret **value** here. The file is saved with your project.

## Secrets: `env.secrets`

List the **name** in `env.secrets`, then set the value separately:

```sh
cohostly secrets set STRIPE_KEY
```

The command asks for the value with a hidden prompt, or reads it from standard input. You can also import a file with `cohostly secrets import --file`, or ask someone else to enter it:

```sh
cohostly secrets request STRIPE_KEY
```

That prints a secure link that works once and expires in 15 minutes. Whoever opens it enters the value as themselves, so the value never passes through a chat. The dashboard can set a secret too. Showing a stored value needs a recent sign-in. An AI assistant never receives your secrets. See [secrets](../cli/secrets.md).

Secret rules:

- Names match `^[A-Z][A-Z0-9_]{0,63}$`: capital letters, digits and `_`, starting with a letter, up to 64 characters.
- A value can be up to 64 KB.
- A project's own secret beats an account-wide secret of the same name.
- A missing secret does **not** stop the app from starting. The platform notes the missing names in its logs and the app starts without them. Check for the variable in your code and say its name, never its value, when it is missing.

```js title="config.js"
const stripeKey = process.env.STRIPE_KEY
if (!stripeKey) {
  console.error('STRIPE_KEY is not set: ask the owner for a secure link (cohostly secrets request STRIPE_KEY)')
}

const bindings = JSON.parse(process.env.PLATFORM_BINDINGS ?? '{}')
console.log('bindings:', Object.keys(bindings))      // names are safe to log. PLATFORM_TOKEN is not.
if (!process.env.APPROVALS_URL) throw new Error('bindings.approvals is not declared')
```

```py title="config.py"
import json, os

bindings = json.loads(os.environ.get("PLATFORM_BINDINGS", "{}"))
print("bindings:", list(bindings))                   # names are safe to log. PLATFORM_TOKEN is not.

api_key = os.environ.get("STRIPE_KEY")
if not api_key:
    print("STRIPE_KEY is missing; ask the owner for the secure link")   # the name, never the value
```

## How a secret is delivered

By default a secret becomes an environment variable of the same name. Two other settings change that.

| Setting | Description |
| --- | --- |
| `env.secrets: ["NAME"]` | The default. The secret is an environment variable in the sandbox. |
| `env.strict_secrets: ["NAME"]` | The name must also be in `env.secrets`, and the project must use `lifetime.pause_mode: "filesystem"`. The secret is given only to your app's start command, not to the whole sandbox, so it is not saved when the sandbox is paused with its memory. It is handed over again on every start. |

## Reserved names

Do not use these for a secret or for `env.vars`:

- Anything starting with `PLATFORM_` or `CONNECTION_`.
- `AI_API_KEY`, `AI_BASE_URL`, `APPROVALS_URL`, `DATA_URL`, `CRON_URL` and `PORT`.

What happens if you do:

- A **secret** with a reserved name is refused when you set it.
- An **`env.vars`** entry with a reserved name is dropped when the app starts, with no error. `cohostly manifest check` catches many but not all of them (for example `PORT` and `PLATFORM_TOKEN` pass the check and are dropped later). Treat the list above as the rule.

If two sources set the same name, the platform's own binding variables always win. A secret cannot replace `PLATFORM_TOKEN`.

## `.env` files at deploy

`cohostly deploy` reads these files from your project's root folder, and a later one wins over an earlier one:

1. `.env`
2. `.env.local`
3. `.env.production`
4. `.env.production.local`

What it does with them:

- It sends every value as a **secret**. It prints the names and never the values.
- It sends at most 100 values in one deploy.
- It ignores a file over 1 MiB, and skips empty values.
- It leaves out these names, and all reserved names: `HOST`, `NODE_ENV`, `PATH`, `HOME`, `PWD`, `TZ`, `LANG`, `CI` and `DEBUG`.
- `--no-env-file` sends nothing.

> **Careful** A `.env.local` file you made for local testing is read at deploy too, and its values become secrets. Add every `.env*` file to `.gitignore`, and use `--no-env-file` if you do not want them sent.

## Read next

- [Restarts and local development](environment-restarts-and-local.md)
- [Environment variables](environment.md)
- [Secrets](../cli/secrets.md)
