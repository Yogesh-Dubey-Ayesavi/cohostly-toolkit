---
title: Data SDK reference
description: "Every platform.data method with its arguments and return value, in TypeScript and in plain HTTP for Python, plus $app, $app.sql and how the visitor is passed along."
nav: SDK reference
---

This page lists every call you can make on your tables. The examples are written for the typed `platform` object. The Python tab shows the same call over plain HTTP, which works from any language ([other languages](../sdk/other-languages.md)).

## Set up

Generate the typed object once, and again after every migration or manifest change:

```sh
cohostly types --project my-app      # from the live version
cohostly types --local               # from your folder, before the first deploy
```

```js title="Import it"
import platform from './platform.gen.js'
```

`platform.data` has one entry per table of the live version. A table without a primary key has no entry. Use the entry like this:

- `platform.data.<table>.<method>(args)` acts for the visitor whose request you are handling.
- `platform.data.$app.<table>.<method>(args)` acts as your app, with no rules. See `$app` below.
- `platform.data.$app.sql({ sql, args })` runs one SQL statement as your app.

### The visitor

For the table rules to know who is asking, the SDK must forward the visitor's signed context with each call. Mount `middleware()` once ([request context](../sdk/request-context.md)):

```js title="Forward the visitor"
import { middleware } from '@cohostly/sdk'

app.use(middleware({ required: false }))   // let anonymous visitors in; the rules decide what they see
```

From then on, every `platform.data` call made while handling that request carries that visitor's context. A call made outside a request (a timer, start-up code, a job) has no visitor and counts as anonymous.

In Python or another language, send the header `X-Platform-Context` on each call, with the value of the header your app received, unchanged. If it is missing or wrong, the data service answers `401 invalid_context`. If it was issued for a different app, `403 context_for_another_app`.

### Over HTTP

Every method is a web request. The SDK does the same thing underneath.

- Address: `DATA_URL` plus `/api/model/<table>/<method>`.
- Header `X-Platform-Binding-Token`: your `PLATFORM_TOKEN`.
- Header `X-Platform-Context`: the visitor's context, as above.
- Reads are `GET`, with the arguments written as JSON in the query parameter `q`.
- `create` and `createMany` are `POST`, `update` and `updateMany` are `PATCH`, with the arguments as the JSON body.
- `delete` and `deleteMany` are `DELETE`, with the arguments in `q`.
- A reply is `{ "data": ... }`. The SDK hands you the `data` part.

Writes carry an `Idempotency-Key` header. The SDK keeps the same key for every retry, so a retried write does not happen twice.

## The methods

| Method | Description |
| --- | --- |
| `findMany` | Many rows. Arguments `{ where?, orderBy?, take?, skip? }`. Returns `Row[]`. |
| `findFirst` | The first matching row. Arguments `{ where?, orderBy? }`. Returns `Row` or `null`. |
| `findUnique` | One row by primary key. Arguments `{ where }`. Returns `Row` or `null`. |
| `count` | How many rows match. Arguments `{ where? }`. Returns a number. |
| `create` | Adds one row. Arguments `{ data }`. Returns the new `Row`. |
| `createMany` | Adds several rows in one call. Arguments `{ data: [...] }`. Returns `{ count }`. |
| `update` | Changes one row, found by primary key. Arguments `{ where, data }`. Returns the updated `Row`. |
| `updateMany` | Changes every matching row. Arguments `{ where?, data }`. Returns `{ count }`. |
| `delete` | Deletes one row, found by primary key. Arguments `{ where }`. Returns the deleted `Row`. |
| `deleteMany` | Deletes every matching row. Arguments `{ where? }`. Returns `{ count }`. |

Notes that apply to all of them:

- `Row` has one field per column. A `NOT NULL` or primary-key column has the plain type, and any other column is that type or `null`.
- `Create` needs every column that is `NOT NULL` and has no default. `Update` makes every column optional, and only the fields you send change.
- `findUnique`, `update` and `delete` can look up only the **primary key**. For any other column use `findFirst`, `updateMany` or `deleteMany`.
- There is no `select` or `include`. You always get whole rows, and there are no relations to include.
- The `count` that `createMany`, `updateMany` and `deleteMany` return is the number of rows actually changed. When a rule limits the caller, rows the caller cannot touch are not counted.
- A single-row call (`update`, `delete`) on a row the caller cannot see is refused. The exact status is not documented here yet, so treat any non-success as "not allowed or not found".

### `where`

Match a column by a plain value, or by an operator:

```js title="Filters"
{ where: { body: 'buy milk' } }                         // equal to
{ where: { price: { gte: 5, lt: 20 } } }                // between
{ where: { status: { in: ['open', 'late'] } } }
{ where: { body: { contains: 'milk' } } }               // text columns
{ where: { OR: [{ status: 'open' }, { price: { lt: 1 } }] } }
```

The operators are `equals`, `not`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, and, for text, `contains`, `startsWith` and `endsWith`. Combine filters with `AND`, `OR` and `NOT`, each of which takes filter objects. Several columns in one `where` must all match.

### `orderBy`, `take` and `skip`

```js title="Pages"
{ orderBy: { created_at: 'desc' }, take: 20, skip: 40 }   // rows 41 to 60
```

- `orderBy` takes one column and `'asc'` or `'desc'`.
- `take` defaults to 100. The most you can get is 1000, and a bigger number is quietly cut to 1000.
- `skip` skips that many rows, for paging.
- The caps also apply to `$app`.

## Reading

```js title="List and look up"
const open = await platform.data.tasks.findMany({
  where: { status: 'open' },
  orderBy: { due: 'asc' },
  take: 20,
})

const first = await platform.data.tasks.findFirst({ where: { title: { startsWith: 'Call' } } })
const one   = await platform.data.tasks.findUnique({ where: { id } })    // primary key only
const total = await platform.data.tasks.count({ where: { status: 'open' } })
```

```py title="List and look up"
import os, json, requests

base = os.environ["DATA_URL"] + "/api/model/tasks"
headers = {
    "X-Platform-Binding-Token": os.environ["PLATFORM_TOKEN"],
    "X-Platform-Context": request.headers["X-Platform-Context"],
}

def read(op, args):
    r = requests.get(f"{base}/{op}", headers=headers, params={"q": json.dumps(args)})
    r.raise_for_status()
    return r.json()["data"]

open_tasks = read("findMany", {"where": {"status": "open"}, "orderBy": {"due": "asc"}, "take": 20})
first = read("findFirst", {"where": {"title": {"startsWith": "Call"}}})
one = read("findUnique", {"where": {"id": task_id}})
total = read("count", {"where": {"status": "open"}})
```

## Writing

```js title="Create, change, delete"
const task = await platform.data.tasks.create({ data: { id: crypto.randomUUID(), title: 'Call Sam', status: 'open' } })
await platform.data.tasks.createMany({ data: [{ id: a, title: 'One', status: 'open' }, { id: b, title: 'Two', status: 'open' }] })

await platform.data.tasks.update({ where: { id: task.id }, data: { status: 'done' } })
const { count } = await platform.data.tasks.updateMany({ where: { status: 'open' }, data: { status: 'late' } })

await platform.data.tasks.delete({ where: { id: task.id } })
await platform.data.tasks.deleteMany({ where: { status: 'done' } })
```

```py title="Create, change, delete"
import uuid

def write(method, op, args):
    r = requests.request(
        method,
        f"{base}/{op}",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        **({"json": args} if method in ("POST", "PATCH") else {"params": {"q": json.dumps(args)}}),
    )
    r.raise_for_status()
    return r.json()["data"]

task = write("POST", "create", {"data": {"id": str(uuid.uuid4()), "title": "Call Sam", "status": "open"}})
write("POST", "createMany", {"data": [{"id": id_a, "title": "One", "status": "open"}]})
write("PATCH", "update", {"where": {"id": task["id"]}, "data": {"status": "done"}})
write("PATCH", "updateMany", {"where": {"status": "open"}, "data": {"status": "late"}})
write("DELETE", "delete", {"where": {"id": task["id"]}})
write("DELETE", "deleteMany", {"where": {"status": "done"}})
```

Tips:

- A write that breaks a row rule (a row for someone else, a changed owner column) is refused with `403` and `rejectedByPolicy`. Do not retry it.
- Several rows at once: `createMany` is one call and is much faster than many `create` calls. A single `create` takes several steps inside the database.
- The request body can be at most 1,000,000 bytes (about 1 MB). Send big batches in pieces.
- There are no multi-statement transactions. `$transaction` and raw queries through the table routes are refused with `400 not_available`.

## What the SDK does for you

- It sends your app's token and a request id, and decodes the reply.
- It retries twice more on a network error and on status 429, 502, 503 and 504. Only reads and keyed writes are retried.
- It waits up to 30 seconds for each attempt.
- Any other error becomes a `PlatformError`:

```js title="Handle a refusal"
import { PlatformError } from '@cohostly/sdk'

try {
  await platform.data.notes.create({ data: { id, user_id, body } })
} catch (e) {
  if (e instanceof PlatformError && e.status === 403 && e.details?.rejectedByPolicy) {
    return res.status(403).json({ error: 'You cannot add a note there.' })
  }
  throw e
}
```

`PlatformError` has `status`, `code`, `message`, `howToFix`, `requestId` and `details`. A denial by a row rule comes from the data service itself, which has no `code` of its own. Test for it with `e.status === 403 && e.details?.rejectedByPolicy`, as above, and do not rely on `e.code`. Every other error in [limits and errors](data-errors-and-limits.md) does carry a stable `code`.

## `$app`: your app acting for itself

`$app` runs as your app. No row rules apply. It can reach tables that have no rule or are `app_only`. Use it for work the app does on its own behalf: seeding data, a nightly rollup, the membership list nobody else may edit.

```js title="App work"
await platform.data.$app.products.create({ data: { name: 'mug', price: 5 } })
const runs = await platform.data.$app.report_runs.findMany({ take: 10 })
```

```py title="App work"
app_headers = {
    "X-Platform-Binding-Token": os.environ["PLATFORM_TOKEN"],
    "x-platform-authority": "app",
}
requests.post(
    os.environ["DATA_URL"] + "/api/model/products/create",
    headers={**app_headers, "Idempotency-Key": str(uuid.uuid4())},
    json={"data": {"name": "mug", "price": 5}},
)
```

`$app` works only with your app's own token. That is the case in the running app and under `cohostly dev` ([local development](data-local-development.md)). A [data key](data-keys-and-tester.md) can never become `$app`.

> **Careful** Never use `$app` to answer a visitor's request for their own data. It skips the rule that keeps one person away from another person's rows. The one exception is an app with its own login system, where the platform does not know the people. That app uses `$app` and must check each person itself, always filtering by that person's id. See [patterns](data-patterns.md).

## `$app.sql`: one SQL statement

For things the table methods cannot do, such as a total or a grouped count, run one statement as your app:

```js title="One statement"
const { rows } = await platform.data.$app.sql({
  sql: 'select status, count(*) as n from tasks where team_id = ? group by status',
  args: [teamId],
})
```

- The statement must start with `select`, `insert`, `update`, `delete`, `replace` or `with`.
- Use `?` for values and pass them in `args`, in order.
- Exactly one statement. A single `;` at the end is fine. A second statement is refused.
- It is refused for: `create`, `drop`, `alter` (schema changes belong in migrations), `pragma` and `attach`.
- The reply is `{ rows, changed }`: the rows (at most 1000) and the number of rows changed. There is no default of 100 here.
- A statement that takes over 10 seconds is stopped with `400 sql_failed`.
- Callers other than your app get `403 raw_sql_not_allowed`.

> **Careful** `$app.sql` skips every row rule. Do not use it on per-visitor data. For plain reads and writes, prefer the table methods.

This page does not document an HTTP address for raw SQL, so from Python or another language use the table routes above.

## Cron and background work

Code that runs on a timer or a schedule has no visitor. Use `$app` there, and make the work safe to run twice, for example by keying each row on the run's id ([the clock](cron.md)).
