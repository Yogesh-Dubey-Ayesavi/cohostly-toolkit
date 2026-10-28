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
