import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleApprovals, parseApprovalsArgs } from './commands/approvals.js';

test('platform approvals reads its arguments and says what is wrong in words', () => {
  assert.deepEqual(parseApprovalsArgs([]), { action: 'list', json: false, tab: 'needs_me', ids: [], project: undefined, rest: [] });
  assert.equal((parseApprovalsArgs(['waiting']) as any).tab, 'waiting');
  assert.deepEqual((parseApprovalsArgs(['approve', 'a1', '--note', 'ok']) as any).ids, ['a1']);
  assert.equal((parseApprovalsArgs(['bulk', 'a', 'b', '--deny']) as any).deny, true);
  assert.deepEqual((parseApprovalsArgs(['allow', 'app', 'send_email', '--per-request', '10', '--per-day', '20', '--unit', 'emails']) as any).rule, { action: 'send_email', perRequest: 10, perDay: 20, days: 30, unit: 'emails' });
  assert.match(String(parseApprovalsArgs(['allow', 'app', 'send_email'])), /stays narrow/);
  assert.match(String(parseApprovalsArgs(['approve'])), /Which one/);
  assert.match(String(parseApprovalsArgs(['frobnicate'])), /do not know/);
  assert.match(String(parseApprovalsArgs(['--days', 'x'])), /needs a number/);
});

test('each approvals command calls the route the dashboard uses; deciding sends the fingerprint it saw and names the CLI as the channel', async () => {
  const seen: string[] = []; const bodies: any[] = [];
  const item = { id: 'a1', kind: 'app_action', headline: 'tool wants to send email (14)', risk: 'normal', status: 'pending', expires_at: '2026-10-25T00:00:00Z', details_hash: 'h'.repeat(64),
    app_says: { text: 'Send the report' }, change: { before: 'Nothing has happened yet.', after: 'tool will go ahead.' }, deciders: ['Ana', 'Ben'] };
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      seen.push(`${req.method} ${req.url}`); if (b) bodies.push(JSON.parse(b));
      const send = (o: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url!.startsWith('/v1/inbox?')) return send({ items: [item] });
      if (req.url === '/v1/inbox/a1') return send({ item });
      if (req.url!.endsWith('/approval-rules') && req.method === 'GET') return send({ rules: [{ id: 'r1', active: true, sentence: 'tool may send email up to 20 emails a day.', used_today: 3 }] });
      if (req.url!.endsWith('/approval-rules')) return send({ rule: { sentence: 'tool may send email up to 20 emails a day.' } });
      if (req.url === '/v1/approval-delegations' && req.method === 'GET') return send({ given: [{ id: 'd1', to: 'Ben', ends_at: '2026-10-30T00:00:00Z' }], received: [] });
      if (req.url === '/v1/approval-delegations') return send({ message: 'Ben can decide for you until 2026-10-25.' });
      send({ note: 'Recorded.', results: [{ id: 'a1', ok: true, status: 'approved' }], decided: 1 });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`; const lines: string[] = []; const out = (s: string) => lines.push(s);
  try {
    await handleApprovals([], url, out);
    await handleApprovals(['history', '--project', 'tool'], url, out);
    await handleApprovals(['approve', 'a1', '--note', 'fine'], url, out);
    await handleApprovals(['deny', 'a1'], url, out);
    await handleApprovals(['bulk', 'a1'], url, out);
    await handleApprovals(['rules', 'tool'], url, out);
    await handleApprovals(['allow', 'tool', 'send_email', '--per-request', '10', '--per-day', '20'], url, out);
    await handleApprovals(['revoke-rule', 'tool', 'r1'], url, out);
    await handleApprovals(['away', 'ben@x.test', '--days', '3'], url, out);
    await handleApprovals(['away'], url, out);
    await handleApprovals(['end', 'd1'], url, out);
  } finally { server.close(); }
  assert.deepEqual(seen, ['GET /v1/inbox?tab=needs_me', 'GET /v1/inbox?tab=history&project=tool', 'GET /v1/inbox/a1', 'POST /v1/approvals/a1/decision', 'GET /v1/inbox/a1', 'POST /v1/approvals/a1/decision', 'GET /v1/inbox/a1', 'POST /v1/approvals/bulk',
    'GET /v1/projects/tool/approval-rules', 'POST /v1/projects/tool/approval-rules', 'DELETE /v1/projects/tool/approval-rules/r1', 'POST /v1/approval-delegations', 'GET /v1/approval-delegations', 'DELETE /v1/approval-delegations/d1']);
  assert.deepEqual(bodies[0], { decision: 'approve', details_hash: 'h'.repeat(64), channel: 'cli', note: 'fine' });
  assert.deepEqual(bodies[1], { decision: 'deny', details_hash: 'h'.repeat(64), channel: 'cli' });
  assert.deepEqual(bodies[2], { decision: 'approve', items: [{ id: 'a1', details_hash: 'h'.repeat(64) }], channel: 'cli' });
  assert.deepEqual(bodies[3], { action: 'send_email', max_per_request: 10, max_per_day: 20, days: 30 });
  assert.match(lines[0], /a1  \[normal\]  tool wants to send email \(14\)/); assert.ok(lines.some((l) => /The app wrote: Send the report/.test(l))); assert.ok(lines.some((l) => /Can decide: Ana, Ben/.test(l)));
  assert.ok(lines.includes('Recorded.')); assert.ok(lines.some((l) => /may send email up to 20 emails a day/.test(l))); assert.ok(lines.some((l) => /you → Ben/.test(l)));
});
