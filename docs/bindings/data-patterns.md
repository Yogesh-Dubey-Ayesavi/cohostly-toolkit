---
title: Data patterns and gotchas
description: "How to set up data for one person, a team, the public, programs and background jobs, and the mistakes people make most often."
nav: Patterns and gotchas
---

Most apps need one of a few shapes of data. Pick the shape, copy its rule, and you are mostly done. The complete schemas are in [three worked schemas](data-worked-schemas.md).

## Pick a pattern

### Each person has their own rows

Notes, to-dos, settings, a shopping list.

```sql title="Rule"
-- policy: owner(user_id)
```

- Always fill `user_id` from the verified visitor (`req.platform.caller.id`), never from the request body. The rule refuses a row for someone else anyway, but be explicit.
- Reads need no `where` for the person: the rule already limits them.
- Anonymous visitors cannot use it. Send them to the sign-in link with `loginUrl()`.

### A team or workspace shares rows

Tasks for a team, documents for a company, a shared board.

```sql title="Rules"
-- policy: app_only
CREATE TABLE team_members (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, user_id TEXT NOT NULL);

-- policy: member_of(team_id = team_members.team_id, user_id)
CREATE TABLE tasks (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, title TEXT NOT NULL);
```

- Keep the membership table `app_only` and change it from trusted code with `$app`, after your own check that the person adding a member is allowed to.
- Do not give the membership table `owner(user_id)`. Then any signed-in person could add themselves to any team.
- Keep both `team_id` columns as `TEXT`.
- Every member has the same power. If you need "only admins may delete", check that in your code, or split the data into two tables with different rules.

### Everyone reads, staff write

A product list, a news page, a price table.

```sql title="Rules"
-- policy: public_read
-- policy: roles(write=editor|admin)
```

The people who are editors or admins of the project can change rows, from inside your app. Everyone else (including people who are not signed in) can read.

### Everyone signed in reads, each owner writes

A community wall, a leaderboard, a reviews page.

```sql title="Rules"
-- policy: signed_in_read
-- policy: owner(user_id)
```

Because lines add up, any signed-in person can read every row, and each person can change only their own.

### An app with its own login

If your app has its own sign-in system and the platform sees every visitor as anonymous, `owner(...)` cannot recognise them. Use `$app` and check the person yourself in code, and always filter by that person's id:

```js title="Own login"
const mine = await platform.data.$app.notes.findMany({ where: { user_id: me.id }, take: 50 })
```

> **Careful** This is the one place where your app, not the platform, is the security boundary. A missing `where` here shows one person's data to another. See [sharing and roles](../settings/sharing-and-roles.md).

### Programs outside your app

A script that pulls a report, or a service that pushes rows in.

Make a [data key](data-keys-and-tester.md) for each program, with only the scopes it needs, and give the table a `machine(read)` or `machine(read, write)` line. One key per program means you can cancel one without breaking the others.

### Background jobs and schedules

A nightly rollup, a reminder, a cleanup. There is no visitor, so use `$app`, and key the rows on something that makes a repeat harmless, such as the run id:

```js title="Safe to run twice"
await platform.data.$app.report_runs.create({ data: { run_id: run.id, ran_at: new Date().toISOString(), note: 'ok' } })
```

If a job is delivered twice, the second create fails on the primary key instead of writing a duplicate. See [the clock](cron.md).

## Gotchas

**1. "My table returns no rows."** Work down this list:

- The table has no `-- policy:` line, or only `app_only`. Visitors see nothing.
- The rule hides the rows (they belong to someone else).
- The call ran outside a request (a timer, start-up code), so it was anonymous.
- `middleware()` is not mounted, so no context was forwarded.
- Under `cohostly dev` there is no visitor, so table calls are anonymous ([local development](data-local-development.md)).

**2. Editing an applied migration, even by one space, is refused with `409`.** Add a new file. And rolling back your code does not roll back your database. See [tables and migrations](data-tables-and-migrations.md).

**3. Migration names sort as text.** `10_x.sql` runs before `2_x.sql`. Use `001_`, `002_`.

**4. `$app` ignores every rule.** Use it only for work the app does for itself, never to answer a visitor's request for their data.

**5. Keep the policy lines right above `CREATE TABLE`, and keep `CREATE TABLE` at the start of its line.** A real SQL statement between them drops the lines.

**6. A table with no primary key gets no API.** It is only a warning, so it is easy to miss. Names that begin with `_` or are reserved words fail.

**7. Single-row `findUnique`, `update` and `delete` work on the primary key only.** For anything else use `findFirst`, `updateMany` or `deleteMany`.

**8. `owner_email` needs the email to reach your app.** Set `context.preset: full` (or `context.expose` with `caller.email`) in the manifest, and the person must agree to share it. Store emails in lower case.

**9. `roles(...)` matches only people with a project role.** An ordinary link visitor has none. `read` and `write` are separate lists, and `write` is create, update and delete together.

**10. A stale `platform.gen.ts` blocks the deploy.** Run `cohostly types` after changing a migration.

**11. There are no joins, aggregates or transactions through `platform.data`.** For a total use `$app.sql`, never on per-visitor data.

**12. `take` is not unlimited.** It defaults to 100 and stops at 1000.

**13. Do not retry a `403`.** A refusal by a rule will be refused again.

**14. Store dates as ISO text.** `ran_at TEXT` holding `2026-11-01T09:00:00Z` is safest.

**15. Local development touches live rows.** There is one database per project.

**16. `data_api: true` does not create a database.** Only `managed: true` does.

**17. A rollback restores the data API, not the data.** The tables and columns that newer migrations made are still there. Write migrations the previous version of your code can live with: add things, and remove them one release later.
