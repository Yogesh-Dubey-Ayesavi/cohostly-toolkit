import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleLogs, parseLogsArgs, formatLine } from './commands/logs.js';

test('platform logs reads its arguments and says what is wrong in plain words', () => {
  assert.deepEqual(parseLogsArgs(['app', '-f', '--version', '3', '--lines', '20']), { project: 'app', follow: true, json: false, version: 3, lines: 20 });
  assert.match(String(parseLogsArgs([])), /project name required/);
  assert.match(String(parseLogsArgs(['app', '--version', 'x'])), /--version needs a version number/);
  assert.match(String(parseLogsArgs(['app', '--lines', '5000'])), /1 to 1000/);
  assert.match(String(parseLogsArgs(['app', '--bogus'])), /do not know/);
});

test('a line prints its time, marks errors and platform notes, and shows the request id', () => {
  const l = { id: 1, at: '2026-10-14T12:34:56.789Z', stream: 'stdout', version: 1, text: 'hi', request_id: null };
  assert.equal(formatLine(l), '12:34:56.789   hi');
  assert.equal(formatLine({ ...l, stream: 'stderr', request_id: 'r1' }), '12:34:56.789 ! [r1] hi');
  assert.equal(formatLine({ ...l, stream: 'platform', text: '3 lines dropped' }), '12:34:56.789 # 3 lines dropped');
});

test('without -f it prints what is there once; with -f it prints each event as it arrives', async () => {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url!);
    if (req.url!.includes('follow=true')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(': following\n\n'); res.write(`id: 1\nevent: log\ndata: ${JSON.stringify({ id: 1, at: '2026-10-14T00:00:00.000Z', stream: 'stdout', text: 'one', request_id: null })}\n\n`);
      setTimeout(() => { res.write(`id: 2\nevent: log\ndata: ${JSON.stringify({ id: 2, at: '2026-10-14T00:00:01.000Z', stream: 'stdout', text: 'two', request_id: null })}\n\n`); res.end(); }, 50);
    } else { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ lines: [{ id: 5, at: '2026-10-14T00:00:00.000Z', stream: 'stdout', text: 'past', request_id: null }] })); }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const once: string[] = []; await handleLogs(['app', '--version', '2'], base, (s) => once.push(s));
  assert.deepEqual(once, ['00:00:00.000   past']); assert.equal(seen[0], '/v1/projects/app/logs?version=2');
  const live: string[] = []; await handleLogs(['app', '-f'], base, (s) => live.push(s));
  assert.deepEqual(live, ['00:00:00.000   one', '00:00:01.000   two']);
  const json: string[] = []; await handleLogs(['app', '--json'], base, (s) => json.push(s)); assert.equal(JSON.parse(json[0]).text, 'past');
  server.closeAllConnections(); server.close();
});

test('an empty log asks the sandbox why and prints the reason and what the app itself last printed, instead of a blank screen', async () => {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url!); res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url!.includes('/diagnose') ? { reason: 'The app\'s helper could not send its logs: curl is not installed in this image', app_output_tail: ['listening on 8080', 'GET /'] } : { lines: [] }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const out: string[] = []; await handleLogs(['app'], `http://127.0.0.1:${(server.address() as any).port}`, (s) => out.push(s));
  assert.deepEqual(out, ['(no log lines yet) The app\'s helper could not send its logs: curl is not installed in this image', '  | listening on 8080', '  | GET /']);
  assert.deepEqual(seen, ['/v1/projects/app/logs', '/v1/projects/app/logs/diagnose']);
  server.closeAllConnections(); server.close();
});

test('if the diagnosis is not available, an empty log still says how to get lines', async () => {
  const server = http.createServer((req, res) => { if (req.url!.includes('/diagnose')) { res.statusCode = 501; return res.end('{}'); } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ lines: [] })); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const out: string[] = []; await handleLogs(['app'], `http://127.0.0.1:${(server.address() as any).port}`, (s) => out.push(s));
  assert.match(out[0], /no log lines yet\) If the app should be running, open it once/); server.closeAllConnections(); server.close();
});
