import express from 'express'
import platform from './platform.gen.js' // generated: run `npm run types`

const app = express()
const done = new Set() // approval ids already acted on. In a real app keep these in the database: a restart empties memory.

async function purgeOldOrders(approvalId) {
  if (done.has(approvalId)) return // the callback can arrive more than once: acting twice must be harmless
  done.add(approvalId)
  // ... delete the rows the approver agreed to here ...
}

// The platform calls this path with the decision. The SDK checks it is really the platform and that the body is untampered.
app.post('/__platform/hooks/approvals/decision', platform.approvals.callback({
  handler: async (d) => {
    if (d.status === 'approved') await purgeOldOrders(d.id)
    // denied and expired mean: do nothing.
  },
}).express)

// Ask first, act later. The summary is exactly what the approver reads, so it says what will happen.
app.post('/purge', async (_req, res) => {
  const approval = await platform.approvals.request({
    summary: 'Delete all orders older than 90 days',
    details: { table: 'orders', older_than_days: 90 },
    risk: 'high',
    action: 'purge_orders',
    expiresIn: 3600,
  })
  res.status(202).json({ approval_id: approval.id, status: approval.status })
})

app.listen(process.env.PORT || 3000)
