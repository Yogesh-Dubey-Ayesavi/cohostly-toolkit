import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleSchedules, parseSchedulesArgs, formatSchedule, formatRun } from './commands/schedules.js';

test('platform schedules and platform run read their arguments and say what is wrong in words', () => {
  assert.deepEqual(parseSchedulesArgs(['--project', 'app']), { action: 'list', project: 'app', json: false });
  assert.deepEqual(parseSchedulesArgs(['app']), { action: 'list', project: 'app', json: false });
  assert.deepEqual(parseSchedulesArgs(['pause', 'daily', '--project', 'app']), { action: 'pause', project: 'app', name: 'daily', json: false });
  assert.deepEqual(parseSchedulesArgs(['runs', '--project', 'app', '--json']), { action: 'runs', project: 'app', json: true });
  assert.deepEqual(parseSchedulesArgs(['daily', '--project', 'app'], 'run'), { action: 'run', project: 'app', name: 'daily', json: false });
  assert.match(String(parseSchedulesArgs([], 'run')), /Which schedule/);
  assert.match(String(parseSchedulesArgs(['daily'], 'run')), /project name required/);
  assert.match(String(parseSchedulesArgs(['pause', '--project', 'app'])), /Which schedule/);
  assert.match(String(parseSchedulesArgs(['--bogus'])), /do not know/);
  assert.match(String(parseSchedulesArgs([])), /project name required/);
});

test('a schedule prints in plain English with its state, last result and next times', () => {
  const s = { name: 'daily', plain: 'Every weekday at 9:00 AM, India time', enabled: false, disabled_reason: 'failed 10 times in a row', defined_in: 'Defined in the manifest (version 3)', last_run: { status: 'failed', exit_code: 1, scheduled_for: '2026-10-20T03:30:00.000Z' }, next_runs: ['2026-10-21T03:30:00.000Z'] };
  const l = formatSchedule(s);
  assert.equal(l[0], 'daily  Every weekday at 9:00 AM, India time  [PAUSED: failed 10 times in a row]');
  assert.match(l[1], /Last: failed \(exit 1\) at 2026-10-20 03:30 UTC/); assert.match(l[2], /Next: 2026-10-21 03:30 UTC/);
  assert.match(formatRun({ scheduled_for: '2026-10-20T03:30:00.000Z', status: 'timed_out', schedule: 'daily', attempt: 3, max_attempts: 3, duration_ms: 600000, error: 'it did not finish in time' }), /timed_out +daily +try 3\/3 +600 s +- it did not finish in time/);
});

test('list, run, pause and timers call the API routes the dashboard uses', async () => {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/projects/app/schedules') return res.end(JSON.stringify({ schedules: [{ name: 'daily', plain: 'Every day at 8:00 AM, UTC', enabled: true, defined_in: 'Defined in code (version 2)', last_run: null, next_runs: [] }] }));
    if (req.url === '/v1/projects/app/schedules/daily/run') return res.end(JSON.stringify({ run: { id: 'r1' }, message: 'Started.' }));
    if (req.url === '/v1/projects/app/schedules/daily/pause') return res.end(JSON.stringify({ message: 'Paused.' }));
    if (req.url === '/v1/projects/app/timers') return res.end(JSON.stringify({ timers: [{ id: 't1', name: 'remind', run_at: '2026-11-01T09:00:00.000Z' }] }));
    res.statusCode = 404; res.end(JSON.stringify({ error: 'There is no schedule called "ghost" in the live version of app.' }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const api = `http://127.0.0.1:${(server.address() as any).port}`; const out: string[] = [];
  await handleSchedules(['--project', 'app'], api, 'schedules', (s) => out.push(s));
  await handleSchedules(['daily', '--project', 'app'], api, 'run', (s) => out.push(s));
  await handleSchedules(['pause', 'daily', '--project', 'app'], api, 'schedules', (s) => out.push(s));
  await handleSchedules(['timers', '--project', 'app'], api, 'schedules', (s) => out.push(s));
  assert.deepEqual(seen, ['GET /v1/projects/app/schedules', 'POST /v1/projects/app/schedules/daily/run', 'POST /v1/projects/app/schedules/daily/pause', 'GET /v1/projects/app/timers']);
  assert.match(out.join('\n'), /daily {2}Every day at 8:00 AM, UTC/); assert.match(out.join('\n'), /Started\. \(run r1\)/); assert.match(out.join('\n'), /t1 {2}remind {2}2026-11-01 09:00 UTC/);
  server.close();
});
