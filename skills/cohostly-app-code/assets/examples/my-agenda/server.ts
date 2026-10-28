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
