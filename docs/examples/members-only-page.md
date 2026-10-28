---
title: A members-only page
nav: Members-only page
description: "A private app with three doors: any member, editors and up, and an owner-only admin page."
---

## What you will build

A private app for a small team. Everyone you invite can open the front page. Only editors (and above) can press "publish". Only the owner can open the admin page. The app checks the person's role on the server every time, not just by hiding a button.

## What you need

- Node 20 or later, and the command line (`npm install -g cohostly`).
- A second person (or a second email) to invite, so you can see the pages change.
- Four files.

## The files

```json title="package.json"
{
  "name": "roles-gate",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx server.ts",
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
  "name": "roles-gate",
  "health": { "port": 3000 },
  "context": { "preset": "friendly" }
}
```

```ts title="server.ts"
import express, { type NextFunction, type Request, type Response } from 'express'
import { middleware, loginUrl, type VerifiedContext } from '@cohostly/sdk'

type Req = Request & { platform?: VerifiedContext }

const app = express()
// required: true answers 401 when the platform's signed context is missing or fails to verify. Everything below can then trust req.platform.
app.use(middleware({ required: true }))

// access.role is the person's role on THIS project: viewer, editor, admin or owner. access.account_role is their role in the account
// that owns it: owner, admin or member. Both are always sent, whatever the context preset.
const PROJECT_ROLES = ['viewer', 'editor', 'admin', 'owner']
const atLeast = (have: string | undefined, need: string) => PROJECT_ROLES.indexOf(have ?? '') >= PROJECT_ROLES.indexOf(need)
const isAccountAdmin = (ctx?: VerifiedContext) => ctx?.access?.account_role === 'owner' || ctx?.access?.account_role === 'admin'

function needPerson(req: Req, res: Response, next: NextFunction) {
  if (req.platform?.caller?.kind === 'person') return next()
  // The app is private, so the platform has already sent anonymous visitors to sign in. A machine key lands here.
  res.status(403).json({ error: 'This page is for signed-in people.' })
}

function needRole(role: string) {
  return (req: Req, res: Response, next: NextFunction) =>
    atLeast(req.platform?.access?.role, role) ? next() : res.status(403).json({ error: `This needs the ${role} role on this project.` })
}

// Any person the project is shared with.
app.get('/', needPerson, (req: Req, res: Response) => {
  const { caller, access } = req.platform!
  res.json({ hello: caller?.name ?? 'there', role: access?.role, account_role: access?.account_role })
})

// Editors, admins and owners.
app.post('/publish', needPerson, needRole('editor'), (_req: Req, res: Response) => res.json({ published: true }))

// Only the project's owner, or an owner or admin of the account that owns it. Check the signed context, never a header you read yourself.
app.get('/admin', needPerson, (req: Req, res: Response) => {
  if (req.platform?.access?.role === 'owner' || isAccountAdmin(req.platform)) return res.json({ admin: true })
  res.status(403).json({ error: 'Only the owner can open this.', sign_in: loginUrl('/admin') })
})

app.listen(Number(process.env.PORT) || 3000)
```

Add the same `tsconfig.json` as in [Private notes](./private-notes.md).

## What each part does

**Roles.** A role says what a person may do in a project.

| Role | What they can do |
| --- | --- |
| `viewer` | Open the app and see its page and version list. |
| `editor` | Also deploy, roll back, change settings and read logs. |
| `admin` | Also change sharing. |
| `owner` | The project's owner. |

Separately, each person has a role in the **account** that owns the project: `owner`, `admin` or `member`. Account owners and admins can act as admin on every project in the account.

**`cohostly.json`** only asks for the `friendly` setting so the person's name can arrive (if they agreed to share it). No other service is used. There is no visibility line, because a settings file can not change who can open an app. You set that with a command, below.

**`server.ts`**

- `middleware({ required: true })` refuses any visit that has no valid signed note from the platform. After this line, the rest of the code can trust `req.platform`.
- `PROJECT_ROLES` lists the roles from smallest to largest. `atLeast(have, need)` is true when a person's role is the same as, or higher than, the one needed.
- `needPerson` lets in only real people. A program with an access key is turned away with a 403.
- `needRole('editor')` makes a door that refuses anyone below `editor`, with a message that names the role.
- **Front door `/`:** any person the project is shared with. It tells them their name and their roles.
- **`/publish`:** a person must also be at least an editor.
- **`/admin`:** only the project owner, or an owner or admin of the account.

> **Good to know** Hiding a link in the page is a courtesy, not a lock. Anyone can type the address. The lock is the check in the code, using the signed note, never a header you read yourself.

## Put it online

```sh
cohostly login
npm install
cohostly deploy --project roles-gate
cohostly share visibility private --project roles-gate
cohostly share invite colleague@example.com --role viewer --project roles-gate
```

`private` means only the people the project is shared with, and the account's owners and admins, can get in. Deploying never changes who can open an app, and a new project starts private, so the `visibility private` line makes it explicit. If the person does not have an account yet, they get an invitation that is good for 14 days.

Try the app on your own computer first with `cohostly dev --project roles-gate -- npm start`.

## Try it

1. As yourself (the owner), open the front page. You see your role, `owner`.
2. As the invited viewer, open the front page. You see `viewer`. Sending `POST /publish` answers 403 with "This needs the editor role on this project."
3. Promote them: `cohostly share role colleague@example.com editor --project roles-gate`. Now `POST /publish` answers `published: true`. `/admin` still says no.
4. See everyone: `cohostly share list --project roles-gate`.

Changes to sharing take effect within about 30 seconds, usually at the next visit.

## Make it yours

1. Add another door: a page only admins can open, using `needRole('admin')`.
2. Show a different front page to each role. Read `req.platform.access.role` and choose what to show.
3. Allow the whole team at once: `cohostly share visibility account --project roles-gate` lets any signed-in member of your account in. Everyone else is still shut out.

## If something goes wrong

- **Someone says "not found".** For a private app, "not found" is what an outsider sees. They are not shared with. Invite them, or check the level with `cohostly share list`.
- **Everyone is `viewer`.** That is the default when you invite. Use `--role editor` or `cohostly share role`. Ask before giving `admin`.
- **The invitation does nothing.** If they have no account yet, it activates when they confirm their email. Until then they have not got access, and it expires after 14 days.
- **Widening is held.** If you are not an account owner or admin, opening the app wider waits for one to approve it. The app stays as it was until they do. Narrowing towards `private` is immediate.

Read more: [Sharing and roles](../settings/sharing-and-roles.md), [the request context](../sdk/request-context.md).
