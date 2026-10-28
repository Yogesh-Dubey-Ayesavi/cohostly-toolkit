import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleDomains, parseDomainsArgs, formatDomain } from './commands/domains.js';

test('platform domains reads its arguments and says what is wrong in words', () => {
  assert.deepEqual(parseDomainsArgs(['--project', 'app']), { action: 'list', project: 'app', json: false });
  assert.deepEqual(parseDomainsArgs(['app']), { action: 'list', project: 'app', json: false });
  assert.deepEqual(parseDomainsArgs(['add', 'App.Example.com', '--project', 'app']), { action: 'add', project: 'app', hostname: 'app.example.com', json: false });
  assert.deepEqual(parseDomainsArgs(['remove', 'a.example.com', '--project', 'app', '--json']), { action: 'remove', project: 'app', hostname: 'a.example.com', json: true });
  assert.match(String(parseDomainsArgs(['add', '--project', 'app'])), /Which domain/);
  assert.match(String(parseDomainsArgs(['add', 'a.com'])), /project name required/);
  assert.match(String(parseDomainsArgs(['--bogus'])), /do not know/);
  assert.match(String(parseDomainsArgs(['list', 'x.com', '--project', 'app'])), /Too many words/);
});

test('a domain prints its state in words and any problem', () => {
  assert.deepEqual(formatDomain({ hostname: 'a.example.com', status: 'active' }), ['a.example.com  live over HTTPS']);
  const l = formatDomain({ hostname: 'a.example.com', status: 'pending', error: 'We cannot see the TXT record yet.', last_checked: '2026-10-20T12:00:30.000Z' });
  assert.equal(l[0], 'a.example.com  waiting for your DNS records'); assert.equal(l[1], '  We cannot see the TXT record yet.'); assert.match(l[2], /Last checked 2026-10-20 12:00 UTC/);
});

test('add, show and remove call the API routes the dashboard uses, finding the domain by its name', async () => {
  const seen: string[] = []; let posted: any;
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      seen.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json');
      if (req.method === 'POST') { posted = JSON.parse(body); res.statusCode = 201; return res.end(JSON.stringify({ domain: { id: 'd1', hostname: 'a.example.com', status: 'pending' }, instructions: { summary: 'Add these records.', steps: [{ type: 'CNAME', name: 'a.example.com', value: 'fallback.cohostly.cloud', what: 'Send traffic here' }], notes: ['DNS can take an hour.'] } })); }
      if (req.url === '/v1/projects/app/domains') return res.end(JSON.stringify({ domains: [{ id: 'd1', hostname: 'a.example.com', status: 'pending' }] }));
      if (req.url === '/v1/projects/app/domains/d1' && req.method === 'GET') return res.end(JSON.stringify({ domain: { id: 'd1', hostname: 'a.example.com', status: 'active' } }));
      if (req.url === '/v1/projects/app/domains/d1' && req.method === 'DELETE') return res.end(JSON.stringify({ removed: true, message: 'Removed.' }));
      res.statusCode = 404; res.end(JSON.stringify({ error: 'nope' }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const api = `http://127.0.0.1:${(server.address() as any).port}`; const out: string[] = [];
  const put = (s: string) => out.push(s);
  await handleDomains(['add', 'a.example.com', '--project', 'app'], api, put);
  await handleDomains(['show', 'a.example.com', '--project', 'app'], api, put);
  await handleDomains(['remove', 'a.example.com', '--project', 'app'], api, put);
  assert.deepEqual(posted, { hostname: 'a.example.com' });
  assert.deepEqual(seen, ['POST /v1/projects/app/domains', 'GET /v1/projects/app/domains', 'GET /v1/projects/app/domains/d1', 'GET /v1/projects/app/domains', 'DELETE /v1/projects/app/domains/d1']);
  const t = out.join('\n'); assert.match(t, /CNAME {2}a\.example\.com {2}-> {2}fallback\.cohostly\.cloud/); assert.match(t, /live over HTTPS/); assert.match(t, /Removed\./);
  server.close();
});

test('adding a name someone else holds without proof prints the TXT record to take it over, not an error', async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json'); res.statusCode = 202;
    res.end(JSON.stringify({ message: 'That domain is already claimed by someone who has not proved they own it.', challenge: { hostname: 'a.example.com', expires_at: '2026-10-27T12:00:00Z', record: { type: 'TXT', name: '_cohostly-challenge.a.example.com', value: 'cohostly-verify=abc' } } }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const out: string[] = [];
  await handleDomains(['add', 'a.example.com', '--project', 'app'], `http://127.0.0.1:${(server.address() as any).port}`, (s) => out.push(s));
  const t = out.join('\n'); assert.match(t, /not proved they own it/); assert.match(t, /TXT {2}_cohostly-challenge\.a\.example\.com {2}-> {2}cohostly-verify=abc/);
  server.close();
});
