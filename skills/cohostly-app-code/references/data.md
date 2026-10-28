# Managed data

Read this when the app needs to keep rows: notes, orders, scores, settings per person. It is a small SQL database for the project, reached only through the platform. There is no connection string and no database password anywhere in the app or its environment.

## Turn it on

```json
{ "bindings": { "data": { "managed": true } } }
```

The tables come from SQL files in a `migrations/` folder at the project root. They run in file-name order at deploy time, each once, and the result is stored with the version, so a rollback brings back the schema that went with the code.

```sql
-- migrations/001_init.sql
-- policy: owner(user_id)
CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, body TEXT NOT NULL);
```

- Use SQLite types (`TEXT`, `INTEGER`, `REAL`, `BLOB`). The database is libSQL.
- **A file that has already been applied cannot be edited.** The deploy is refused (409) before anything is built. Add a new file (`002_add_title.sql`) for the change.
- A migration that fails rolls back, and the previous version stays live.

## Who can see which rows: policy lines

A comment line above `CREATE TABLE` says who may use the table. Several lines add up: a caller needs to pass any one of them.

| Line | Meaning |
| --- | --- |
| `-- policy: owner(user_id)` | Each signed-in person reads and changes only rows whose `user_id` is theirs. The owner column cannot be changed afterwards. |
| `-- policy: owner_email(email)` | Like `owner`, but the column holds the person's email. The manifest must let the app see `caller.email` (`context.preset` `full`, or `context.expose`). |
| `-- policy: public_read` | Anyone can read. Nobody can write as a caller. |
| `-- policy: signed_in_read` | Any signed-in person can read. |
| `-- policy: roles(read=viewer\|editor\|admin, write=editor\|admin)` | By the person's role in this project. |
| `-- policy: machine(read, write)` | Programs with an access key that has `data:read` or `data:write`. |
| `-- policy: member_of(project_id = project_members.project_id, user_id)` | Per-group access: a row is visible to anyone listed in the membership table with the same `project_id`. |
| `-- policy: app_only` | The default, written out. |

**A table with no policy line is reachable only by the app's own trusted code** (see `$app` below). A visitor's request returns nothing from it. That is a safe default, and also the usual reason a new table "returns no rows".

## Calling it from the app

The typed `platform` object has one entry per table (`platform dev`/`platform types` regenerate it after a migration change; see `bindings.md`):

```ts
import platform from './platform.gen.js'

const mine = await platform.data.notes.findMany({ where: { body: { contains: 'milk' } }, take: 20 })
await platform.data.notes.create({ data: { id: crypto.randomUUID(), user_id: me.id, body: 'buy milk' } })
await platform.data.notes.update({ where: { id }, data: { body: 'buy oat milk' } })
await platform.data.notes.deleteMany({ where: { id } })
const n = await platform.data.notes.count()
```

The query shapes are ZenStack's (`where`, `select`, `orderBy`, `take`, `skip`). The SDK offers `findMany`, `findFirst`, `findUnique`, `count` (reads), `create`, `createMany`, `update`, `updateMany`, `delete` and `deleteMany`. For anything else (a sum, a group), run one SQL statement with `$app.sql` and keep it away from per-visitor data.

**Whose authority runs the call.** A call made while handling a request carries that visitor's signed context, so the policies apply to them. This needs the SDK `middleware()` on the app (see `context.md`). A call made outside a request (a timer, a start-up task) has no visitor and is treated as anonymous.

**`$app` runs as the app itself, with no policies.** Use it for work the app does on its own behalf: seeding, a nightly rollup, a table nobody else may touch.

```ts
await platform.data.$app.products.create({ data: { name: 'mug', price: 5 } })
await platform.data.$app.sql({ sql: 'select count(*) as n from orders' })   // one statement; never schema changes
```

Never use `$app` to answer a visitor's request for their own data: it skips the rule that keeps one person away from another's rows.

## Limits to design for

- A read returns at most 1000 rows (100 if you give no `take`). Page with `take` and `skip`.
- A query that runs over 10 seconds is stopped.
- SQLite has one writer, so many simultaneous writes to one project queue. Keep writes small. One project can run about 16 queries at once; more wait, then get `429 too_many_queries`.
- There are no multi-statement transactions through `platform.data`.

## What failure looks like

| What you see | Cause |
| --- | --- |
| 403 with `rejectedByPolicy` | The caller is not allowed by the table's policy. Check the policy lines and who is calling (`context.md`). |
| An empty list, no error | No policy line, or the policy hides other people's rows. |
| 400 saying the method is wrong | A strict HTTP method was used by hand. Use the `platform.data` methods. |
| Deploy refused with 409 | An applied migration file was edited. Add a new file. |

## Checking it

`describe_data` (MCP) shows the live tables and who can do what, in words. The dashboard's API tab has a policy tester: pick a table and a kind of caller, and read what they can do. Programs outside the platform can use a **data key**. Only a person makes one, in the dashboard, with `data:read` and/or `data:write` for 1 to 90 days. An assistant cannot make one, so never ask for or invent a data key.

Worked example: `assets/examples/notes-data/`.
