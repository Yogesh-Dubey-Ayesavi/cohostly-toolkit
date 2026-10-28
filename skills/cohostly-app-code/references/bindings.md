# Bindings and the `platform` object

Read this when the app calls a platform service. The AI gateway and connections are below; managed data, approvals and scheduled jobs each have their own file (`data.md`, `approvals.md`, `cron.md`). Worked apps for all of them are in `assets/examples/` (`recipes.md`). Also read it when `check_code` reports a problem with a platform call.

## What a binding is

A binding is a service the platform provides to the app: the AI gateway (`bindings.ai`), a managed database (`bindings.data`), connections to outside services (`bindings.connections.<name>`) and approvals (`bindings.approvals`). The app declares which ones it needs in its manifest. The platform gives it an address and a token, and the provider's own keys never enter the app.

## Status: what is live

All of these are live. `get_contract` is still the authority on what this project's `platform` object can call.

| Binding | Status |
| --- | --- |
| Secrets (`env.secrets`) | Live: `env` delivery only |
| Managed data (`bindings.data`) | Live: one database per project; `describe_data` shows the tables and row rules. See `data.md` |
| AI gateway (`bindings.ai`) | Live |
| Approvals (`bindings.approvals`) | Live in the dashboard; approval emails are not sent yet. See `approvals.md` |
| Connections (`bindings.connections.<name>`) | Live: Google and Microsoft. Slack is not set up yet. See "Connections" below |
| Scheduled jobs (`bindings.cron`) | Live. See `cron.md` |

Run `get_contract` for what the project's `platform` object can actually call right now (before the first deploy, `preview_contract` with the settings text does the same; do not deploy a placeholder app just to get it). If a call is not in the contract, the code cannot use it, and `check_code` will say so.

## The `platform` object

The SDK turns a generated route table into typed methods, one group per binding the project declares:

```ts
import platform from './platform.gen.js'

const reply = await platform.ai.messages({
  model: 'claude-haiku-5-5',
  messages: [{ role: 'user', content: 'hi' }],
})
```

The object owns the token, request IDs, idempotency keys, timeouts and retries, and it throws a `PlatformError` with a plain message. Catch that error and show or log the message; do not retry blindly on every error.

Generate the typed file from the project's declared bindings:

```bash
platform types --project <name>                 # writes platform.gen.ts
platform types --project <name> --check         # fails if the file is stale
platform types --project <name> --lang python   # Python, when supported
```

Commit `platform.gen.ts` and regenerate it after a manifest change. `--check` in CI catches a stale file.

## Allowed values come from the manifest

Values the manifest limits (for example the AI models in `bindings.ai.models`) are part of the contract. Use the list `get_contract` shows. A model the manifest does not allow fails with a plain message; the fix is to change the manifest, which the person decides. Do not switch to another model to get around it.

## Calling it from an ordinary client

Some stock SDKs can call the AI gateway directly, because the platform gives them a base URL and a key:

- `AI_BASE_URL` as the client's base URL.
- `AI_API_KEY` as the client's API key (it is the binding token).

Use this pattern for a stock client; use `platform.ai` when you want the typed contract. Do not hard-code the provider's own address.

## Other languages

The typed `platform` object is TypeScript. In Python, Go or anything else, make a client from the binding's OpenAPI document with any OpenAPI generator. The document is at `<binding url>/openapi.json` (the address is in `PLATFORM_BINDINGS`), requested with the binding token in the `X-Platform-Binding-Token` header. The platform checks that its five binding documents validate and that OpenAPI Generator's Python and Go clients compile (`packages/api/scripts/verify-generated-clients.mjs`).

A generated client covers the calls and their types. It does not cover what an app must do itself:

- verify the request context (`verify-token.md`);
- send the visitor's token as `X-Platform-Context` on calls made for them, so a row policy or a `user` connection knows who is asking;
- the per-table types of managed data (the generated client sees `findMany` and a body, not your columns);
- retries, and an `Idempotency-Key` on writes that must not run twice.

Anything the platform calls into the app (a scheduled job, an approval decision) is a webhook: serve it and check the platform's signature (`approvals.md`, `cron.md`).

## Connections

A connection lets the app call Google or Microsoft as an account, without ever holding a token. The manifest names it:

```json
"bindings": { "connections": {
  "sheet": { "provider": "google-sheets", "permissions": ["sheets.write"], "access": "user" }
} }
```

- `provider`: a connector id. `describe_connection` and `get_contract` list the permissions each one offers.
- `permissions`: what the app needs. The person connecting sees each one in plain words and can give less.
- `access`: whose account the app acts as.
  - `owner` (the default): the account the project's owner connected, for every visitor. Use it for "every submission goes into my sheet".
  - `user`: each visitor's own account. Use it for "your todos live in your own sheet".

The app calls the provider's own API path under the connection; the platform adds the credential:

```ts
const sheet = await platform.connections.sheet.get({ path: `v4/spreadsheets/${id}/values/A1:C100` })
```

**Providers:** `google-workspace` (Gmail, Drive, Sheets, Docs, Slides, Forms, Calendar, Tasks, Contacts, Chat, Meet, Keep, Apps Script, Classroom, Drive activity and labels, Admin directory, on one Google sign-in) and `microsoft-graph` (OneDrive and every file you can open, Excel, SharePoint, Outlook mail, calendar and contacts, To Do, OneNote, Teams, people). Each permission opens a whole service, so every function of that API works; read permissions allow only `GET`.

**Use the official Google and Microsoft clients through the connection.** Install the provider's own package and hand it to the connection; every function and type is the provider's, and the real token never reaches the app:

```ts
import { gmail } from '@googleapis/gmail'                       // or @googleapis/sheets, /drive, /calendar, /docs ...
const mail = platform.connections.mail.google(gmail, { version: 'v1' })
await mail.users.messages.list({ userId: 'me', q: 'is:unread' })

import * as graphSdk from '@microsoft/msgraph-sdk'
import * as kiota from '@microsoft/kiota-http-fetchlibrary'
import '@microsoft/msgraph-sdk-users'                             // plus each service package you use, e.g. -drives
const graph = platform.connections.office.microsoft(graphSdk, kiota)
await graph.me.messages.get({ queryParameters: { top: 10 } })
await graph.drives.byDriveId('me').items.byDriveItemId(id).content.get()   // 'me' = the person's own OneDrive
```

- Do not give the client an `auth`, a key or a `rootUrl`, and do not point it at the provider yourself: the helper wires it. (Google's uploads ignore `rootUrl`, which is why the helper replaces the client's fetch instead.)
- The visitor's context goes along automatically when the call is made inside a request the SDK `middleware()` handles, which `access: "user"` needs.
- Microsoft: v1.0 only (not beta). `@microsoft/msgraph-sdk` is still labelled preview by Microsoft.
- Errors from the platform (not connected, a file outside the grant, a permission not given) come back through the client as an HTTP error with the platform's `{ error: { code, message, how_to_fix } }` body.

**Many visitors, each with their own account (multi-tenant).** With `access: "user"` the app never runs an OAuth flow, holds a token or keeps a table of who connected what: the Connect button is `connect_url` (the platform's connect page, with the provider's own consent), and the platform picks the connection from the signed request context. Ask `allowed()` first for one of three states per visitor (`not_connected`, `active`, `needs_reauth`) and give each its button; `connect_url` is on all three. `assets/examples/connect-accounts` is the complete app.

**`access: "user"` needs the request context.** The platform finds the visitor's connection from the signed `X-Platform-Context` token, so a call made outside a request (a timer, a job) cannot use it, and the call must happen inside a request the SDK `middleware()` is handling (it forwards the token for you). Without it the call fails with `caller_unknown` (401).

**Handle these answers.** They are normal states, not bugs:

| Code | Status | What to do |
| --- | --- | --- |
| `connection_required` | 409 | The visitor has not connected yet. Send them to `err.connectUrl` (one page, one consent, then back). Show a "Connect Google" button rather than an error. |
| `connection_needs_reauth` | 409 | The person who connected must reconnect (dashboard, Connections). |
| `no_grant` | 403 | `owner` mode and nobody connected it. Tell the owner to open Connections in the dashboard. |
| `caller_unknown` | 401 | `user` mode called without the request context. Make the call inside a handled request. |
| `outside_grant` | 403 | The grant is limited to certain files and this is not one of them. |
| `permission_not_granted` | 403 | The person gave less than the manifest asks. Say which permission is missing. |
| 202 with `approval_id` | 202 | A write waits for approval. Re-send the same request with `X-Platform-Approval-Id` once it is approved. |

`GET /connections/<name>/__allowed` tells the app, before it tries, whether this visitor is connected, which permissions are in effect and the `connect_url`. Use it to decide whether to show the connect button.

```ts
try { rows = await platform.connections.sheet.get({ path }) }
catch (e) { if (e instanceof PlatformError && e.code === 'connection_required') return redirect(e.connectUrl!) ; throw e }
```

Never ask the visitor for a file id. A connection made with picked-file access (`sheets.files`, `drive.files`) reaches the files they choose in Google's picker on the connect page and the files the app creates; a file the app creates is added to the grant automatically.

## Checking code before deploy

`check_code` (MCP) type-checks TypeScript files against the contract and returns plain problems: a wrong argument, a disallowed model, a binding the project has not declared. Send the files as a map of path to source. Fix the problems, then run it again until it says there are none.

## Rules

- **Declare what you use.** A call to a binding the manifest does not declare fails. Add it to the manifest (through the person, see `cohostly-host`), then regenerate types.
- **Do not hold the token.** Do not log it, return it to a browser, or save it to a file.
- **Handle the failure.** Calls can be refused (a cap reached, a rule denied, a binding not live). Show the person the plain message and stop; do not loop.
- **Do not bypass.** If a call is refused for a policy reason, the policy is the person's to change. Do not reach the provider directly to get the answer.
