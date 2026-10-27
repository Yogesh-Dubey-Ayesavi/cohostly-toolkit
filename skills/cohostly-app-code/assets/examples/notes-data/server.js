import { randomUUID } from 'node:crypto'
import express from 'express'
import { middleware, loginUrl } from '@cohostly/sdk'
import platform from './platform.gen.js' // generated: run `npm run types` after the manifest or a migration changes

const app = express()
app.use(express.json())
// Carries the visitor's signed context into platform.data calls, so the table's policy applies to them.
app.use(middleware({ required: false }))

// Notes belong to a person. An anonymous visitor is sent to sign in.
function needPerson(req, res, next) {
  if (req.platform?.caller?.kind === 'person') return next()
  res.status(401).json({ error: 'Sign in to use your notes.', sign_in: loginUrl('/') })
}

app.get('/notes', needPerson, async (_req, res) => {
  // The owner(user_id) policy returns only this person's rows. There is no where clause to forget.
  res.json(await platform.data.notes.findMany({ take: 50 }))
})

app.post('/notes', needPerson, async (req, res) => {
  const body = String(req.body?.body ?? '').trim()
  if (!body) return res.status(400).json({ error: 'A note needs some text.' })
  // user_id must be the caller: the policy rejects a row that names someone else.
  const note = await platform.data.notes.create({ data: { id: randomUUID(), user_id: req.platform.caller.id, body } })
  res.status(201).json(note)
})

app.delete('/notes/:id', needPerson, async (req, res) => {
  res.json(await platform.data.notes.deleteMany({ where: { id: req.params.id } }))
})

app.listen(process.env.PORT || 3000)
