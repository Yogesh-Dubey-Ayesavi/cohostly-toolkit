import express from 'express'
import { middleware, loginUrl } from '@cohostly/sdk'

const app = express()

// Verifies the signed context on every request. required: false lets anonymous visitors in, which is a normal state.
app.use(middleware({ required: false }))

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

app.get('/', (req, res) => {
  const caller = req.platform?.caller
  if (caller?.kind === 'person') {
    // caller.name needs the "friendly" preset AND the person's consent, so it can be missing. Do not invent a name.
    return res.send(`<h1>${caller.name ? `Hello, ${esc(caller.name)}` : 'Hello'}</h1>`)
  }
  res.send(`<h1>Hello</h1><p><a href="${esc(loginUrl('/'))}">Sign in</a> to be greeted by name.</p>`)
})

app.listen(process.env.PORT || 3000)
