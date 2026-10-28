# Environment variables the platform sets

Read this when the app reads a setting or an address from its environment, or when a variable is missing at runtime.

The owner never writes these. The platform sets them when it creates the app's sandbox, so code in any language reads them with its usual call (`os.environ`, `process.env`, `os.Getenv`). Only the token and secret values are secret; everything else is an address or a plain fact.

## Set now

| Variable | Set when | Holds | Secret |
| --- | --- | --- | --- |
| `PLATFORM_LOGIN_URL` | always | Where to send an anonymous visitor to sign in. A path on the app's own host, so it works after a link reset. | no |
| `PLATFORM_AUTH_URL` | always | The platform's address. The SDK fetches public keys from `<it>/.well-known/jwks.json`. | no |
| `PLATFORM_BINDINGS` | a binding is declared | A JSON map of each binding's name to its address and kind. | no |
| `PLATFORM_TOKEN` | a binding is declared | The app's binding token. Its one credential. | **yes** |
| `AI_API_KEY` | `bindings.ai` declared | The same binding token, so stock SDKs send it as their key. | **yes** |
| `AI_BASE_URL` | `bindings.ai` declared | The AI gateway address. | no |
| `APPROVALS_URL` | `bindings.approvals` declared | The approvals address. | no |
| `DATA_URL` | `bindings.data` declared | The managed-data address. | no |
| `CONNECTION_<NAME>_URL` | each connection declared | The gateway address for that connection. | no |
| names in `env.secrets` | each secret set | The secret's value. | **yes** |

Note on the binding variables: a variable is set only for a binding the manifest declares. Check `describe_bindings` or `get_contract` before writing calls that depend on it.

## In the roadmap, not set yet

These appear in the platform plan but do not exist in the code today. Do not rely on them until a test deploy shows them:

- `PORT`: the plan says always set. Read it if present; otherwise the app must listen on the port the health check uses (`health.port`).
- `PLATFORM_APP_URL`: the app's own public address.
- `PLATFORM_PROJECT_ID`, `PLATFORM_VERSION`: the project ID and the version running.

If the app needs its own address to build a link, prefer the request's own host header or the context's `request` fields until `PLATFORM_APP_URL` exists. Say so in a code comment so the next person knows why.

## Things that are not variables

Per-request facts (who is calling, where they are) do not come through the environment. They change with every request, so they arrive as headers and a signed token. See `context.md`.

## Secrets in the environment

Secrets are set by the platform, from the secret store, when the app starts. The owner adds the value through a secure link (`request_secret`), never through the chat. The code reads it by name, like any variable:

```python
import os
stripe_key = os.environ["STRIPE_KEY"]  # set by the platform from env.secrets
```

- Use `.get()` or an equivalent and handle a missing value with a clear message: a missing secret does not stop a deploy, so the app may start without it. Say which name is missing.
- Reserved names cannot be secrets: `PLATFORM_*`, `CONNECTION_*`, `AI_API_KEY`, `AI_BASE_URL`, `APPROVALS_URL`, `DATA_URL`, `CRON_URL`, `PORT`. The binding token always wins over a secret with the same name.
- For local runs, `platform dev` loads the project's secrets into the environment without writing them to disk. A value set in your own `.env.local` takes precedence there.

## Never

- Commit a `.env` with real values. Add it to `.gitignore`.
- Print `PLATFORM_TOKEN`, `AI_API_KEY` or a secret in a log line, an error message or a response.
- Send a secret to the browser. Keep it in server code.
