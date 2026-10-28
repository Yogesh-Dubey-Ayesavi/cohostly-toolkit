---
title: A sign-up list in a Google Sheet
nav: Sign-up sheet
description: A form that adds each email to your own Google Sheet, without the app ever holding a Google password or token.
---

## What you will build

A one-box web form: "Your email, Join". Every time someone joins, a new row appears in your Google Sheet with the time and the email. You do not paste any Google key into the app. You connect your Google account once in the dashboard, and the platform makes the calls for the app.

## What you need

- Node 20 or later, and the command line (`npm install -g cohostly`).
- A Google Sheet you own, and its id. The id is the long piece in the sheet's address between `/d/` and `/edit`.
- Five files.

## The files

```json title="package.json"
{
  "name": "sheet-form",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx server.ts",
    "types": "cohostly types --project sheet-form",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "@cohostly/sdk": "^0.2.1",
    "@googleapis/sheets": "^9.0.0",
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
  "name": "sheet-form",
  "health": { "port": 3000 },
  "env": { "vars": { "SHEET_ID": "replace-with-your-spreadsheet-id" } },
  "bindings": { "connections": { "sheet": { "provider": "google-sheets", "permissions": ["sheets.write"], "access": "owner" } } }
}
```

```ts title="server.ts"
import express, { type Request, type Response } from 'express'
import { sheets } from '@googleapis/sheets'
import { middleware } from '@cohostly/sdk'
import platform from './platform.gen.js' // generated: run `npm run types`

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(middleware({ required: false }))

// access: "owner" means every submission goes into the sheet the project's owner connected. The app never holds a Google token:
// the official client is handed to the connection, which adds the credential.
const sheet = platform.connections.sheet.google(sheets, { version: 'v4' })
const SHEET_ID = process.env.SHEET_ID // a plain setting (env.vars), not a secret

app.get('/', (_req: Request, res: Response) => { res.send('<form method="post" action="/submit"><input name="email" type="email" required><button>Join</button></form>') })

app.post('/submit', async (req: Request, res: Response) => {
  try {
    await sheet.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: 'A1', valueInputOption: 'RAW',
      requestBody: { values: [[new Date().toISOString(), String(req.body.email ?? '')]] },
    })
    res.send('Thanks, you are on the list.')
  } catch (e: any) {
    // Normal states, not bugs: nobody has connected the sheet yet, or a permission was not given.
    if (e?.response?.data?.error?.code === 'no_grant') return res.status(503).send('This form is not set up yet. The owner needs to connect Google Sheets in the dashboard.')
    throw e
  }
})

app.listen(Number(process.env.PORT) || 3000)
```

Add the same `tsconfig.json` as in [Private notes](./private-notes.md).

## What each part does

**A connection.** A "connection" is a link from your project to an outside account, here Google. In `cohostly.json`:

- `"sheet"` is the connection's name. The code uses that same name (`platform.connections.sheet`). Once the code uses a name, renaming it breaks the app, so choose it with care.
- `provider: "google-sheets"` says which service.
- `permissions: ["sheets.write"]` says what the app needs. The person connecting sees each permission in plain words and may give less.
- `access: "owner"` means whose account is used: the project owner's, for every visitor. This is right for "every sign-up goes into my sheet". The other choice, `user`, uses each visitor's own account, and is for apps like "your tasks live in your own sheet".

**`env.vars`** holds plain settings that are not secret. `SHEET_ID` is your sheet's id. Replace the placeholder text with yours. An id is not a password, but never put real keys or passwords here.

**`server.ts`**

- `sheets` comes from Google's own official package. The app hands it to the connection with `platform.connections.sheet.google(sheets, ...)`. From then on, every function is Google's own, but the real token never reaches your app.
- `GET /` shows the form. `POST /submit` receives it.
- `values.append(...)` adds a new row at the bottom of the sheet: the time, then the email.
- **"Not yet" is normal.** If nobody has connected Google yet, the call fails with a `no_grant` message. The app shows a friendly "not set up yet" page, not a crash.

> **Good to know** The sheet connection is Google or Microsoft only today. Slack is not set up yet.

## Put it online

```sh
cohostly login
npm install
```

1. Edit `SHEET_ID` in `cohostly.json` to your sheet's id.
2. Deploy: `cohostly deploy --project sheet-form`.
3. Connect Google **once**, in the dashboard, under Connections. Pick the Google account that owns the sheet, and agree to the permission shown.
4. Run `cohostly types --project sheet-form` if you change the settings and then deploy again. (If it says it cannot find the project, deploy once first.)
5. Open it up so people can sign up: `cohostly share visibility link --project sheet-form`. `link` means anyone with the address can open it.

## Try it

Open the address and type an email. You should see "Thanks, you are on the list." Open your Google Sheet. A new row has the time and the email.

If you see "This form is not set up yet", step 3 has not been done.

## Make it yours

1. Add a name box. Add `<input name="name">` to the form and put `String(req.body.name ?? '')` in the row.
2. Write to a different tab: change `range: 'A1'` to something like `'Sign-ups!A1'`.
3. Let each visitor use their own sheet instead: set `"access": "user"`. Each visitor then connects their own Google account the first time. For that, the call must happen inside a request that `middleware()` handles, and the visitor may be sent to a connect page first. See [Connections](../bindings/connections.md).

## If something goes wrong

- **"Not set up yet".** Nobody connected Google. In the dashboard open Connections and connect it.
- **A permission error.** The person who connected gave less than the settings file asks for. Reconnect and approve all the permissions.
- **Nothing appears in the sheet.** `SHEET_ID` is still the placeholder, or it belongs to a sheet the connected account cannot write to.
- **The connection stopped working.** It may need to be reconnected by the person who made it. The dashboard shows it under Connections.

Related: [Connections](../bindings/connections.md), [Secrets](../cli/secrets.md).
