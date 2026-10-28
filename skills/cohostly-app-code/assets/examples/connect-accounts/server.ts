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
