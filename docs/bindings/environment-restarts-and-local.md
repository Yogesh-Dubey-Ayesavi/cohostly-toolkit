---
title: Restarts and local development
description: "When a changed variable reaches your app, what a restart changes, and what cohostly dev gives you and leaves out."
nav: Restarts and local runs
---

## When a change takes effect

The environment is fixed **when a sandbox is created**. An app that is already running, or paused, keeps the environment it started with until it is created again. So after `cohostly secrets set`, the command tells you: a running app picks the new value up the next time it starts.

| What happens | Effect on the environment |
| --- | --- |
| The app is running and you change a secret | No change yet. It keeps the old value until the sandbox is created again. |
| The app is resumed after a pause that kept its memory | The same process, the same variables and the same token. |
| The app starts after a pause that saved only its files, or is restarted | The environment is built again. You get a **new binding token** and today's secrets and `env.vars`. The old token keeps working for 10 more minutes. |
| You deploy a new version | The environment follows the settings file of the version being started. |
| You rotate the token | The app restarts and gets a new token. It takes a few seconds. |

Rotating the token has no command line command today. Use the dashboard button, an AI assistant connected to your account, or the platform API.

If you need a value to change **now**, restart the app after you set it.

## Local development with `cohostly dev`

```sh
cohostly dev --project my-app -- node server.js
```

The command asks the platform for a temporary **development token**. The token lasts about 12 hours and ends when your command ends. Your command runs with the same binding environment a sandbox gets: `PLATFORM_TOKEN`, `PLATFORM_BINDINGS`, the binding addresses, `PLATFORM_CONTEXT` and `PLATFORM_LOGS_URL`. It also gets the project's secrets, unless you pass `--no-secrets`.

The calls are real. Local runs use the live platform, so AI calls cost real money and count against the same caps ([data on your own computer](data-local-development.md) covers the database).

### What is different locally

| Difference | Description |
| --- | --- |
| No `env.vars` | The plain settings in your `cohostly.json` are **not** given to a local run. Put what you need in `.env.local`, or in your shell. |
| No `PLATFORM_AUTH_URL` | Verifying the signed request context needs it, and so does anything that fetches the platform's public keys. Set it yourself if you need it. |
| No `PLATFORM_LOGIN_URL` | The default sign-in path `/__platform/login` does not work as it does when deployed, unless you set the variable. |
| No `PORT` | The platform does not set it in production either. Choose a port in your code. |
| The live version's bindings | The development token follows the version that is live, so a binding you added to `cohostly.json` but have not deployed is not there yet. |
| No schedules, no timers | A development token cannot send schedules or create timers. Those calls answer 403 `read_only_token`. See [code-defined schedules and timers](cron-code-and-timers.md). |
| No secrets for an AI assistant | An assistant working for you never receives your secrets. |

### Which value wins

Platform variables always win. For secrets, the order is:

1. A value already in your shell.
2. A value in `.env.local`, or in the file you pass with `--env-file`.
3. The platform's stored secret.

When one of your own values replaces a platform secret, the command says so, for example "replaced by your own: STRIPE_KEY". A missing `.env.local` is fine. A missing file you named with `--env-file` is an error.

```sh
cohostly login
printf 'STRIPE_KEY=sk_test_local_only\n' > .env.local
cohostly dev --project stripe-demo -- node server.js                 # STRIPE_KEY comes from .env.local
cohostly dev --project stripe-demo --no-secrets -- node server.js    # no platform secrets at all
```

> **Careful** `cohostly deploy` also reads `.env.local`, and sends its values as secrets, unless you pass `--no-env-file`. Add it to `.gitignore`. See [your own values](environment-your-own-values.md).

## Read next

- [Environment variables](environment.md)
- [Your own values](environment-your-own-values.md)
- [Develop on your computer](../cli/develop.md)
