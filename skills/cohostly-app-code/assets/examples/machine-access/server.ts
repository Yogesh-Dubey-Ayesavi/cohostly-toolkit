import express, { type NextFunction, type Request, type Response } from 'express'
import { middleware, type VerifiedContext } from '@cohostly/sdk'

type Req = Request & { platform?: VerifiedContext }

const app = express()
app.use(express.json())
app.use(middleware({ required: true }))

// A program with an access key (Authorization: Bearer plk_svc_...) arrives as caller.kind "machine". The key's scopes, set when it was
// made, are in access.scopes. A key opens only this one app.
function needScope(scope: string) {
  return (req: Req, res: Response, next: NextFunction) => {
    const ctx = req.platform
    if (ctx?.caller?.kind !== 'machine') return res.status(403).json({ error: 'This route is for programs with an access key.' })
    if (!ctx.access?.scopes?.includes(scope)) return res.status(403).json({ error: `This key needs the "${scope}" scope.` })
    next()
  }
}

// A webhook sender (Zapier, a script) posts orders. caller.label is the key's name, which is what to write in a log line.
app.post('/orders', needScope('orders:write'), (req: Req, res: Response) => {
  console.log(`order from ${req.platform!.caller!.label}`)
  res.status(202).json({ accepted: true, id: req.body?.id ?? null })
})

// People use the same app. They are not machines, so the check above never lets them in here.
app.get('/', (req: Req, res: Response) => {
  const c = req.platform!.caller
  res.json({ you: c?.kind === 'machine' ? `key "${c.label}"` : 'a person' })
})

app.listen(Number(process.env.PORT) || 3000)
