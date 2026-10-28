---
title: Row rules
description: "The policy lines that say who may read and write each table: the exact grammar, what each line allows, and how lines combine."
nav: Row rules
---

A **row rule** (the platform calls it a policy) says who may read, add, change and delete the rows of one table. You write it as a comment above the table, and the platform enforces it on every call. Your code needs no "is this their row?" check.

Think of a drawer in the filing room with a card taped to it: "Staff only", or "Everyone may look, nobody may add", or "Each person may open only their own folder". The front desk reads the card every single time.

## Where the lines go

A rule is a comment line that starts with `-- policy:` and sits directly above the `CREATE TABLE` it belongs to:

```sql title="migrations/001_init.sql"
-- policy: public_read
-- policy: roles(write=editor|admin)
CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL);
```

How the platform finds them:

- The word `policy:` can be in any letter case, and spaces around it are fine. The rule's own name must be in lowercase: `owner`, not `Owner`.
- A block of `-- policy:` lines belongs to the next `CREATE TABLE` (or `CREATE TABLE IF NOT EXISTS`). That `CREATE TABLE` must **start its own line**. If it comes after something on the same line, such as `/* note */ CREATE TABLE`, the table is not detected and gets no rule.
- A blank line, or an ordinary `-- comment` line, between the policy lines and the `CREATE TABLE` does not matter. The lines still attach.
- Any real SQL statement in between, such as an `INSERT` or a `SELECT 1;`, throws the pending lines away. Keep the lines right above the table.
- Several tables in one file each take the lines directly above them. Lines above an `ALTER TABLE` are dropped.
- Only `CREATE TABLE` is scanned. A view cannot have a rule.

A table with no rule at all, or with only `app_only`, is for your app's trusted code alone. Nobody else can reach it, signed in or not.

A mistake in a rule stops the deploy with a `422` and a sentence that starts `Table "<table>": the policy "<text>" ...` followed by what is wrong. The messages are listed under each line below.

## Who is calling

Every call has one of these callers. Which one it is comes only from the platform's signed context, never from anything your code sends.

- **A person.** The visitor is signed in. They have an id, and (if they are a collaborator on the project) a role: `viewer`, `editor`, `admin` or `owner`. A person who is not a collaborator, such as an ordinary signed-in or link visitor, has no role.
- **A machine.** A program with an access key. It either reaches your app, which then forwards its context, or it calls the data directly with a [data key](data-keys-and-tester.md).
- **Anonymous.** There is no context, or the visitor is not signed in. An anonymous caller can use only what `public_read` allows. A call with no context at all (a timer, start-up code) is anonymous, never your app.
- **Your app itself.** Only through `$app`, which skips all rules. See the [SDK reference](data-sdk-reference.md).

An email appears in a caller's context only when the manifest asks for it (`context.preset: full`, or `context.expose` with `caller.email`) **and** the person agreed to share it. Otherwise it is empty. See [request context](../sdk/request-context.md).

## The lines

Each line below lists what it allows for **read** (find, count), **create**, **update** and **delete**.

### `owner(column)`

Each signed-in person works only with their own rows: the rows where `column` holds their own id.

```sql
-- policy: owner(user_id)
```

- Read: a person sees only rows where the column equals their id.
- Create: a person can add a row only if the column equals their id.
- Update and delete: only their own rows.
- The owner column **cannot be changed** by anyone afterwards. Trying to give a row away is refused with `403` and `rejectedByPolicy`.
- Anonymous callers and machines get nothing.
- Takes exactly one column name, and the column must exist. Otherwise: `needs one column name, for example owner(user_id).` or `owner(x) names a column that does not exist. Its columns are a, b.`

### `owner_email(column)`

The same as `owner`, except the column holds the person's **email address** instead of their id.

```sql
-- policy: owner_email(email)
```

- It works only for a person whose email is in the context. If the manifest does not send the email, or the person did not agree, that person sees nothing.
- The platform compares against the email in lower case with spaces trimmed. **Store emails in lower case.**
- The column cannot be changed afterwards.
- Takes one existing column name (`needs one column name, for example owner_email(email).`).

### `member_of(column = table.column, user_column)`

Access by group. A row is visible to a person who is listed, in a membership table, for the same group as the row.

```sql
-- policy: member_of(team_id = team_members.team_id, user_id)
```

Read it as: "this row's `team_id` must match a row in `team_members` whose `team_id` is the same and whose `user_id` is me."

- Read, update and delete: only rows of groups the person belongs to.
- Create: only into a group the person belongs to.
- The group column cannot be changed. A row cannot be moved to another group.
- Every member has the same power. There are no per-member roles.
- Compared as text. Keep both group columns as `TEXT`. A group id stored as `INTEGER` on one side is likely to fail to match.
- A change to the membership table takes effect within about 3 seconds.
- People only. Machines get no groups.
- The line must have that exact shape. Otherwise: `needs member_of(column = members_table.column, user_column), for example member_of(project_id = project_members.project_id, user_id).` The row column, the membership table and its two columns must all exist, and the messages name which is missing.

> **Careful** Who may add rows to the membership table decides who gets in. If the membership table itself has `owner(user_id)`, any signed-in person can add their own membership row for any group and read that group's data. Keep the membership table `app_only` and edit it with `$app` after your own check. See [patterns](data-patterns.md).

### `public_read`

Anyone can read every row, signed in or not, including data keys and anonymous callers.

```sql
-- policy: public_read
```

- Read: everyone.
- Create, update, delete: nobody, through the data API as a caller. Writes need another line, or your app's `$app`.
- Takes no arguments (`takes no arguments.`).

### `signed_in_read`

Any signed-in person can read every row. Not anonymous callers and not data keys.

```sql
-- policy: signed_in_read
```

- Read: any person.
- Create, update, delete: nobody.
- Takes no arguments.

### `roles(read=..., write=...)`

Access by the person's role in this project.

```sql
-- policy: roles(read=viewer|editor|admin, write=editor|admin)
```

- The roles are `viewer`, `editor` and `admin`. Separate several with `|`.
- Give `read=`, `write=`, or both, separated by a comma. At least one must have a role.
- `read` controls reading.
- `write` controls create, update and delete **together**. You cannot split them.
- The project's `owner` counts wherever `admin` is listed. An owner is not matched by `read=editor` alone.
- Only collaborators with a role match. A visitor with no role, a data key or an anonymous caller never does.
- The roles come from the signed context, so your app cannot choose them.
- Bad forms:
  - `needs read=viewer|editor|admin and/or write=editor|admin.`
  - `names an unknown role "boss". Roles are viewer, editor and admin.`
  - `roles(read=viewer, delete=admin)` gets the "needs read=... and/or write=..." message, because only `read` and `write` exist.

### `machine(read, write)`

Programs with an access key.

```sql
-- policy: machine(read)
-- policy: machine(read, write)
```

- Read: any machine caller. Add `write` as well and a machine can create, update and delete.
- Give `read`, `write` or both. `machine()` is an error: `needs read, write or both, for example machine(read).`
- A data key must also carry the matching scope: `data:read` for reading and `data:write` for the rest. See [data keys](data-keys-and-tester.md).

### `app_only`

Nobody but your app's trusted code (through `$app`) can reach the table. This is also what you get when you write no rule. Writing it out makes the intention visible to the next person who reads the file.

```sql
-- policy: app_only
```

Takes no arguments.

### Anything else

An unknown name stops the deploy: `is not a known policy. Use owner(column), public_read, signed_in_read, roles(...), machine(...) or app_only.` The message does not list `owner_email` and `member_of`, but both exist.

## Combining lines

Lines add up. A caller may do something if **any** line allows it. There are no "deny" lines.

- `public_read` plus `roles(write=editor|admin)`: anyone reads, editors and admins write.
- `owner(user_id)` plus `public_read`: everyone reads every row, and each person changes only their own.
- `signed_in_read` plus `owner(user_id)`: anyone signed in reads all rows, and writes only their own.

The "cannot be changed" protection adds up in the same way. With `owner(a)` plus `roles(write=admin)`, an admin may edit another person's row, but still cannot change the column `a`.

## What a rule cannot do

- It sees only the row's own columns. There are no custom conditions beyond the lines above.
- A read of rows the caller may not see returns fewer rows (or none), not an error. Likewise `updateMany` and `deleteMany` touch only the rows the caller is allowed to touch, and their `count` includes only those.
- A create that breaks the rule is refused with `403` and `rejectedByPolicy: true`.
- Cascades and triggers inside the database are not checked ([tables and migrations](data-tables-and-migrations.md)).

## In plain words

The platform turns each line into a sentence, and shows these sentences in the policy tester, in the contract file `platform.contract.md`, and to an AI assistant that asks `describe_data`:

- `owner`: "Each signed-in person can read, add, change and delete only the rows where `column` is their own id. The `column` of a row cannot be changed."
- `owner_email`: the same with "their own email address", and "Without the email (the manifest does not send it, or the person did not agree) they see nothing."
- `member_of`: "...the rows whose `column` matches a row of `table` that lists them. A row cannot be moved to another group. Changes to the membership list take effect within a few seconds."
- `public_read`: "Anyone, signed in or not, can read every row. Nobody can change rows through the data API."
- `signed_in_read`: "Any signed-in person can read every row."
- `roles`: "People with the role X in this project can read every row. People with the role Y can add, change and delete rows."
- `machine`: "Programs with an access key can read and change rows (the key's scopes still apply)."
- `app_only`: "Only the app itself can use this table. No visitor, signed in or not, can reach it."

If the sentence is not what you meant, the rule is wrong. Read them back after every change.
