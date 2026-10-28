import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleShare, parseShareArgs } from './commands/share.js';

test('platform share reads its arguments and says what is wrong in words', () => {
  assert.deepEqual(parseShareArgs(['app']), { action: 'list', project: 'app', json: false });
  assert.deepEqual(parseShareArgs(['visibility', 'public', '--project', 'app']), { action: 'visibility', project: 'app', json: false, level: 'public' });
  assert.deepEqual(parseShareArgs(['invite', 'Ana@Example.com', '--project', 'app']), { action: 'invite', project: 'app', json: false, email: 'ana@example.com', role: 'viewer' });
  assert.deepEqual(parseShareArgs(['invite', 'a@b.co', '--role', 'editor', '--project', 'app']), { action: 'invite', project: 'app', json: false, email: 'a@b.co', role: 'editor' });
  assert.deepEqual(parseShareArgs(['role', 'a@b.co', 'admin', '--project', 'app']), { action: 'role', project: 'app', json: false, email: 'a@b.co', role: 'admin' });
  assert.match(String(parseShareArgs(['visibility', 'secret', '--project', 'app'])), /Choose one of/);
  assert.match(String(parseShareArgs(['invite', '--project', 'app'])), /Whom/);
  assert.match(String(parseShareArgs(['invite', 'a@b.co', '--role', 'boss', '--project', 'app'])), /--role must be/);
  assert.match(String(parseShareArgs(['remove', 'a@b.co'])), /project name required/);
});

test('each share command calls the route the dashboard uses', async () => {
  const seen: string[] = []; const bodies: any[] = [];
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      seen.push(`${req.method} ${req.url}`); if (b) bodies.push(JSON.parse(b));
      const send = (o: unknown, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.method === 'GET') return send({ description: 'Only people you invite.', collaborators: [{ id: 'c1', email: 'ana@example.com', role: 'viewer', status: 'active' }] });
      if (req.method === 'PATCH' && req.url === '/v1/projects/app') return send({ visibility: 'public', description: 'Anyone with the link.' });
      if (req.method === 'PATCH') return send({ collaborator: { role: 'editor' } });
      if (req.method === 'POST') return send({ collaborator: { role: 'viewer', status: 'pending' } }, 201);
      send({ removed: 'ana@example.com' });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`; const lines: string[] = [];
  const out = (s: string) => lines.push(s);
  try {
    await handleShare(['--project', 'app'], url, out);
    await handleShare(['visibility', 'public', '--project', 'app'], url, out);
    await handleShare(['invite', 'bo@example.com', '--project', 'app'], url, out);
    await handleShare(['role', 'ana@example.com', 'editor', '--project', 'app'], url, out);
    await handleShare(['remove', 'ana@example.com', '--project', 'app'], url, out);
  } finally { server.close(); }
  assert.deepEqual(seen, ['GET /v1/projects/app/collaborators', 'PATCH /v1/projects/app', 'POST /v1/projects/app/collaborators', 'GET /v1/projects/app/collaborators', 'PATCH /v1/projects/app/collaborators/c1', 'GET /v1/projects/app/collaborators', 'DELETE /v1/projects/app/collaborators/c1']);
  assert.deepEqual(bodies, [{ visibility: 'public' }, { email: 'bo@example.com', role: 'viewer' }, { role: 'editor' }]);
  assert.deepEqual(lines, ['Only people you invite.', '- ana@example.com  viewer', 'app: Anyone with the link.', 'bo@example.com is invited as viewer.', 'ana@example.com is now editor.', 'ana@example.com was removed.']);
});
