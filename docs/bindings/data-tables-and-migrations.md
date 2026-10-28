---
title: Tables and migrations
description: "How to write the SQL files that build your tables: where they go, the order they run in, what the platform checks, and why a rollback does not undo your data."
nav: Tables and migrations
---

Your tables come from SQL files in a folder called `migrations/`. A **migration** is one step in the life of your database: "create the notes table", then "add a title column to it", and so on. The steps run in order and each runs once.

Think of a ship's logbook. You add a new line for every change. You never go back and rewrite an old line, because the database has already acted on it.

## Where the files go

- The folder is `migrations/` at the root of your project (next to `cohostly.json`).
- Only files directly inside it count. Subfolders are not read.
- A file must end in `.sql`. A file whose name starts with a dot is skipped. (On macOS, `._001_init.sql` copies are junk that the system leaves behind, and they are ignored.)

If you set `"managed": true` but there is no `migrations/` folder or no `.sql` file in it, the deploy goes ahead with this warning: "This project asks for managed data but has no migrations/ folder with .sql files, so its database will have no tables." Until you add a file, every data call answers `409 database_not_ready`.

## The order they run in

Files run in plain alphabetical order of their names, character by character. That means `10_x.sql` runs **before** `2_x.sql`. Start every name with a zero-padded number so the order is what you expect:

```text title="migrations/"
001_init.sql
002_add_title.sql
003_comments.sql
010_indexes.sql
```

## What happens when you deploy

The platform checks everything before it builds anything, so a bad migration costs you nothing.

1. **A dry run.** It applies all your files, in order, to an empty throwaway database. If any file has an SQL error, the deploy stops with `422` and this message: `Migration <name> could not be applied to an empty database: <the first line of the error>`.
2. **A hash check.** If the project's database already exists, the platform compares each file it has already applied with the file on disk. If one has changed, the deploy stops with `409` (see "Never edit an applied file" below).
3. **The real run.** After the build, it creates the database if it is the first deploy, then applies the new files for real.

Both refusals in steps 1 and 2 reply with a body like this:

```json title="Refused deploy"
{ "error": "Your data could not be set up", "details": "The migration 001_init.sql was already applied and has been edited since. Leave applied migrations as they are and add a new file for the change." }
```

### The real run, file by file

The platform keeps a small ledger table in your database called `_cohostly_migrations`. It holds each applied file's name, a fingerprint of its text (a SHA-256 hash), and the time.

For each file, in order:

- Already in the ledger with the same fingerprint: skipped. Each file runs once.
- Already in the ledger with a different fingerprint: the deploy stops (`409`).
- Not in the ledger: the platform runs the whole file as **one transaction** and records it. A transaction is "all or nothing": if any statement fails, none of the file's changes stay.

Leave `BEGIN` and `COMMIT` out of your files. The platform already wraps each file.

If a file fails, the deploy stops with `422` and this message: `The migration <name> failed on the database: <the first line of the SQLite error>. Nothing from that file was applied.` Earlier files stay applied. Fix the file and deploy again. Because the failed file was never recorded, you may edit it freely.

When a deploy fails after the new version was created, that version is marked `failed` and the previous version becomes the live one again, so visitors keep the app they had. On a project's very first deploy there is no previous version to keep. If the database cannot be reached or prepared at all, the reply is `502` with "The project's database could not be prepared. Your previous version is still live. Try again in a moment."

### Never edit an applied file

The fingerprint covers the exact text of the file, so **any** change counts: a new space, a fixed typo in a comment, even a changed line ending. The deploy is refused with `409`:

> The migration 001_init.sql was already applied and has been edited since. Leave applied migrations as they are and add a new file for the change.

Put the old text back and add a new file such as `002_add_title.sql`:

```sql title="migrations/002_add_title.sql"
ALTER TABLE notes ADD COLUMN title TEXT;
```

The platform replays every file from empty in its dry run, so a new file can build on the old ones. After you add a file, run `cohostly types` again so your code sees the new column.

## Writing the tables

### Names

Table and column names must start with a letter and then use only letters, digits and underscores. These words cannot be used: `model`, `enum`, `type`, `datasource`, `generator`, `plugin`, `import`, `abstract`, `view`, `true`, `false`, `null`, `this`. A bad name stops the deploy with `422`:

> The table name "<t>" cannot be used. Use letters, digits and underscores, starting with a letter, and not a reserved word.

For a column the message starts `The column "<table>.<column>" cannot be used.` and says the same.

Tables whose names start with `_` or `sqlite_` are hidden from the data API. That includes the platform's own `_cohostly_migrations`. A table of yours that starts with `_` is therefore not reachable by `platform.data` either.

### Column types

The platform reads your declared type and picks a matching type for your code. It looks for these words anywhere in the declared type, ignoring letter case, and takes the first that fits:

| Declared type contains | In your code |
| --- | --- |
| `BOOL` | `boolean` |
| `INT` (`INTEGER`, `BIGINT`) | `number` (a whole number) |
| `REAL`, `FLOA`, `DOUB`, `NUMERIC`, `DECIMAL` | `number` (a decimal) |
| `BLOB` | `string` |
| `JSON` | `unknown` |
| `DATE` or `TIME` (`DATETIME`, `TIMESTAMP`) | `string` |
| anything else (`TEXT`, `VARCHAR`) | `string` |

> **Good to know** Store dates as `TEXT` holding an ISO-8601 time, such as `2026-11-01T09:00:00Z`. That is what the shipped samples do, and it is the one form that is certain to round-trip. How `DATETIME` and `BLOB` columns travel over the wire is not something these docs promise yet.

### Required or optional

A column that is `NOT NULL`, or is the primary key, is required: your code must provide it when it creates a row. Any other column is optional and reads back as `T | null`. A column with a `DEFAULT` is optional when creating a row.

### Primary keys

Give every table a primary key. A table without one is not an error, but it gets **no data API**: it exists in the database, yet no caller can reach it, and `$app.<table>` cannot either. The deploy shows this warning:

> Table "<t>" has no primary key, so it has no data API. Add one to use it.

If no table in the migrations has a primary key, the deploy stops with "None of the tables has a primary key, so there is nothing to build a data API from." If there are no tables at all, it stops with "The migrations create no tables, so there is nothing to build a data API from."

A few more facts about keys:

- A single primary key and a composite one (`PRIMARY KEY (a, b)`) both work.
- `findUnique`, `update` and `delete` can target **only the primary key**. A `UNIQUE` constraint on another column does not give you a one-row lookup. For other columns use `findFirst`, `updateMany` or `deleteMany`.
- An `INTEGER PRIMARY KEY` counts up by itself.
- A `TEXT PRIMARY KEY` with no default gets a generated id if you leave `id` out of a create. The samples set the id themselves so they know it.
- A column with `DEFAULT CURRENT_TIMESTAMP` (or `datetime('now')`) is filled with the current time.

### What SQLite lets you do that the data API does not see

Indexes, triggers, views, `CHECK` constraints and foreign keys are all accepted when the migration runs. They are not part of the data API:

- The API sees plain columns only. There are no relations, so no `include`.
- A trigger or an `ON DELETE CASCADE` runs inside the database and is **not** checked against your row rules. Do not point a cascade at a table whose rows are protected by a rule.
- Policy lines go only above `CREATE TABLE`, never above a view.

## Rules inside the file

The `-- policy:` lines that say who may use a table live in the same file as the `CREATE TABLE`. They are explained in [row rules](data-row-rules.md). Two facts matter here:

- The lines sit directly above the `CREATE TABLE`, and the `CREATE TABLE` starts its own line.
- Because the rules are part of the file, they are locked together with it once the file is applied.

## Rollback: what comes back and what does not

Every version of your app stores a copy of its **data API**: the table list, the columns and the row rules your code was written against. The platform always serves the data API of the live version.

When you roll back, the platform switches to the older version's data API. A switch can take a few seconds (up to about 5) to be seen everywhere.

**A rollback does not undo the database.** Migrations only go forward. The tables, columns and rows made by newer migrations stay exactly as they are.

Picture a restaurant that changes its menu. Rolling back the menu card does not un-cook the food already served, and the new pantry shelves stay in the kitchen. Only the card the waiters read from goes back.

What that means in practice, after rolling back to an older version:

- A table made by a newer migration is still there, but the old version's data API does not list it, so the old code cannot reach it.
- A column added later is invisible to the old code.
- If a newer migration added a `NOT NULL` column with no default, the old code's creates fail, because it does not know to fill the column.
- If a newer migration removed or renamed a column that the old code still uses, the old code breaks.

So write migrations that the previous version of your code can live with. Add columns and tables. Do not drop or rename something in the same release as the code that stops using it. Do the drop in a later release, once nothing old can come back.

## Changing a row rule later

Today a rule is written in the file that creates the table, and that file is locked once it is applied. There is no line you can remove. Adding more lines for a table in a later file is not a supported workflow yet, so choose each table's rules before its first deploy, and check them with the [policy tester](data-keys-and-tester.md) once deployed.

## Backups

The platform takes a nightly copy of every project database and keeps each for 30 days. Restoring is done by the platform's operators onto an empty database. It is not a command you run, and there is no promised recovery point, so do not treat it as an "undo". The `cohostly backup` and `cohostly restore` commands are for a stateful app's `/data` folder, not for this database ([projects](../cli/projects.md)).

## Quota

An account can have 6 databases by default. The limit is checked at a project's **first** database. Later versions of the same project do not make another one. If you are over, the deploy answers `403` and names the limit ([limits](../limits/limits.md)).
