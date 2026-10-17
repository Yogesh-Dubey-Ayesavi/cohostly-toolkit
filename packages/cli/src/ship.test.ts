import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleShip, parseShipArgs } from './commands/ship.js';

test('platform ship reads its arguments and says what is wrong in words', () => {
  assert.deepEqual(parseShipArgs(['app']), { action: 'requests', project: 'app', json: false });
  assert.deepEqual(parseShipArgs(['approve', 'app', 'r1', '--note', 'ok']), { action: 'approve', project: 'app', json: false, id: 'r1', note: 'ok' });
  assert.deepEqual(parseShipArgs(['policy', 'app', 'approve_risky']), { action: 'policy', project: 'app', json: false, mode: 'approve_risky' });
  assert.match(String(parseShipArgs(['policy', 'app', 'sometimes'])), /Choose one of/);
  assert.match(String(parseShipArgs(['deny', 'app'])), /Which request/);
  assert.match(String(parseShipArgs([])), /project name required/);
});

test('each ship command calls the route the dashboard uses, and prints the plain sentence', async () => {
  const seen: string[] = []; const bodies: any[] = [];
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      seen.push(`${req.method} ${req.url}`); if (b) bodies.push(JSON.parse(b));
      const send = (o: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url!.endsWith('/deploy-requests')) return send({ requests: [{ id: 'r1', version: 5, status: 'pending', expires_at: '2026-10-25T00:00:00Z', summary: 'Version 5 adds Google Sheets', mine: true }] });
      if (req.url!.endsWith('/deploy-policy') && req.method === 'GET') return send({ mode: 'approve_all', options: [{ id: 'approve_all', label: 'Editors deploy, an admin approves' }], can_change: false });
      send({ message: 'Done.' });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`; const lines: string[] = []; const out = (s: string) => lines.push(s);
  try {
    await handleShip(['app'], url, out);
    await handleShip(['policy', 'app'], url, out);
    await handleShip(['policy', 'app', 'direct'], url, out);
    await handleShip(['approve', 'app', 'r1', '--note', 'fine'], url, out);
    await handleShip(['deny', 'app', 'r1'], url, out);
    await handleShip(['withdraw', 'app', 'r1'], url, out);
  } finally { server.close(); }
  assert.deepEqual(seen, ['GET /v1/projects/app/deploy-requests', 'GET /v1/projects/app/deploy-policy', 'PUT /v1/projects/app/deploy-policy', 'POST /v1/projects/app/deploy-requests/r1/decision', 'POST /v1/projects/app/deploy-requests/r1/decision', 'POST /v1/projects/app/deploy-requests/r1/withdraw']);
  assert.deepEqual(bodies, [{ mode: 'direct' }, { decision: 'approve', note: 'fine' }, { decision: 'deny' }]);
  assert.match(lines[0], /r1  version 5  pending.*Google Sheets.*\(yours\)/); assert.match(lines[1], /Editors deploy.*only an admin can change/);
});
