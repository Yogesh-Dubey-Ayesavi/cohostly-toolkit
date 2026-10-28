---
title: Private notes
nav: Private notes
description: A notepad where every signed-in person can add, read and delete their own notes and nobody else's.
---

## What you will build

A small notes app. Anyone signed in can write notes, list them and delete them. Each person only ever sees their own. The app has no lock-and-key code for that. The platform's small database applies a rule, written in one line, that hides other people's rows.

This is a notes **API**: it answers requests with data, not with a pretty page. You can try it with a few terminal commands, and put a page in front of it later.

## What you need

- Node 20 or later, and the command line (`npm install -g cohostly`).
- The folder below, with five files.
- A moment to write down the project name. It appears in two places and they must match.

## The files

```json title="package.json"
{
  "name": "notes-data",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx server.ts",
    "types": "cohostly types --project notes-data",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "@cohostly/sdk": "^0.2.1",
    "express": "^4.19.2",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

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

```ts title="server.ts"
import { randomUUID } from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { middleware, loginUrl, type VerifiedContext } from '@cohostly/sdk'
import platform from './platform.gen.js' // generated: run `npm run types` after the manifest or a migration changes

type Req = Request & { platform?: VerifiedContext }

const app = express()
app.use(express.json())
// Carries the visitor's signed context into platform.data calls, so the table's policy applies to them.
app.use(middleware({ required: false }))

// Notes belong to a person. An anonymous visitor is sent to sign in.
function needPerson(req: Req, res: Response, next: NextFunction) {
  if (req.platform?.caller?.kind === 'person') return next()
  res.status(401).json({ error: 'Sign in to use your notes.', sign_in: loginUrl('/') })
}

app.get('/notes', needPerson, async (_req: Req, res: Response) => {
  // The owner(user_id) policy returns only this person's rows. There is no where clause to forget.
  res.json(await platform.data.notes.findMany({ take: 50 }))
})

app.post('/notes', needPerson, async (req: Req, res: Response) => {
  const body = String(req.body?.body ?? '').trim()
  if (!body) return res.status(400).json({ error: 'A note needs some text.' })
  // user_id must be the caller: the policy rejects a row that names someone else.
  const note = await platform.data.notes.create({ data: { id: randomUUID(), user_id: req.platform!.caller!.id!, body } })
  res.status(201).json(note)
})

app.delete('/notes/:id', needPerson, async (req: Req, res: Response) => {
  res.json(await platform.data.notes.deleteMany({ where: { id: String(req.params.id) } }))
})

app.listen(Number(process.env.PORT) || 3000)
```

You will also want a `tsconfig.json` next to them so the type check works:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["*.ts"]
}
```

## What each part does

**The small database.** `"bindings": { "data": { "managed": true } }` in `cohostly.json` asks the platform for one small database for this project. A "binding" is a service the platform lends your app. There is no password and no address to look after: the app reaches the database only through the platform.

**The table.** The `migrations` folder holds the recipe for the database's tables. `001_init.sql` makes a table called `notes` with three columns: an `id`, a `user_id` (who it belongs to) and `body` (the text). Files run once each, in name order, when you deploy. The app uses the plain types `TEXT`, `INTEGER`, `REAL` and `BLOB`.

**The rule.** The comment line `-- policy: owner(user_id)` is the privacy rule. It says: each signed-in person can read and change only the rows whose `user_id` is their own. The column that holds the owner cannot be changed later. A table with no policy line at all is reachable only by the app's own trusted code, so visitors see nothing in it. That is a safe default, and also the most common reason a new table "returns no rows".

**`server.ts`**

- `import platform from './platform.gen.js'` is the ready-made set of helpers for this project's database. You do not write that file. The command `cohostly types` writes it, and it has one entry per table.
- `middleware({ required: false })` checks who is visiting and also carries that information into every database call. That is how the rule knows whose notes to show.
- `needPerson` is a small guard. If the visitor is not a signed-in person, the app answers "401" with a plain message and the sign-in link.
- **List:** `findMany({ take: 50 })` asks for up to 50 notes. Only this person's come back, because of the rule. There is no "where" line that you could forget.
- **Add:** `create(...)` makes a note. The `user_id` is set to the visitor's own id. If the code tried to write someone else's id, the rule would refuse.
- **Delete:** `deleteMany({ where: { id } })` deletes by id. Again, the rule limits it to this person's rows, so guessing another person's note id does nothing.

> **Good to know** Everything that is a real record belongs in this database, not in a file on the app's disk. The disk is wiped by restarts and new versions. A pause is not a backup either.

## Put it online

```sh
cohostly login
npm install
cohostly types --project notes-data      # writes platform.gen.ts
npm run check                            # optional: look for mistakes
cohostly deploy --project notes-data
cohostly share visibility signed_in --project notes-data
```

Run `cohostly types` again every time you add a table. If it says it cannot find the project, deploy once first so the project exists, then run it again.

> **Good to know** Moving the notes app to `signed_in` means anyone with a Cohostly account can open it. That is a decision about who sees your app, so check [Sharing and roles](../settings/sharing-and-roles.md) first. If you are only trying it out, leave it private: you can still use it yourself.

To try it on your own computer first: `cohostly dev --project notes-data -- npm start`.

## Try it

You need to be signed in, so open your app's address in a browser and use the browser's tools, or call it from a page of your own. Once you are in:

- Add a note: send a `POST` to `/notes` with `{"body":"buy milk"}`. You get back the new note with status 201.
- List: open `/notes`. You see your note.
- Ask a friend to sign in and open `/notes`. They see an empty list, not yours.
- Delete: send a `DELETE` to `/notes/<the id>`.

If you are not signed in, you get a short message and a sign-in link instead.

## Make it yours

1. Add a title. Add a new file `migrations/002_add_title.sql` containing `ALTER TABLE notes ADD COLUMN title TEXT;`, then run `cohostly types` and deploy.
2. Let anyone read a table but nobody write it. Use a different rule line: `-- policy: public_read`. Other rules include `signed_in_read` and `roles(...)`. See [Data](../bindings/data.md).
3. Put a page in front of it. Serve one HTML file from the same app that calls `/notes` and shows the list.

> **Good to know** Never edit `001_init.sql` after it has been deployed. The deploy will be refused. Add a new numbered file for every change.

## If something goes wrong

- **The list is always empty.** Your table has no `-- policy:` line, or you are looking at someone else's rows. Check the line above `CREATE TABLE`, and who is signed in.
- **Deploy is refused with a message about a migration.** An already-applied file was edited. Put the old text back and add a new file instead.
- **A write is refused.** The rule says the `user_id` must be the visitor's. Check that the code sets it from `req.platform.caller.id`.
- **`platform.gen.js` is missing.** Run `cohostly types --project notes-data`.

Related: [Data](../bindings/data.md) lists every rule line and the limits (up to 1000 rows per read, 100 if you do not say how many). The [platform object](../sdk/platform-object.md) page covers errors.
