---
title: Data
description: A small database for your project, with a rule for every table about who may see which rows. Nothing to install and no password to hold.
nav: Data
---

Managed data is a small database that belongs to one project. Your app never connects to it directly. It asks the platform, and the platform decides what each visitor may see.

Think of a filing room with a front desk. Your app is a clerk who is never given the key to the room. The clerk hands a request to the front desk. The desk looks at the visitor's badge, reads the rule taped to the drawer, and either brings the folder or says no. The rule is one line of text that you write once, next to the table.

## What it is

- **One database per project.** It is hosted SQLite (libSQL). If you know SQL, you already know how to write the tables.
- **Reached only through the platform.** There is no connection string and no database password. Nothing like that ever enters your app, its environment variables or its logs.
- **Rules per table.** A comment line above each `CREATE TABLE` says who can read and who can write. The platform enforces it on every call, so your code does not need a "does this person own this row?" check.
- **Typed in your code.** `cohostly types` writes a `platform.gen.ts` file with one entry per table, so your editor knows the column names.

## When to use it

Use it for anything a person would miss if it vanished: notes, orders, scores, sign-ups, settings per person.

Do not keep that kind of information in files on the app's disk. The disk is wiped by restarts and by new versions ([how apps run](../start/how-apps-run.md)). A database is the right home for a real record.

It is a small database, not a data warehouse. There are no joins through `platform.data`, no multi-statement transactions, and one writer at a time. See [limits and errors](data-errors-and-limits.md) for the numbers.

## Turn it on

Add one line to `cohostly.json`:

```json title="cohostly.json"
{ "bindings": { "data": { "managed": true } } }
```

| Field | Description |
| --- | --- |
| `bindings.data.managed` | `true` makes the platform create the project's database when you deploy, read your `migrations/` folder and build the data API. This is the only setting that creates a database. |
| `bindings.data.data_api` | `true` also declares the binding (your app gets `DATA_URL` and `data` appears in `PLATFORM_BINDINGS`), but it does not create a database. Use `managed`. |

Rules for these fields:

- `bindings.data` must be an object, and `managed` and `data_api` must each be `true` or `false`. Anything else stops the deploy with `bindings.data.<field> must be true or false.`
- If you write a `bindings.data` section but do not set `"managed": true`, the deploy continues with a warning that it does nothing until you do.
- The name `data` is taken. You cannot use it as the name of a connection.
- `DATA_URL` is set for you whenever the binding is declared. It is a reserved name, so you cannot use it for your own variable or secret.
- A project that calls the data service without declaring it gets `403 binding_not_declared`.

More on the file itself: [cohostly.json](../settings/cohostly-json.md).

## Your first table in five minutes

1. Add the line above to `cohostly.json`.
2. Create `migrations/001_init.sql`:

```sql title="migrations/001_init.sql"
-- policy: owner(user_id)
CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, body TEXT NOT NULL);
```

3. Write the types, then use them:

```sh
cohostly types --local                       # before the first deploy: types from your folder
cohostly deploy --project my-app             # creates the database and the table
cohostly types --project my-app              # after a deploy: types from the live version
```

4. Call it from your app, inside a request that went through `middleware()`:

```js title="Add and list notes"
import platform from './platform.gen.js'

await platform.data.notes.create({ data: { id: crypto.randomUUID(), user_id: req.platform.caller.id, body: 'buy milk' } })
const mine = await platform.data.notes.findMany({ take: 50 })   // only this person's rows come back
```

```py title="Add and list notes"
import os, json, uuid, requests

base = os.environ["DATA_URL"] + "/api/model/notes"
headers = {
    "X-Platform-Binding-Token": os.environ["PLATFORM_TOKEN"],
    "X-Platform-Context": request.headers["X-Platform-Context"],   # the visitor's token, forwarded unchanged
}
caller_id = ...   # the visitor's id, taken from the verified token (see "Other languages")
requests.post(
    base + "/create",
    headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
    json={"data": {"id": str(uuid.uuid4()), "user_id": caller_id, "body": "buy milk"}},
)
mine = requests.get(base + "/findMany", headers=headers, params={"q": json.dumps({"take": 50})}).json()["data"]
```

Everything else on this page is detail about those four steps. The complete notes app is in [private notes](../examples/private-notes.md).

> **Good to know** A table with no `-- policy:` line can be used only by your app's own trusted code. A visitor's request returns nothing from it. That is the safe default, and it is the most common reason a new table "returns no rows".

## How a call is decided

Every call to a table goes through the same steps:

1. Your app sends the call to the platform with its own token. That proves the call comes from your app.
2. If the call was made while handling a visitor's request, your app also forwards that visitor's signed context. That tells the platform who is asking. (The SDK does this for you once `middleware()` is mounted. See [request context](../sdk/request-context.md).)
3. The platform checks the visitor against the table's rules and lets through only the rows and actions the rules allow.

You never choose the identity in a call. It comes only from the signed context, so a visitor cannot pretend to be someone else by sending a different `user_id`.

A call with no visitor context at all (a timer, start-up code, a job) is treated as an anonymous visitor, not as your app. If your app really is acting for itself, it says so explicitly with `$app`. See [the SDK reference](data-sdk-reference.md).

## Where to read next

- [Tables and migrations](data-tables-and-migrations.md): how to write the SQL files, the order they run in, what you can and cannot do, and why a rollback does not undo your data.
- [Row rules](data-row-rules.md): every policy line, what it allows for read, create, update and delete, and how lines combine.
- [SDK reference](data-sdk-reference.md): every `platform.data` method with TypeScript and Python or HTTP examples, plus `$app` and `$app.sql`.
- [Data keys and the policy tester](data-keys-and-tester.md): letting programs outside your app use the data, and checking a rule without touching any rows.
- [Limits and errors](data-errors-and-limits.md): the numbers, and every error with its fix.
- [Local development](data-local-development.md): what `cohostly dev` does to your real data, and how to work safely.
- [Patterns](data-patterns.md): how to set up per-person, team and public data, and the mistakes people make most.
- [Three worked schemas](data-worked-schemas.md): private notes, a public catalogue edited by staff, and team tasks.
