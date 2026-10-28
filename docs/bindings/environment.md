---
title: Environment variables
description: "Every variable the platform sets for your app, which ones are secret, and exactly when each one appears."
nav: Environment variables
---

You never write the platform's variables. The platform sets them when it creates the sandbox your app runs in, so code in any language reads them the usual way: `process.env`, `os.environ`, `os.Getenv`.

Think of the environment as the name tag and the keys the platform hands your app at the door. The tag says where things are (addresses). One key, the token, opens the platform's services for your app, so it must stay in your pocket.

Only two variables hold the token (`PLATFORM_TOKEN` and `AI_API_KEY`), and the values you add as secrets. Everything else is an address or a setting, and is not secret.

## Always set

These are in every sandbox the platform creates, whatever your settings file says.

| Variable | Secret | Description |
| --- | --- | --- |
| `PLATFORM_TOKEN` | **yes** | The app's binding token. It is the app's one credential for calling the platform's services. Send it in the header `X-Platform-Binding-Token`. Never print it, log it or send it to a browser. |
| `PLATFORM_CONTEXT` | no | JSON that says which facts about callers your settings file asks the platform to give your app, such as `{ "preset": "...", "expose": [...] }`. `cohostly types` reads it. You rarely need it yourself. |
| `PLATFORM_LOGS_URL` | no | Where the platform's own helper in the sandbox sends logs and metrics. It is for the helper. Your app should not use it. |

## Set when you declare a binding

| Variable | Secret | Description |
| --- | --- | --- |
| `PLATFORM_BINDINGS` | no | Set when at least one binding is declared. JSON that maps each binding's name to its address and kind. `ai` also lists its `models`. `connections` lists each connection's address, permissions and provider. The token is not in it. |
| `AI_BASE_URL` | no | With `bindings.ai`. The AI gateway's address, ending in `/ai`. |
| `AI_API_KEY` | **yes** | With `bindings.ai`. The **binding token itself**, so stock AI libraries can send it as their key. It is not a provider key. |
| `APPROVALS_URL` | no | With `bindings.approvals`. The approvals address, ending in `/approvals`. |
| `DATA_URL` | no | With `bindings.data`. The database address. |
| `CRON_URL` | no | With `bindings.cron`. The clock address. |
| `CONNECTION_<NAME>_URL` | no | One for each declared connection. `<NAME>` is the connection's name in upper case. The address of that connection's gateway. |

> **Good to know** `cohostly manifest check` shows a placeholder where `AI_API_KEY` would be. At run time, the value is the real token.

## Set only when the platform starts your app for a visitor

| Variable | Secret | Description |
| --- | --- | --- |
| `PLATFORM_LOGIN_URL` | no | A path on your app's own address, `/__platform/login`. Send an anonymous visitor there to sign in. |
| `PLATFORM_AUTH_URL` | no | The platform's address. Your app fetches the public keys from `<it>/.well-known/jwks.json` to verify the signed request context. It is also the issuer of that token. |

These two are added when the platform creates a sandbox to serve visitors. They are **absent** in sandboxes made for something else: a command-job sandbox for a scheduled run, and the throwaway sandbox used at deploy. `PLATFORM_AUTH_URL` is also set only when the platform has an auth address configured. A script that never serves visitors does not need either one.

## Set only for scheduled command runs

These appear in a sandbox that runs a command for the clock binding. They are not set while your app serves visitors. More in [what your app receives](cron-what-your-app-receives.md).

| Variable | Secret | Description |
| --- | --- | --- |
| `PLATFORM_RUN_ID` | no | The run's id, a UUID. |
| `PLATFORM_SCHEDULE_NAME` | no | The schedule's or timer's name. |
| `PLATFORM_SCHEDULED_FOR` | no | The planned time, as an ISO date in UTC. |
| `PLATFORM_RUN_ATTEMPT` | no | 1 on the first try, 2 on the first retry, and so on. |
| `PLATFORM_RUN` | no | The handler's name. Set only for a job defined in code and run on a script. The SDK then runs only that handler. |
| `PLATFORM_RUN_PAYLOAD_FILE` | no | The path of a JSON file with the run's payload. Set in the same case as `PLATFORM_RUN`. |

## Your own values

| Variable | Secret | Description |
| --- | --- | --- |
| Names in `env.vars` | no | The plain text value you wrote in `cohostly.json`. |
| Names in `env.secrets` | **yes** | The value you set with `cohostly secrets`. Present once a value has been set. |
| `NODE_EXTRA_CA_CERTS` | no | Set when your app uses `env.inject`. The path to the platform's certificates, `/etc/ssl/certs/ca-certificates.crt`. |

How to declare them, the name rules, and how to set a secret without it passing through a chat are on [your own values](environment-your-own-values.md).

## Not set by the platform

- `PORT`. The platform does **not** set it. Listen on the port you declared in `health.port`. `Number(process.env.PORT) || 3000` is a safe habit, as long as 3000 matches `health.port`.
- `PLATFORM_APP_URL`, `PLATFORM_PROJECT_ID` and `PLATFORM_VERSION`. These are not set either. If your app needs its own address to build a link, use the request's host header.

## What is not a variable

Facts about each visit (who is calling, from where) change with every request. They arrive as headers and a signed token, not as environment variables. See [request context](../sdk/request-context.md).

## Reserved names

You cannot use these for your own variables or secrets:

- Anything starting with `PLATFORM_` or `CONNECTION_`.
- `AI_API_KEY`, `AI_BASE_URL`, `APPROVALS_URL`, `DATA_URL`, `CRON_URL` and `PORT`.

For a secret the platform refuses the name. For `env.vars` it is worse: a reserved name may pass the check and then be **silently dropped** when the app starts. Pick another name. See [your own values](environment-your-own-values.md).

## Never

- Commit a `.env` file with real values. Add it to `.gitignore`. (If you leave it in the folder, `cohostly deploy` also reads it. See [your own values](environment-your-own-values.md).)
- Print `PLATFORM_TOKEN`, `AI_API_KEY` or a secret in a log line, an error message or a response. Printing a name is fine. Printing a value is not.
- Send a secret to the browser. Keep it in server code.

## Read next

- [Your own values](environment-your-own-values.md): `env.vars`, secrets, name rules, `.env` files.
- [Restarts and local development](environment-restarts-and-local.md): when a change takes effect, and what `cohostly dev` leaves out.
- [Secrets](../cli/secrets.md): setting a value from the command line.
