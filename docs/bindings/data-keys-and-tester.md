---
title: Data keys and the policy tester
description: "Let a program outside your app read or change your data with a data key, and check what any kind of caller can do without touching a single row."
nav: Data keys and tester
---

Two tools sit around the data binding. A **data key** lets a program that is not your app reach the tables. The **policy tester** tells you what a kind of caller may do with a table, without reading any data.

## Data keys

A data key is a password for one project's data API. Use it for a script on your laptop, a spreadsheet macro, or another service that needs to read a table or push rows into it.

It is like a visitor badge from the front desk. The badge is printed once, carries a name and an expiry date, can be cancelled at any time, and only opens the drawers marked "badge holders welcome".

### Who can make one

Only a person. A key belongs to the person who made it, and it stops working if that person loses access. Three situations are refused:

- A call made with the operator key, or any key that has no person behind it: "A data key belongs to a person...".
- An AI assistant. It cannot make a data key, because a data key reads and changes real data. An assistant has to ask the person to make it.
- A person without data API access to the project (see below).

### Making and listing keys

Make a key with `POST /v1/projects/<project>/data-keys` and a body like this:

```json title="Request"
{ "label": "nightly export", "scopes": ["data:read"], "expires_in_days": 30 }
```

| Field | Description |
| --- | --- |
| `label` | Required. A name so you know what the key is for. At most 80 characters. |
| `scopes` | `data:read`, `data:write`, or both. The default is `["data:read"]`. |
| `expires_in_days` | From 1 to 90. The default is 30. A number outside that range is moved to the nearest end. |

The reply (status `201`) carries the key **once**, with this note: "This key is shown once. Send it as the X-Platform-Binding-Token header. It stops working at the time above, or when you revoke it, or if you lose data API access." Copy it then. It is stored only as a one-way hash plus a short hint, so it cannot be shown again. Make a new one if you lose it.

Listing shows each key's id, label, hint, scopes, who made it, when it was made, last used and expires. Revoked and expired keys are hidden. An admin sees every key in the project. Everyone else sees their own. Revoke with `DELETE /v1/projects/<project>/data-keys/<key id>` (an admin can revoke any key, anyone else only their own). Making and revoking keys is recorded in the project's audit log.

### Using a key

Send the key as the header `X-Platform-Binding-Token` to the same routes the SDK uses:

```sh title="Read rows with a key"
curl -G "$DATA_URL/api/model/products/findMany" \
  -H "X-Platform-Binding-Token: $DATA_KEY" \
  --data-urlencode 'q={"orderBy":{"name":"asc"},"take":50}'
```

```py title="Read rows with a key"
import json, requests

r = requests.get(
    f"{data_url}/api/model/products/findMany",
    headers={"X-Platform-Binding-Token": data_key},
    params={"q": json.dumps({"orderBy": {"name": "asc"}, "take": 50})},
)
rows = r.json()["data"]
```

Here `data_url` is your project's `DATA_URL` (the same address your app uses). The table routes are described in the [SDK reference](data-sdk-reference.md).

What the key can do:

- A `GET` call needs the scope `data:read`. Any other method needs `data:write`. A key without the right scope gets `403 missing_scope`.
- The key counts as a **machine**. It reaches only tables that have a `machine(...)` line, plus `public_read` tables for reading. Add `-- policy: machine(read)` or `-- policy: machine(read, write)` to a table to let keys in ([row rules](data-row-rules.md)).
- It can never use `$app`, never run raw SQL and never see a table that has no matching rule.

### Data API access

A key works only while its owner is allowed to use the data API of that project. This is checked on **every** use, so turning access off ends that person's keys at once.

- The project owner, and the account's owner and admins: always allowed.
- A collaborator: allowed if an admin switched it on for them. If nothing was set, editors and admins are allowed and viewers are not.
- Anyone else: not allowed.

An admin changes it per collaborator with `PATCH /v1/projects/<project>/collaborators/<collaborator id>` and `{ "data_api_access": true }`, `false`, or `null` (back to the default for their role). When it is off, a key fails with `403 data_api_not_allowed`.

This switch is only about keys. It does not stop your app from reading data for a viewer who opens your app. That is decided by your app's own token, the visitor's context and the row rules.

## The policy tester

Before you trust a rule, ask the platform what it does. The tester reads your table's rules and tells you, in words, what a kind of caller may do. It reads no data and changes nothing.

Ask with `POST /v1/projects/<project>/data/policy-test` (you need to be an editor or more on the project):

```json title="Request"
{ "table": "notes", "caller": { "kind": "person", "role": "viewer", "email": true } }
```

| Field | Description |
| --- | --- |
| `table` | A table in the **live** version. |
| `caller.kind` | `person`, `machine` or `anonymous`. |
| `caller.role` | For a person: `viewer`, `editor`, `admin` or `owner`. The tester treats `owner` as `admin`. |
| `caller.email` | `true` if the person has an email that was shared with the app. It matters for `owner_email`. |
| `caller.scopes` | For a machine: `data:read` and/or `data:write`. |

The reply lists, for each action, what that caller can do:

```json title="Reply"
{
  "table": "notes",
  "caller": { "kind": "person", "role": "viewer", "email": true },
  "can": {
    "read": "only the rows whose user_id is their own id",
    "create": "only the rows whose user_id is their own id",
    "update": "only the rows whose user_id is their own id",
    "delete": "only the rows whose user_id is their own id"
  }
}
```

Each value is `every row`, `none`, or a phrase such as `only the rows whose <column> is their own email` or `only the rows of the groups they belong to (<table>)`. When several lines apply, the phrases are joined with `, or `.

Things to know:

- It tests the row rules only. It does not test the data API access switch for keys.
- For a machine, the tester expects the key's scope (`data:read` for read, `data:write` for the rest). The real check for a machine that reaches your app through its context looks only at "is this a machine". Do not use the tester's scope answer to promise yourself that scopes are checked on that path.
- A table that is not in the live version gets a `404` with `There is no table called "<table>" in the live version.` A bad `caller.kind` gets a `400` with `caller.kind must be person, machine or anonymous.`
- A good routine: deploy, run the tester for each kind of caller, and read the sentences back. If one surprises you, the rule is wrong.

## For AI assistants

An AI assistant connected through MCP can call `describe_data` (read only). It lists the tables, their columns and the rules in plain English. It never shows rows, the database address or a token. An assistant also cannot create data keys.
