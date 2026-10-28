---
title: Connection examples
description: Three complete apps explained line by line, from one shared sheet to many visitors with their own Google and Outlook accounts.
nav: Worked examples
---

Three small apps, from simplest to most complete. Each shows every file that matters and explains it in plain words.

| Example | Type | Description |
| --- | --- | --- |
| Sign-up sheet | owner | One shared Google account. Every email goes into the owner's sheet. |
| My agenda | user | Each visitor sees their own next calendar events. |
| Connect accounts | user | Two providers, three states, a "use a different account" link. |

Every app here needs the generated `platform.gen.ts`. Run `npm run types` after you change `cohostly.json`. A package file for the first one is on the [sign-up sheet](../examples/signup-sheet.md) page. The other two use the same shape without `@googleapis/sheets`, and with the project name in their `types` script.

## Sign-up sheet: one shared account

**What it does.** A one-box form, "Your email, Join". Each sign-up adds a row with the time and the email to the owner's Google Sheet.

**Mode.** `owner`. The visitors do nothing about Google. The owner connects once.

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

**Step by step**

1. `cohostly.json` declares one connection named `sheet`. It uses `google-sheets` and asks for `sheets.write`, which means "read and change all the Google Sheets in the account". `access: "owner"` says everyone acts through the owner's account.
2. `SHEET_ID` is a plain setting, not a secret. It is the long id between `/d/` and `/edit` in the sheet's address.
3. `middleware({ required: false })` lets the app read who is visiting. This example does not use it, but the call below is safe inside it.
4. `platform.connections.sheet.google(sheets, { version: 'v4' })` hands Google's own `sheets` library to the connection. From here every function is Google's. The real token stays with the platform.
5. `GET /` shows the form. `POST /submit` receives it.
6. `values.append` adds a row at the bottom: the time and the email. The platform checks that the call is allowed, adds the login and sends it to Google.
7. If nobody has connected Google yet, the call fails with `no_grant`. The app answers with a friendly "not set up yet" page instead of crashing. Through the official Google client the code lives in `e.response.data.error.code`.

**Set up.** Deploy. Then an account owner or admin opens Connections in the dashboard, connects the Google account that owns the sheet, and gives the connection to this tool. Open the app's sharing so people can reach the form. Try it, and look for the new row.

**Good to know**

- This example asks for `sheets.write`, which reaches every Sheet in the account. If you would rather give it one sheet, use `sheets.files` instead. Then the owner has to pick that sheet in Google's picker, and `SHEET_ID` must be that sheet ([picked files](connections-picked-files.md)).
- It handles `no_grant` but not `permission_not_granted`. If the person gave less than you asked for, add that case.
- To use each visitor's own sheet, change `access` to `"user"` and handle `connection_required` (see the next example).

## My agenda: each visitor's own calendar

**What it does.** Shows a signed-in visitor the titles of their next five calendar events. Each visitor sees only their own calendar.

**Mode.** `user`. The call acts as the visitor, not as the owner.

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "my-agenda",
  "health": { "port": 3000 },
  "bindings": { "connections": { "agenda": { "provider": "google-workspace", "permissions": ["calendar.read"], "access": "user" } } }
}
```

```ts title="server.ts"
import express, { type Request, type Response } from 'express'
import { middleware, loginUrl, PlatformError, type VerifiedContext } from '@cohostly/sdk'
import platform from './platform.gen.js' // generated: run `npm run types` after the manifest changes

type Req = Request & { platform?: VerifiedContext }

const app = express()
// access: "user" needs the visitor's signed context to find THEIR connection, so the call must happen inside a request this middleware handled.
app.use(middleware({ required: false }))

// Shows the signed-in visitor their own next calendar events. The app never holds a Google token and never sees anyone else's calendar.
app.get('/', async (req: Req, res: Response) => {
  if (req.platform?.caller?.kind !== 'person') return res.send(`<p><a href="${loginUrl('/')}">Sign in</a> to see your agenda.</p>`)
  try {
    const events = await platform.connections.agenda.get({ path: `calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date().toISOString())}` }) as { items?: { summary?: string }[] }
    res.json({ next: (events.items ?? []).map((e) => e.summary ?? '(no title)') })
  } catch (e) {
    // Normal state, not a bug: this person has not connected Google yet. Send them to the one page where they do, then they come back.
    if (e instanceof PlatformError && e.code === 'connection_required' && e.connectUrl) return res.send(`<p><a href="${e.connectUrl}">Connect Google Calendar</a> to see your agenda.</p>`)
    throw e
  }
})

app.listen(Number(process.env.PORT) || 3000)
```

**Step by step**

1. The manifest names one connection, `agenda`, on `google-workspace`, with `calendar.read` and `access: "user"`. Reading only: the app cannot add or change events.
2. `middleware({ required: false })` runs on every request. It checks the visitor's signed context and keeps it for the whole request. The `user` call needs this to find the right person's connection.
3. If the visitor is not a signed-in person, the page shows a sign-in link made by `loginUrl('/')`. An anonymous visitor cannot have a connection.
4. For a signed-in visitor, the app makes one `get` with Google's own Calendar path. The query asks for five events, in time order, starting now. The time is encoded with `encodeURIComponent` because everything after the `?` is sent exactly as written.
5. The platform finds this visitor's connection and sends the call as them.
6. If this visitor has not connected yet, the call fails with `connection_required`. That error carries `connectUrl`. The app shows a "Connect Google Calendar" link to it. The visitor makes one consent, then comes back and reloads.
7. A successful call returns Google's JSON. The app picks each event's `summary`.

**Sharing.** It works at `link` or `public`, where it shows a sign-in link to anonymous visitors. To admit only people with a Cohostly account, set `signed_in` visibility after deploying.

**If you copy it.** It handles only `connection_required`. Add `connection_needs_reauth` (same link) and `connection_revoked` (a visitor who disconnected). Or use `allowed()` first, as in the next example.

## Connect accounts: many visitors, two providers

**What it does.** A page where every visitor connects their own Google and Outlook calendars and sees their next events. The app stores nothing about anyone: no tokens, no list of who connected.

**Mode.** `user`, twice, one binding for each provider.

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "connect-accounts",
  "health": { "port": 3000 },
  "bindings": {
    "connections": {
      "google": { "provider": "google-workspace", "permissions": ["calendar.read"], "access": "user" },
      "microsoft": { "provider": "microsoft-graph", "permissions": ["calendar.read"], "access": "user" }
    }
  }
}
```

```ts title="server.ts"
import express, { type Request, type Response } from 'express'
import { middleware, loginUrl, PlatformError, type VerifiedContext } from '@cohostly/sdk'
import platform from './platform.gen.js' // generated: run `npm run types` after the manifest changes

type Req = Request & { platform?: VerifiedContext }

const app = express()
// Every connection here is access: "user", so each call acts as the visitor and needs their signed context. middleware() keeps it for the whole request.
app.use(middleware({ required: false }))

// The app is multi-tenant without storing anything: it never holds a token, a refresh token or a list of who connected what. The platform keeps each
// visitor's connection and picks the right one from the signed context, so visitor A can never reach visitor B's calendar, whatever this code does.
interface Card { provider: string; state: 'connected' | 'not_connected' | 'needs_reconnect' | 'error'; account?: string; connectUrl?: string; next?: string[] }

const PROVIDERS = {
  google: {
    label: 'Google Calendar',
    status: () => platform.connections.google.allowed(),
    events: async () => ((await platform.connections.google.get({ path: `calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date().toISOString())}` })) as { items?: { summary?: string }[] }).items?.map((e) => e.summary ?? '(no title)') ?? [],
  },
  microsoft: {
    label: 'Outlook Calendar',
    status: () => platform.connections.microsoft.allowed(),
    events: async () => ((await platform.connections.microsoft.get({ path: 'me/events?$top=5&$select=subject&$orderby=start/dateTime' })) as { value?: { subject?: string }[] }).value?.map((e) => e.subject ?? '(no title)') ?? [],
  },
} as const

// One provider's state for this visitor. "Not connected" and "needs to be connected again" are ordinary states with a button, not errors.
async function card(name: keyof typeof PROVIDERS): Promise<Card> {
  const p = PROVIDERS[name]
  try {
    const s = await p.status()
    if (s.status === 'needs_reauth') return { provider: p.label, state: 'needs_reconnect', account: s.account, connectUrl: s.connect_url }
    if (s.status !== 'active') return { provider: p.label, state: 'not_connected', connectUrl: s.connect_url }
    return { provider: p.label, state: 'connected', account: s.account, next: await p.events() }
  } catch (e) {
    // The calls can also answer connection_required / connection_needs_reauth themselves (a connection removed between two calls): same buttons.
    if (e instanceof PlatformError && e.code === 'connection_required') return { provider: p.label, state: 'not_connected', connectUrl: e.connectUrl }
    if (e instanceof PlatformError && e.code === 'connection_needs_reauth') return { provider: p.label, state: 'needs_reconnect', connectUrl: e.connectUrl }
    console.warn(`[connect-accounts] ${p.label}: ${e instanceof Error ? e.message : String(e)}`)
    return { provider: p.label, state: 'error' }
  }
}

const signedIn = (req: Req) => req.platform?.caller?.kind === 'person'

app.get('/api/connections', async (req: Req, res: Response) => {
  if (!signedIn(req)) return res.status(401).json({ error: 'Sign in first.', sign_in: loginUrl('/') })
  res.json(await Promise.all((Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map(card)))
})

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const WORDS = { connected: 'Connected', not_connected: 'Not connected', needs_reconnect: 'Needs to be connected again', error: 'Could not be reached right now' }

app.get('/', async (req: Req, res: Response) => {
  if (!signedIn(req)) return res.send(`<h1>Your calendars</h1><p><a href="${esc(loginUrl('/'))}">Sign in</a> to connect your own accounts.</p>`)
  const cards = await Promise.all((Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map(card))
  res.send(`<h1>Your calendars</h1>${cards.map((c) => `<section><h2>${esc(c.provider)}</h2><p>${WORDS[c.state]}${c.account ? ` as ${esc(c.account)}` : ''}</p>` +
    (c.state === 'connected' ? `<ul>${(c.next ?? []).map((n) => `<li>${esc(n)}</li>`).join('') || '<li>Nothing coming up.</li>'}</ul>` : '') +
    (c.connectUrl && c.state !== 'connected' ? `<p><a href="${esc(c.connectUrl)}">${c.state === 'needs_reconnect' ? 'Connect again' : 'Connect'}</a></p>` : '') +
    // A connected visitor can switch to another account of theirs on the same page.
    (c.connectUrl && c.state === 'connected' ? `<p><a href="${esc(c.connectUrl)}">Use a different account</a></p>` : '') + `</section>`).join('')}`)
})

app.listen(Number(process.env.PORT) || 3000)
```

**Step by step**

1. Two bindings, `google` and `microsoft`, both `access: "user"`, both reading a calendar. Each provider gets its own name, because one name belongs to one provider.
2. `middleware({ required: false })` keeps the visitor's signed context for the whole request. Both bindings need it.
3. `PROVIDERS` holds, for each provider, a label, a way to ask for its status (`allowed()`) and a way to fetch events. Google uses `calendar/v3/...`. Microsoft uses `me/events?...`. The Microsoft path starts at `me/` because version 1.0 is already in the address, and the `$` in the query goes through as written.
4. `card()` decides what one provider's tile shows for this visitor. It asks `allowed()` first:
   - `needs_reauth` becomes "Needs to be connected again" with a connect link.
   - Any status other than `active` (for example `not_connected` or `revoked`) becomes "Not connected" with a connect link.
   - `active` becomes "Connected", shows the account name, and only then fetches the events.
5. The `catch` covers a race: the connection can disappear between `allowed()` and the real call. The real call then answers `connection_required` or `connection_needs_reauth`, and the tile gets the same buttons using `e.connectUrl`. Any other failure shows "Could not be reached right now" and logs a line.
6. `/api/connections` returns the tiles as JSON, for a front end. It refuses anyone who is not a signed-in person.
7. `/` draws the page. A visitor who is not signed in gets a sign-in link. Otherwise each provider gets a section: the state in words, the next events if connected, a Connect or Connect again link if not, and "Use a different account" next to a connected state. All three links go to `connect_url`.
8. Every value is escaped with `esc()` before it goes into the page, because names and event titles come from other people.

**Why it is safe for many visitors.** The platform keeps each visitor's connection and picks the right one from the signed context. Visitor A can never reach visitor B's calendar, whatever this code does. The app has no token to leak and no table to protect.

**Sharing.** Open the app to the people who should connect: `link`, `public` or `signed_in`. A visitor needs a Cohostly account to connect, because the connection belongs to their Cohostly account. Anonymous visitors get a sign-in link.

**Visitors in control.** A person can disconnect their own account any time in the dashboard, under Connections. The tile then shows "Not connected" again.

Related: [owner and visitor mode](connections-modes.md), [asking what is allowed](connections-allowed.md), [errors](connections-errors.md).
