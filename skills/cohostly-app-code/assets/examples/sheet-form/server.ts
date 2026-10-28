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
