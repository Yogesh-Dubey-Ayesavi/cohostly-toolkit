---
title: Three worked schemas
description: "Complete examples to copy: private notes, a public catalogue that staff edit, and team tasks with a membership list. Each one has the rules, the code and what each kind of visitor sees."
nav: Worked schemas
---

Each example is a real, small design. Copy the one nearest to yours and change the names.

## A. Private notes

Every signed-in person has their own notes and sees nobody else's. This is the same design as the [private notes sample app](../examples/private-notes.md).

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "notes-data",
  "health": { "port": 3000 },
  "bindings": { "data": { "managed": true } }
}
```

```sql title="migrations/001_init.sql"
-- policy: owner(user_id)
CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, body TEXT NOT NULL);
```

```js title="Notes"
import { randomUUID } from 'node:crypto'
import { middleware } from '@cohostly/sdk'
import platform from './platform.gen.js'

app.use(middleware({ required: false }))

// List: the rule filters to the caller, so no where is needed.
const notes = await platform.data.notes.findMany({ take: 50 })

// Create: user_id must be the caller's own id.
await platform.data.notes.create({ data: { id: randomUUID(), user_id: req.platform.caller.id, body } })

// Delete: even a guessed id does nothing for a note that is not yours.
await platform.data.notes.deleteMany({ where: { id } })
```

```py title="Notes"
import os, json, uuid, requests

base = os.environ["DATA_URL"] + "/api/model/notes"
headers = {
    "X-Platform-Binding-Token": os.environ["PLATFORM_TOKEN"],
    "X-Platform-Context": request.headers["X-Platform-Context"],
}

notes = requests.get(base + "/findMany", headers=headers, params={"q": json.dumps({"take": 50})}).json()["data"]

requests.post(
    base + "/create",
    headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
    json={"data": {"id": str(uuid.uuid4()), "user_id": caller_id, "body": body}},
)
```

What each visitor gets:

- A signed-in person reads, adds, changes and deletes only their own rows.
- A person who tries to add a row with someone else's `user_id` gets `403` with `rejectedByPolicy`.
- An anonymous visitor reads nothing, and writes nothing.
- Your app, through `$app`, can read every row.

Later, add a title column with a new file, and then run `cohostly types --local`:

```sql title="migrations/002_add_title.sql"
ALTER TABLE notes ADD COLUMN title TEXT;
```

## B. A public catalogue edited by staff

Anyone can browse the products. Only the project's editors and admins can change them.

```sql title="migrations/001_init.sql"
-- policy: public_read
-- policy: roles(write=editor|admin)
CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL);
```

```js title="Products"
// Anyone, even someone not signed in:
const shelf = await platform.data.products.findMany({ orderBy: { name: 'asc' }, take: 50 })

// A staff member, in a request where they are signed in. id counts up by itself, so it is left out:
await platform.data.products.create({ data: { name: 'mug', price: 5 } })

// At start-up, to put in a few starter rows. There is no visitor here, so use $app:
await platform.data.$app.products.create({ data: { name: 'sticker', price: 1 } })
```

```py title="Products"
import os, json, requests

url = os.environ["DATA_URL"] + "/api/model/products"
token = {"X-Platform-Binding-Token": os.environ["PLATFORM_TOKEN"]}

# Anyone: no visitor context needed for a public_read table.
shelf = requests.get(
    url + "/findMany",
    headers=token,
    params={"q": json.dumps({"orderBy": {"name": "asc"}, "take": 50})},
).json()["data"]
```

What each visitor gets:

- Anyone reads every product, signed in or not.
- An editor, admin or the owner can add, change and delete.
- A viewer, an ordinary visitor and an anonymous visitor are refused a write with `403`.
- Because `id` is an `INTEGER PRIMARY KEY AUTOINCREMENT`, you do not send one on create.

## C. Team tasks with a membership list

Each team sees only its own tasks. Who belongs to which team is a list that your own code manages.

```sql title="migrations/001_init.sql"
-- policy: app_only
CREATE TABLE team_members (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, user_id TEXT NOT NULL);

-- policy: member_of(team_id = team_members.team_id, user_id)
CREATE TABLE tasks (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, title TEXT NOT NULL);
```

The membership table is `app_only` on purpose. If people could write to it themselves, they could add themselves to any team.

```js title="Teams"
// Invite someone. Only run this after YOUR code has checked the inviter may do it.
await platform.data.$app.team_members.create({ data: { id: crypto.randomUUID(), team_id, user_id } })

// A member lists their team's tasks. A non-member gets an empty list, not an error.
const tasks = await platform.data.tasks.findMany({ where: { team_id }, take: 100 })

// A member adds a task to a team they belong to. For another team this is a 403.
await platform.data.tasks.create({ data: { id: crypto.randomUUID(), team_id, title: 'Book the room' } })
```

```py title="Teams"
import os, json, uuid, requests

root = os.environ["DATA_URL"] + "/api/model"
token = os.environ["PLATFORM_TOKEN"]
app = {"X-Platform-Binding-Token": token, "x-platform-authority": "app"}
member = {"X-Platform-Binding-Token": token, "X-Platform-Context": request.headers["X-Platform-Context"]}

# Invite someone, after your own check.
requests.post(
    f"{root}/team_members/create",
    headers={**app, "Idempotency-Key": str(uuid.uuid4())},
    json={"data": {"id": str(uuid.uuid4()), "team_id": team_id, "user_id": user_id}},
)

# A member lists their team's tasks.
tasks = requests.get(
    f"{root}/tasks/findMany",
    headers=member,
    params={"q": json.dumps({"where": {"team_id": team_id}, "take": 100})},
).json()["data"]
```

What each visitor gets:

- A member reads, adds, changes and deletes tasks of the teams they belong to.
- Moving a task to a team the person is not in is refused with `403`. A task cannot change team.
- A non-member sees an empty list for that team.
- Membership changes take effect in about 3 seconds.
- Everyone on a team has the same power.

## A background job that remembers each run

A scheduled job stores one row for every run. The table is `app_only`, so no visitor can touch it, and the run id is the primary key, so a job delivered twice cannot write two rows.

```sql title="migrations/001_init.sql"
-- policy: app_only
CREATE TABLE report_runs (run_id TEXT PRIMARY KEY, ran_at TEXT NOT NULL, note TEXT NOT NULL);
```

```js title="Job"
await platform.data.$app.report_runs.create({ data: { run_id: run.id, ran_at: new Date().toISOString(), note: 'sent' } })
const lastTen = await platform.data.$app.report_runs.findMany({ orderBy: { ran_at: 'desc' }, take: 10 })
```

See [the clock](cron.md) for how the platform starts a job.

## Check your work

After each deploy, ask the [policy tester](data-keys-and-tester.md) what each kind of caller can do with each table, and read the sentences back. They should say what you meant.
