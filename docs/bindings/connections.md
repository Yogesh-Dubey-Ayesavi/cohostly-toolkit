---
title: Connections
description: Let your app read and write a person's Google or Microsoft account without ever holding their password or token.
nav: Connections
---

A connection lets your app use someone's Google or Microsoft account. The person agrees once, on a consent screen. After that, the platform makes each call for your app and adds the login itself. Your app never sees a password, a token or a secret.

Think of a hotel concierge. You ask for a taxi. The concierge makes the call from the desk phone, using the hotel's account. You never hold the phone line. If the hotel stops the account, your next request is simply refused. A connection works the same way: your app asks, the platform calls Google or Microsoft and brings back the answer.

## Declare one

A connection starts as a few lines in `cohostly.json`:

```json title="cohostly.json"
{
  "manifest_version": 2,
  "bindings": {
    "connections": {
      "agenda": {
        "provider": "google-workspace",
        "permissions": ["calendar.read"],
        "access": "user"
      }
    }
  }
}
```

Each connection has a name (`agenda` here) and these fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `provider` | string | yes | Which service. It is a connector id from the table below, such as `google-workspace` or `microsoft-graph`. |
| `permissions` | list of strings | yes, in practice | What your app needs, named from the provider's permission list ([Google](connections-google-permissions.md), [Microsoft](connections-microsoft-permissions.md)). The person connecting sees each one in plain words and can give less. A connection that lists none can never call anything. |
| `access` | `owner` or `user` | no | Whose account the app acts as. The default is `owner`. See [owner and visitor mode](connections-modes.md). |
| `require_approval_for_writes` | true or false | no | When true, every call that changes something waits for a person to say yes. The default is false. See [holding writes for approval](connections-write-approval.md). |

The name is part of your code. It becomes `platform.connections.agenda`, the address `/connections/agenda/...`, and the setting `CONNECTION_AGENDA_URL`. Renaming it later breaks the app. A name uses lower-case letters, digits and underscores, up to 32 characters. The manifest schema keeps `ai`, `approvals`, `data` and `connections` for the platform, so pick something else.

After you change the file, run `cohostly types` again so the generated `platform.gen.ts` knows your connection ([build and test locally](../cli/develop.md)).

> **Good to know** A deploy never fails because of a connection. If something looks wrong, you get a warning instead. See [what a deploy tells you](#what-a-deploy-tells-you) below.

## Provider ids

The `provider` value names a connector. These are the ones the platform offers:

| Provider id | Type | Description |
| --- | --- | --- |
| `google-workspace` | Google | The main Google id. Gmail, Drive, Sheets, Docs, Slides, Forms, Calendar, Tasks, Contacts, Chat, Meet, Keep, Apps Script, Classroom, Drive activity and labels, the Admin directory, and your profile. Use this one for new apps. |
| `google-sheets` | Google | Older and narrower. Only the three Sheets permissions: `sheets.files`, `sheets.read`, `sheets.write`. Kept so existing apps keep working. |
| `google-drive` | Google | Older and narrower. Only `drive.files` (the Drive files a person picks). Kept so existing apps keep working. |
| `microsoft-graph` | Microsoft | OneDrive and files, Excel, SharePoint, Outlook mail, calendar and contacts, To Do, OneNote, Teams and people. Microsoft Graph version 1.0 only. |
| `slack` | Slack | Not set up yet. See [Slack](#slack). |

All three Google ids use the same Google connection and the same consent. `sheets.write` means exactly the same thing in `google-sheets` and in `google-workspace`.

> **Careful** Ask only for permissions that belong to the provider id you named. A call can use only the permissions of the connector named in `provider`. With `provider: "google-sheets"` and `permissions: ["calendar.read"]`, the person can be asked and can say yes, but every call is refused with `permission_not_granted`. If you want Calendar, use `google-workspace`.

If you name a provider the platform does not offer, calls answer `unknown_provider` and the deploy warns you.

## Three locks, all must open

A call goes through only when three separate things agree:

1. **The manifest** says your app asked for this permission.
2. **The grant** says a person gave this permission to this tool. They can give less than you asked for.
3. **The login** says the provider itself allowed it, because the person approved it on the provider's consent screen.

The permissions that pass all three are called **effective**. The platform checks again on every call, so taking something away works at once. If a call is refused, [the error catalogue](connections-errors.md) says which lock held.

## Make a first call

Once someone has connected, a call names the provider's own path:

```js title="Read some cells"
const rows = await platform.connections.sheet.get({
  path: `v4/spreadsheets/${id}/values/A1:C100`,
})
```

```py title="Read some cells"
import os, requests

base = os.environ["CONNECTION_SHEET_URL"]
headers = {"x-platform-binding-token": os.environ["PLATFORM_TOKEN"]}

reply = requests.get(f"{base}/v4/spreadsheets/{sheet_id}/values/A1:C100", headers=headers, timeout=35)
rows = reply.json()
```

The better way, for Google and Microsoft, is to hand the **official** library to the connection. Every function and type is the provider's own. [Calling the API](connections-calling-the-api.md) covers both ways in full.

## Who sets it up

A connection belongs to an **account** (the workspace that owns the project), not to one person.

- In `owner` mode, an account owner or admin connects the Google or Microsoft account in the dashboard, under Connections. A project admin of the same account gives it to the tool. Until both have happened, calls answer `no_grant`.
- In `user` mode, nobody sets anything up in advance. Each visitor connects their own account the first time, on a page the platform provides. The visitor must be signed in to Cohostly, because the connection is kept under their Cohostly sign-in.

The step-by-step flows are in [connect, reconnect, switch and disconnect](connections-connect-flows.md). An AI assistant working for you can list and describe connections and give one to a tool. It cannot connect or disconnect an account, because agreeing to that is always a person's act.

## What a deploy tells you

A deploy checks your connections and prints warnings. It never refuses to deploy because of them.

- **A provider the platform does not offer.** The warning names the provider and lists the ones offered.
- **A permission the provider does not have.** The warning lists the permission names that are offered.
- **An `owner` connection nobody has given to the tool yet.** The warning says to open Connections and connect or give one, and that until then calls answer `403 no_grant`.
- **An `access: "user"` connection.** It is skipped. Each person connects on first use.

## How your keys stay safe

The app holds only `PLATFORM_TOKEN`, a pass that works for this project's bindings, and, in `user` mode, the visitor's signed request context. The login for Google or Microsoft is stored encrypted, with a key your app cannot reach. When a call arrives, the platform decrypts the login for that one call, sends the request to the provider, and returns only the provider's answer.

The platform does not hand the app a real token on purpose. A token inside the app would be copied into snapshots and would make file limits, write approval and instant revoke impossible. Because the platform stays in the middle, it can do all three.

Logs record who called what (connection, project, method, status, time). They never record request or response bodies.

## Slack

Slack is **not set up yet**. A Slack connector is listed with four permissions, but do not build on it. The SDK has no Slack helper either, only the plain `get` and `post` calls.

| Permission | Type | Description |
| --- | --- | --- |
| `chat.write` | write only | This lets your tool post messages in the Slack channels where the app has been added. |
| `channels.read` | read | This lets your tool see the names of your Slack channels. It cannot read their messages. |
| `channels.history` | read | This lets your tool read the messages in public Slack channels. |
| `users.read` | read | This lets your tool see the names of the people in your Slack workspace. |

## In this section

- [Owner and visitor mode](connections-modes.md): whose account the app acts as, and how to build apps with many visitors.
- [Google permissions](connections-google-permissions.md): every Google permission, in plain words.
- [Microsoft permissions](connections-microsoft-permissions.md): every Microsoft permission, in plain words.
- [Picked files and narrowing](connections-picked-files.md): give a tool one file instead of a whole account.
- [Connect, reconnect, switch and disconnect](connections-connect-flows.md): what people see and what the app sees.
- [Calling the API](connections-calling-the-api.md): the SDK methods, official clients, paths and plain HTTP.
- [Asking what is allowed](connections-allowed.md): `allowed()`, its four states and `connect_url`.
- [Holding writes for approval](connections-write-approval.md): the 202 answer and how to finish the write.
- [Errors](connections-errors.md): every code, its exact message and the fix.
- [Limits](connections-limits.md): rate, size and time limits.
- [Worked examples](connections-examples.md): a sign-up sheet, a personal agenda and a multi-visitor connect page.

Related: [approvals](approvals.md), [environment](environment.md), [request context](../sdk/request-context.md).
