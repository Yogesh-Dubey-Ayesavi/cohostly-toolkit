---
title: Connection errors
description: Every error code a connection can answer with, its exact message, what it means and how to fix it.
nav: Errors
---

When a call to a connection is refused, you get an error with a code you can test for. Most of them are not bugs. They are ordinary states, like "nobody has connected yet", and the right response is a friendly screen.

## The shape of an error

Every error from the platform has this body:

```json title="An error body"
{
  "error": {
    "code": "connection_required",
    "message": "This person has not connected Google Sheets for this tool yet.",
    "how_to_fix": "Send the person to connect_url. It is one page and one consent; they come back and the call works.",
    "connect_url": "(the page to send them to)",
    "connection": "sheet"
  }
}
```

`message` says what happened. `how_to_fix` says what to do. Some errors add extra fields, such as `connect_url` and `connection`.

In the SDK the call throws a `PlatformError`. It has `.status`, `.code`, `.message`, `.howToFix`, `.requestId`, `.details` (the extra fields) and `.connectUrl` (the same as `details.connect_url`).

```js title="Test for a code"
import { PlatformError } from '@cohostly/sdk'

try {
  await platform.connections.agenda.get({ path })
} catch (e) {
  if (e instanceof PlatformError && e.code === 'connection_required') return res.redirect(e.connectUrl)
  throw e
}
```

```py title="Test for a code"
reply = requests.get(url, headers=headers, timeout=35)
if reply.status_code >= 400:
    error = reply.json()["error"]
    if error["code"] == "connection_required":
        return redirect(error["connect_url"])
```

Through the official Google client the error arrives as the library's own HTTP error, with the platform's body in `response.data`, so read `e.response.data.error.code`. The Microsoft client raises its own error type.

When the provider itself answers with an error, its status and body come back **unchanged**. The code is then the provider's, not one from this page.

`<name>` below is the name of your connection and `<Provider>` is the provider's display name, such as Google Workspace.

## Normal states

These are the ones to design for. Each should lead to a button or a plain sentence.

| Code | Type | Description |
| --- | --- | --- |
| `connection_required` | 409 | **When:** `user` mode, and this visitor has not connected yet. **Message:** `This person has not connected <Provider> for this tool yet.` **Fix:** send the person to `connect_url`. It is one page and one consent. The error carries `connect_url` and `connection`. |
| `no_grant` | 403 | **When:** `owner` mode, and nobody has connected the account or given it to the tool. **Message:** `Nobody has connected <Provider> for "<name>" in this project yet.` **Fix:** the project's owner opens Connections in the dashboard, connects the provider and gives this tool access. |
| `connection_needs_reauth` | 409 | **When:** the provider no longer accepts the login. **Message:** `The connection "<name>" (<account label>) needs to be connected again. <reason>` **Fix:** in `owner` mode, ask the person who connected it to open Connections and click Reconnect. In `user` mode the error has a `connect_url`: send the person there. Calls work again as soon as they finish. |
| `connection_revoked` | 410 | **When:** someone disconnected it. **Message:** `The connection "<name>" was disconnected.` **Fix:** connect it again in Connections in the dashboard. It has the field `connection` and no `connect_url`. |
| `caller_unknown` | 401 | **When:** `user` mode, and the platform cannot tell which person is asking: no request context, an anonymous visitor, or a call outside a request. **Message:** `This connection acts as the person using the tool, and the platform does not know who that is.` **Fix:** forward the request's `X-Platform-Context` header on the call (the SDK does it inside `middleware()`). A call that is not on behalf of a signed-in person cannot use a person's connection. |
| `outside_grant` | 403 | **When:** the grant is narrowed to certain files, and the call names none or a different one. **Message:** one of `This connection is limited to specific files, and this call is not about one file.`, `This call does not name a file.`, `This connection is not allowed to use that file.` **Fix:** the owner limited this tool to specific files. Ask them to add this one in Connections. |
| `permission_not_granted` | 403 | **When:** some permission would allow the call, but this connection does not have it. **Message:** `<METHOD> <path> needs a permission this connection does not have. <why>` **Fix:** the error says which permission would allow it and what allowing it means, and lists them in `needs`. `<why>` is one of: "The connection was not given the access this needs; it must be reconnected with more access." (reconnect and allow it), "The tool's manifest does not declare the permission this needs." (add it to `permissions` and deploy), "The grant does not include the permission this needs." (the person gave less than you asked for). |

## Mistakes in your app

These mean something in your code or manifest is off. Fix it and try again.

| Code | Type | Description |
| --- | --- | --- |
| `connection_not_declared` | 404 | **When:** the name is not in `bindings.connections`. **Message:** `This project has not declared a connection called "<name>".` **Fix:** add the name under `bindings.connections` with a provider and permissions, then deploy again. |
| `unknown_provider` | 400 | **When:** the provider id is not a connector the platform offers. **Message:** `"<id>" is not a connector the platform offers.` **Fix:** use one of the ids listed in the answer. |
| `missing_path` | 400 | **When:** nothing follows the connection name. **Message:** `Add the provider path after the connection name.` **Fix:** for example `/connections/<name>/<the provider's own path>`. |
| `path_refused` | 400 | **When:** the path breaks one of the [path rules](connections-calling-the-api.md#what-the-platform-refuses-in-a-path). **Message:** the reason, such as `The path is too long.` **Fix:** send a plain provider path with no `..`, encoded slashes or dots, or backslashes. |
| `call_not_allowed` | 403 | **When:** no permission this provider offers allows that method and path at all. **Message:** `<Provider> does not allow <METHOD> <path> through the platform.` **Fix:** the answer links to the list of calls that can be made. Only calls on that list are reachable. |
| `provider_mismatch` | 409 | **When:** the connection given to the tool belongs to a different provider than the manifest names. **Message:** `The connection granted to "<name>" is a <p> connection, but the manifest asks for <id>.` **Fix:** change the manifest's provider or give the right connection. |

## Size, speed and time

| Code | Type | Description |
| --- | --- | --- |
| `request_too_large` | 413 | **When:** the body is bigger than this provider allows. **Message:** `The request body is larger than <N> KB.` **Fix:** send less in one call. |
| `connection_rate_limited` | 429 | **When:** this connection was used more than its per-minute limit. **Message:** `This connection is being used too fast for <Provider>.` **Fix:** wait a moment and try again. The header `retry-after` is the seconds until the next minute. |
| `upstream_timeout` | 504 | **When:** the provider took longer than 30 seconds. **Message:** `<Provider> did not answer.` **Fix:** try again in a moment. |
| `upstream_unreachable` | 504 | **When:** the platform could not reach the provider. **Message:** `<Provider> did not answer.` **Fix:** try again in a moment. |
| `response_too_large` | 502 | **When:** the provider's answer is bigger than the limit. **Message:** `<Provider>'s answer is larger than <N> MB.` **Fix:** ask for less, such as a smaller range or one page. |
| `redirect_refused` | 502 | **When:** the provider sent the platform to somewhere it will not follow. **Message:** `<Provider> answered with a redirect to <host>, which the platform does not follow.` **Fix:** this call cannot be made through the platform. |

The SDK already retries `429`, `502`, `503` and `504` for you (twice more). It does not retry `403`, `409` or `410`. See [limits](connections-limits.md).

## Approvals

A held write is not an error. It is a `202` with an `approval_id`. See [holding writes for approval](connections-write-approval.md).

| Code | Type | Description |
| --- | --- | --- |
| `approval_not_valid` | 400, 403, 404, 409 | **When:** you sent `X-Platform-Approval-Id` and the platform cannot accept it. The error has a `reason`. **Fix:** send the write again without the header to ask for a new approval. |
| `approval_unavailable` | 503 | **When:** the platform could not create the approval. **Message:** `The approval could not be created.` **Fix:** try again in a moment. |

The error says why in `reason`, with its own message and status:

| Reason | Type | Description |
| --- | --- | --- |
| `not_found` | 404 | `There is no such approval for this project.` |
| `wrong_request` | 403 | `This approval was made for a different request. Even one changed byte needs a new approval.` |
| `not_approved` | 403 | `This approval is <status>.` It is still pending, or was denied. |
| `expired` | 403 | `This approval was given more than an hour ago.` |
| `used` | 409 | `This approval was already used. A repeat of the same write needs a new approval.` |

If the header is not an approval id at all, the status is 400 and the message is `X-Platform-Approval-Id is not an approval id.` The fix then reads: send the `approval_id` the 202 answer gave you.

## Platform setup and odd ones

| Code | Type | Description |
| --- | --- | --- |
| `oauth_app_not_configured` | 503 | **When:** the platform has no sign-in app for this provider, and it needs one to renew a login. **Message:** `<Provider> is not set up on this platform yet.` **Fix:** the platform operator has to add it. Nothing in your app can fix this. |
| `not_found` | 404 | **When:** the address is just `/connections/<name>/` with no real path. **Message:** `Call a provider path under /connections/<name>/.` **Fix:** for example `/connections/sales/<the provider's own path>`. |

## Errors from the SDK itself

These come from the SDK, before or instead of an answer from the platform.

| Code | Type | Description |
| --- | --- | --- |
| `network_error` | 0 | The call never got an answer. The SDK retries first. |
| `not_configured` | 0 | **Message:** `PLATFORM_TOKEN is not set.` or `This code is not running with platform bindings.` **Fix:** run on the platform, or locally with `cohostly dev -- <command>` (the same tool as `platform dev`). |
| `host_refused` | 0 | **Message:** `The client tried to call <host>, which is not this connection's service.` **Fix:** use the client for the connection's own provider. Other addresses are refused so the platform token stays with the platform. |
| `version_not_supported` | SDK | **Message:** `Only Microsoft Graph v1.0 goes through connections (this call was <seg>).` **Fix:** use the v1.0 client (`@microsoft/msgraph-sdk`), not the beta one. |

## In what order a call is checked

When a call fails, ask which check stopped it. They run in this order:

1. The connection is declared in your manifest (`connection_not_declared`).
2. The provider is one the platform offers (`unknown_provider`).
3. A path follows the name (`missing_path`).
4. For `user` mode, the visitor is known (`caller_unknown`).
5. A grant exists (`connection_required` or `no_grant`).
6. The grant's provider matches the manifest (`provider_mismatch`).
7. The connection is not disconnected or in need of reconnecting (`connection_revoked`, `connection_needs_reauth`).
8. The path is clean (`path_refused`).
9. Some effective permission allows the method and path (`permission_not_granted`, `call_not_allowed`).
10. The call is within the files the grant is limited to (`outside_grant`).
11. The body is small enough (`request_too_large`).
12. The connection is under its rate limit (`connection_rate_limited`).
13. If writes are held, the write waits (`202`), or the approval is checked (`approval_not_valid`).
14. The call goes to the provider.

> **Good to know** The contract file made by `cohostly types` lists only nine of these codes. This page has the full list.

Next: [limits](connections-limits.md). More fixes are in [troubleshooting](../limits/troubleshooting.md).
