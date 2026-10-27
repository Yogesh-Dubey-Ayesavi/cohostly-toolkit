import express from 'express'
import platform from './platform.gen.js' // generated: run `npm run types`

const app = express()

// The platform owns the clock: a paused app runs nothing, so a timer inside the app would never fire. This registers the schedule
// with the platform, which wakes the app when it is due. Define schedules while the app starts.
platform.cron.schedule('every weekday at 9:00', buildReport, { name: 'daily-report', timeZone: 'Asia/Kolkata', retries: 2 })

async function buildReport(run) {
  // Delivery is at least once, so a run can arrive twice. The run id is the key: the second insert is skipped.
  const seen = await platform.data.$app.report_runs.findMany({ where: { run_id: run.id }, take: 1 })
  if (seen.length) return
  // ... build and send the report here ...
  await platform.data.$app.report_runs.create({ data: { run_id: run.id, ran_at: new Date().toISOString(), note: `attempt ${run.attempt}` } })
}

// Where the platform calls in (POST /__platform/jobs/<name>). Only the platform's scheduler can reach it.
app.use(platform.cron.express())

app.get('/', (_req, res) => res.send('scheduled-report is running'))
app.listen(process.env.PORT || 3000)
