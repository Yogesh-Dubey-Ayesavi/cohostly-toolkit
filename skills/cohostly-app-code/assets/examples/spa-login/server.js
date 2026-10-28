import express from 'express'

// A single-page app is only files. The platform answers /__platform/me, /__platform/login and /__platform/logout on the app's own address,
// so the page needs no server code and no SDK to know who is there.
const app = express()
app.use(express.static(new URL('./public', import.meta.url).pathname))
app.listen(Number(process.env.PORT) || 3000)
