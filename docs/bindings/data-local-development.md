---
title: Data in local development
description: "What cohostly dev does to your data, why a locally run app has no visitor, how to get types before you deploy, and how to experiment without hurting real rows."
nav: Local development
---

You can run your app on your own computer and still use the platform's services. For the data binding there is one thing you must know first.

> **Careful** `cohostly dev` uses the project's single, live database. There is no separate practice copy. Rows you create, change or delete from your laptop are the real rows that your visitors see.

## Why there is only one database

Each project has exactly one database, and it serves both the deployed app and anything started with `cohostly dev`. A "dev" database was planned and then dropped on purpose: the platform always uses the project's one database, whichever environment asks. A limit on how much damage a dev token can do was never built either.

So treat local development against managed data the way you would treat a live database: with care.

## Running it

```sh
cohostly dev --project my-app -- npm start
```

What this does:

- Creates a short-lived dev token tied to you, the project and this computer. It lasts about 12 hours, and a project can have up to 10 live at once.
- Loads the project's secrets (skip with `--no-secrets`, or read from a file with `--env-file`).
- Sets `PLATFORM_TOKEN`, `PLATFORM_BINDINGS`, `DATA_URL` and the rest in your command's environment.
- Runs your command, and ends the token when it exits. Nothing is written to disk.

More about the command: [develop](../cli/develop.md).

The project must have been **deployed at least once** before data calls work. The database and its data API come from the live version. Before that, every call answers `409 database_not_ready`.

## No visitor on your laptop

On the platform, a visitor's request comes through the platform's front door, which adds a signed context saying who the visitor is. A copy of your app running on your computer is not behind that door. Requests to it carry no context.

The result:

- `platform.data.<table>` calls from a local run are **anonymous**. They see only what `public_read` tables allow, and nothing in tables protected by `owner`, `roles`, `member_of` and the others.
- `platform.data.$app.<table>` calls work as normal, with no rules.
- A table with no policy line, or with only `app_only`, can be reached only through `$app`.

So when a table "returns no rows" on your laptop, that is usually why. It is the platform behaving correctly: nobody is signed in.

Today these docs do not describe a way to pretend to be a signed-in visitor on your own computer. The development page says you can call your app signed in and signed out, but it does not give a mechanism. To check how a rule treats a person, use the [policy tester](data-keys-and-tester.md) or visit the deployed app.

## Types before the first deploy

The typed `platform` object comes from `platform.gen.ts`. There are two ways to make it:

```sh title="Terminal"
cohostly types --project my-app          # from the live version (needs a deploy with tables)
cohostly types --local                   # from your folder's cohostly.json and migrations
cohostly types --local --dir ./my-app    # the same, for another folder
cohostly types --project my-app --check  # for CI: fails if the file is out of date
```

`--local` reads the migrations exactly the way a deploy does. Use it before the first deploy, and any time you change a migration before deploying it.

If your `platform.gen.ts` is older than your manifest or migrations, `cohostly deploy` refuses to go on. The message says: "platform.gen.ts is older than your manifest or migrations, so the code was written against types that no longer match. Run "platform types --local", fix any errors it shows in your code, then deploy again (or deploy with --skip-types-check)." The command installs under two names, `cohostly` and `platform`, so `platform types --local` is the same as `cohostly types --local`. Note that `cohostly dev` does not regenerate types. Run `types` yourself.

## Working safely

- **Experiment in a second project.** A project has its own database, so a spare project (for example `my-app-sandbox`) gives you a separate one to break. It counts toward the 6 databases an account can have.
- **Test destructive code against a throwaway table.** Add a new table in a new migration and aim your experiments at it.
- **Read first.** Run `findMany` with a small `take` and look before you run `updateMany` or `deleteMany`.
- **Keep `where` on every `...Many` call.** `deleteMany()` with no `where` means every row you may touch.
- **Do not point a script at the live database just to "see what happens".** The nightly backup is not a promised undo ([tables and migrations](data-tables-and-migrations.md)).

## A local run in Python or another language

Nothing changes. Under `cohostly dev` the variables `DATA_URL` and `PLATFORM_TOKEN` are set, so the HTTP calls in the [SDK reference](data-sdk-reference.md) work. There is still no visitor context, so table calls are anonymous unless you use `$app`.
