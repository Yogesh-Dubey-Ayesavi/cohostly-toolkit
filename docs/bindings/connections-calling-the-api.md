---
title: Calling the API
description: "The SDK methods and their arguments, the official Google and Microsoft clients, plain HTTP for other languages, and the rules for paths."
nav: Calling the API
---

A call to a connection has the shape of the provider's own address, with the platform's address in front:

```text title="The shape of a call"
/connections/<name>/<the provider's own path>?<the provider's own query>
```

You write the part after the connection name exactly as the provider documents it. The platform chooses the host, adds the login and sends the request. The answer is the provider's answer.

Run `cohostly types` first. It writes `platform.gen.ts`, with one typed client for each connection you declared ([build and test locally](../cli/develop.md)).

## The SDK methods

Every connection has these six methods:

| Call | Type | Description |
| --- | --- | --- |
| `allowed()` | `Promise<Allowed>` | Asks whether the connection works. No arguments. See [asking what is allowed](connections-allowed.md). |
| `get(params)` | `Promise<unknown>` | Reads from the provider. `params` is `{ path }`. |
| `post(params, body?)` | `Promise<unknown>` | Sends a write or an action. `params` is `{ path }`. `body` is an optional JSON object. |
| `put(params, body?)` | `Promise<unknown>` | Replaces something. Same arguments as `post`. |
| `patch(params, body?)` | `Promise<unknown>` | Changes part of something. Same arguments as `post`. |
| `delete(params)` | `Promise<unknown>` | Deletes something. `params` is `{ path }`. It takes **no body**. |

There is no `head` method. The result is whatever the provider answered, as JSON.

```js title="Every method"
const sheet = platform.connections.sheet
const files = platform.connections.files

const rows = await sheet.get({ path: `v4/spreadsheets/${id}/values/A1:C100` })

await sheet.post(
  { path: `v4/spreadsheets/${id}/values/A1:append?valueInputOption=RAW` },
  { values: [[new Date().toISOString(), email]] },
)

await sheet.put({ path: `v4/spreadsheets/${id}/values/A1?valueInputOption=RAW` }, { values: [['hello']] })
await files.patch({ path: `drive/v3/files/${fileId}` }, { name: 'New name' })
await files.delete({ path: `drive/v3/files/${fileId}` })
```

Each path must be one that a permission of that connection allows. Here `sheet` would hold a Sheets permission and `files` would hold `drive.files`.

### Rules for the path

- Leading slashes are dropped. `'v4/spreadsheets/x'` and `'/v4/spreadsheets/x'` are the same.
- Each piece between slashes is encoded for you. Slashes stay slashes, and `:` and `@` stay as they are, so ranges such as `A1:B2` and actions such as `:batchUpdate` work as written.
- Everything from the first `?` on is sent **as you wrote it**. Encode the values in the query yourself, for example with `encodeURIComponent`.
- A response that is not JSON, such as a CSV, a PDF or a file download, comes back as `undefined` from these typed methods. Use the official client or `fetch` for downloads and uploads.

### Which paths to use

For **Google**, use the provider's path without the host: `calendar/v3/calendars/primary/events`, `v4/spreadsheets/<id>/values/A1:C100`, `gmail/v1/users/me/messages`, `drive/v3/files`. The platform picks the right Google host from the permission that allows the call.

For **Microsoft**, version 1.0 is already in the address, so paths start at `me/...`, `drives/...`, `sites/...` and so on: `me/events?$top=5`, `me/drive/root/children`. The `$` in a query goes through untouched.

## The official clients

Better than raw paths: hand Google's or Microsoft's own library to the connection. Every function, argument and type is the provider's own, so their documentation applies word for word. The real token never reaches your app.

> **Careful** Never give the client its own `auth`, key, root address or custom fetch. The helper sets those. If the client tries to call any other host, the call is refused with `host_refused`, so the platform's token never leaves the platform.

### The official Google client

`.google(factory, options)` works on connections whose provider starts with `google`. `factory` is the official function, such as `gmail` from `@googleapis/gmail`, or `sheets`, `drive`, `calendar`, `docs`. `options` is the library's own options **without** `auth`, `fetchImplementation` or `rootUrl`, such as `{ version: 'v1' }`.

```js title="Official Google client"
import { gmail } from '@googleapis/gmail'

const mail = platform.connections.mail.google(gmail, { version: 'v1' })
const list = await mail.users.messages.list({ userId: 'me', q: 'is:unread' }) // needs gmail.read or more
```

```py title="Official Google client"
# The helpers on this page belong to the JavaScript SDK.
# From Python, call the connection over HTTP (see "Over plain HTTP" below).
reply = requests.get(f"{base}/gmail/v1/users/me/messages", params={"q": "is:unread"},
                     headers=headers, timeout=35)
```

### The official Microsoft client

`.microsoft(graphSdk, kiota)` works on `microsoft-graph` connections. Import the Graph SDK, the Kiota fetch library, and each service package you use.

```js title="Official Microsoft client"
import * as graphSdk from '@microsoft/msgraph-sdk'
import * as kiota from '@microsoft/kiota-http-fetchlibrary'
import '@microsoft/msgraph-sdk-users'   // plus a package for each service you use

const graph = platform.connections.office.microsoft(graphSdk, kiota)
const mail = await graph.me.messages.get({ queryParameters: { top: 10 } })   // needs mail.read or more
```

```py title="Official Microsoft client"
# From Python, call the connection over HTTP.
reply = requests.get(f"{base}/me/messages?$top=10", headers=headers, timeout=35)
```

Notes for Microsoft:

- Use Graph **version 1.0** only. The beta client is refused with `version_not_supported`: "Use the v1.0 client (@microsoft/msgraph-sdk), not the beta one."
- `drives.byDriveId('me')` means your own OneDrive (`me/drive`), which is what the `onedrive` permissions open. Another drive id needs `files.all.read` or `files.all.write`.
- `/users/TokenToReplace`, which the client builds when it has no user id, is turned into `/me` for you.
- Downloading a file's content follows a redirect to a pre-signed address. The platform follows it for you, only for the hosts the provider uses for downloads (see below).

### A client for something else

`.fetch` is a `fetch` on Google and Microsoft connections, for any other client library. An address on `https://*.googleapis.com/...` (Google) or `https://graph.microsoft.com/v1.0/...` (Microsoft) is sent to the connection, with the binding token and the visitor's context. Any `Authorization` header you set is removed. Any other host is refused with `host_refused`.

## Over plain HTTP

Python, Go or any other language, and the cases where the SDK has no helper, call the connection's address directly. The platform sets these for your app ([environment](environment.md)):

- `CONNECTION_<NAME>_URL`: the address of one connection. `<NAME>` is its name in capitals, so a connection called `sheet` gives `CONNECTION_SHEET_URL`.
- `PLATFORM_TOKEN`: the pass for this project's bindings.

Send the pass in the header `x-platform-binding-token`. For a `user` connection, also forward the visitor's `X-Platform-Context` header exactly as your app received it. Check that token yourself first: see [Python, Go and other languages](../sdk/other-languages.md).

```js title="Plain HTTP call"
const base = process.env.CONNECTION_AGENDA_URL
const reply = await fetch(`${base}/calendar/v3/calendars/primary/events?maxResults=5`, {
  headers: {
    'x-platform-binding-token': process.env.PLATFORM_TOKEN,
    'x-platform-context': incomingContextHeader, // user mode only
  },
})
const body = await reply.json()
```

```py title="Plain HTTP call"
base = os.environ["CONNECTION_AGENDA_URL"]
headers = {
    "x-platform-binding-token": os.environ["PLATFORM_TOKEN"],
    "x-platform-context": incoming_context_header,  # user mode only
}
reply = requests.get(f"{base}/calendar/v3/calendars/primary/events", params={"maxResults": 5},
                     headers=headers, timeout=35)
body = reply.json()
```

Errors have the same body as above, with `error.code`. A `202` means a held write ([holding writes for approval](connections-write-approval.md)).

The platform times the provider out at 30 seconds, so give your own client a timeout a little longer.

## What the platform refuses in a path

The platform checks the path before it forwards anything. A path is refused with `400 path_refused` when:

- It does not start with `/`, is longer than 2048 characters, or the query is longer than 4096 characters.
- It has spaces, control characters, a backslash or raw non-ASCII letters. Percent-encode them.
- It has an encoded dot (`%2e`), slash (`%2f`), backslash (`%5c`), zero (`%00`) or percent sign (`%25`). Double encoding is refused too.
- It has a broken `%` escape, an empty piece (`//`), or a `.` or `..` piece.
- It is empty (`The path is empty.`). If nothing follows the name at all, you get `missing_path`.
- After all checks, it would leave the provider's service (`That path leaves the connector.`).

The fix for all of them: "Send a plain provider path with no .., encoded slashes or dots, or backslashes."

One trailing slash is ignored. The platform forwards the cleaned-up path, not the raw one.

### Query values that are dropped

These query names are silently removed and never forwarded, whatever their case: `access_token`, `key`, `api_key`, `apikey`, `token`, `client_secret`, `client_id`, `refresh_token`, `authorization` and `auth`. The platform brings the login itself, so your app has no reason to send one. If a call needs a parameter with one of those names, it cannot be made through a connection. Every other parameter keeps its order.

### Methods

Only `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `HEAD` can match a permission. Any other verb gets `403 call_not_allowed`.

When two rules fit, the most specific wins: a named method beats "any method", and then the rule with more fixed text in the path.

## What gets passed along

Of your request headers, only these reach the provider: `accept`, `accept-language`, `content-type`, `if-match`, `if-none-match`, `if-modified-since`, `if-unmodified-since`, `prefer` and `range`. The platform adds its own `Authorization` and a `user-agent` of `cohostly-connections/1`. Your own `Authorization` and every `X-Platform-*` header are dropped.

Of the provider's answer headers, only these come back: `content-type`, `etag`, `last-modified`, `cache-control`, `retry-after`, `content-language`, `content-disposition`, `content-range` and `accept-ranges`. No cookies are passed.

### Redirects

The platform does not follow redirects, with one exception: a `GET` or `HEAD` redirect to an `https` address on a host the provider uses for downloads (for example `.googleusercontent.com` for Google, or `.sharepoint.com`, `.1drv.com`, `.1drv.ms`, `.onedrive.com` and `.microsoftpersonalcontent.com` for Microsoft). It follows up to three, sends a plain `GET` with **no login**, and that is how pre-signed downloads work. Any other redirect answers `502 redirect_refused`.

## Trying it from your laptop

`cohostly dev --project <name> -- <command>` gives your command a short-lived pass for the real platform and sets the addresses ([build and test locally](../cli/develop.md)). Connection calls from your laptop go to the real platform and use the project's **real** grants. An owner-mode call acts on the owner's real account, so a write really writes. There is no pretend Google or Microsoft for local use.

Without `PLATFORM_TOKEN`, calls fail with `not_configured`.

## Retries

The SDK waits up to 30 seconds for each attempt. It tries again, up to two more times, on a network error, `429`, `502`, `503` and `504`, for `GET` and for changes (which carry a steady `Idempotency-Key`). Pauses grow, up to 5 seconds, or follow `retry-after`.

Next: [errors](connections-errors.md) and [limits](connections-limits.md).
