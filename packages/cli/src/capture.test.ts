import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOverrides, parseCaptureArgs, settingsRows } from './commands/capture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'index.js');
const FIXTURES = join(HERE, '..', '..', '..', 'tests', 'fixtures', 'capture');
const CANARY = 'canary-cli-capture-5d2e-do-not-leak';
const rp = process.env.COHOSTLY_RAILPACK || process.env.RAILPACK_BIN || spawnSync('which', ['railpack']).stdout.toString().trim();
const skip = rp ? false : 'SKIPPED: railpack is not installed (set RAILPACK_BIN)';

const fixture = (name: string, extra: Record<string, string> = {}) => { const d = mkdtempSync(join(tmpdir(), `clicap-${name}-`)); cpSync(join(FIXTURES, name), d, { recursive: true }); for (const [f, t] of Object.entries(extra)) writeFileSync(join(d, f), t); return d; };

/** A stand-in for the API that records what the CLI posts and answers "live". */
async function fakeApi() {
  const requests: { url: string; body: Buffer }[] = [];
  const s = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      requests.push({ url: req.url ?? '', body: Buffer.concat(chunks) });
      res.setHeader('content-type', 'application/x-ndjson');
      res.end(JSON.stringify({ stage: 'building' }) + '\n' + JSON.stringify({ stage: 'live', project: 'x', version: 1, url: 'https://shop-k3x9q.cohostly.app' }) + '\n');
    });
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(s.address() as { port: number }).port}`, requests, close: () => s.close() };
}

function cli(args: string[], cwd: string, apiUrl: string, env: Record<string, string> = {}): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [CLI, ...args], { cwd, env: { PATH: process.env.PATH, HOME: mkdtempSync(join(tmpdir(), 'clihome-')), TMPDIR: process.env.TMPDIR, API_URL: apiUrl, COHOSTLY_RAILPACK: rp, ...env } as any });
    let out = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
    c.on('close', (code) => resolve({ code, out }));
  });
}

/** The parts of a multipart body by field name; the file part is returned as a Buffer. */
function parts(body: Buffer): Record<string, Buffer> {
  const text = body.toString('latin1'); const boundary = text.slice(0, text.indexOf('\r\n'));
  const out: Record<string, Buffer> = {};
  let at = 0;
  while ((at = text.indexOf(boundary, at)) >= 0) {
    const head = text.indexOf('\r\n\r\n', at); const next = text.indexOf(boundary, head);
    if (head < 0 || next < 0) break;
    const name = /name="([^"]+)"/.exec(text.slice(at, head))?.[1];
    if (name) out[name] = body.subarray(head + 4, next - 2);
    at = next;
  }
  return out;
}

test('parseCaptureArgs: everything after -- is the app command; flags before it are ours; no command gives the usage line', () => {
  const a = parseCaptureArgs(['--project', 'shop', '--timeout', '60', '--save', '--no-deploy', '--allow-local-urls', '--json', '--probe-path', '/health', '--dir', 'app', '--', 'npm', 'start', '--port', '3000']);
  assert.deepEqual(a.argv, ['npm', 'start', '--port', '3000']);
  assert.deepEqual([a.project, a.timeoutSec, a.save, a.noDeploy, a.allowLocalUrls, a.json, a.probePath, a.dir, a.error], ['shop', 60, true, true, true, true, '/health', 'app', undefined]);
  assert.equal(parseCaptureArgs(['--command', 'node server.js | cat']).command, 'node server.js | cat');
  assert.equal(parseCaptureArgs([]).error, 'Tell Cohostly how you start your app, for example: cohostly capture -- npm start');
  assert.equal(parseCaptureArgs(['--']).error, 'Tell Cohostly how you start your app, for example: cohostly capture -- npm start');
  assert.match(parseCaptureArgs(['--bogus', '--', 'x']).error!, /Unknown option/);
  assert.equal(parseCaptureArgs(['--timeout', '9999', '--', 'x']).timeoutSec, 300);
  assert.deepEqual(parseCaptureArgs(['--set', 'runtime.build=npm run build', '--', 'x']).overrides, { 'runtime.build': 'npm run build' });
});

test('settingsRows and applyOverrides: sources are shown, the person\'s flags win, secret values are never in a row', () => {
  const m: any = { name: 'shop', runtime: { language: 'node', version: '22', entrypoint: 'npm start', build: 'npm run build' }, health: { port: 3000 }, env: { secrets: ['STRIPE_KEY'] } };
  const you = applyOverrides(m, { 'runtime.build': 'npm run build:prod' });
  const rows = settingsRows(m, { 'runtime.build': 'railpack', 'runtime.entrypoint': 'capture' }, you);
  const by = Object.fromEntries(rows.map((r) => [r.path, r]));
  assert.deepEqual([by.runtime!.value, by.runtime!.source], ['node 22', 'seen running']);
  assert.deepEqual([by.port!.source, by.build!.value, by.build!.source], ['seen listening', 'npm run build:prod', 'you set it']);
  assert.equal(by.secrets!.value, 'STRIPE_KEY');
});

test('a clean capture deploys: the manifest has names only, the values go in the secrets field, no .env is uploaded, nothing leaks into output or the folder', { skip }, async () => {
  const api = await fakeApi();
  const dir = fixture('node-cjs', { '.env': `API_KEY=${CANARY}\n` });
  try {
    const r = await cli(['capture', '--project', 'shop', '--', 'node', 'server.js'], dir, api.url, { API_KEY: CANARY }); // set here, and also in .env, which must not be uploaded
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Checking your app on this computer/); assert.match(r.out, /runtime\s+node \d+\s+\(seen running\)/); assert.match(r.out, /secrets\s+API_KEY\s+\(values sent privately, never stored in files\)/);
    assert.match(r.out, /Live: https:\/\/shop-k3x9q\.cohostly\.app/);
    assert.ok(!r.out.includes(CANARY), 'output shows the value');
    assert.equal(api.requests.length, 1); assert.equal(api.requests[0]!.url, '/v1/deploy');
    const p = parts(api.requests[0]!.body);
    const manifest = JSON.parse(p.manifest!.toString());
    assert.deepEqual(manifest.env.secrets, ['API_KEY']); assert.equal(manifest.runtime.entrypoint, 'node server.js'); assert.equal(manifest.name, 'shop');
    assert.ok(!p.manifest!.toString().includes(CANARY)); assert.deepEqual(JSON.parse(p.secrets!.toString()), { API_KEY: CANARY });
    const tar = join(mkdtempSync(join(tmpdir(), 'cliup-')), 's.tar.gz'); writeFileSync(tar, p.tarball!);
    const names = execFileSync('tar', ['-tzf', tar]).toString();
    assert.ok(!/(^|\/)\.env/m.test(names), `the upload holds an env file:\n${names}`); assert.match(names, /server\.js/);
    assert.ok(!execFileSync('tar', ['-xzOf', tar]).toString().includes(CANARY), 'the upload holds the value');
    assert.deepEqual(readdirSync(dir).sort().filter((f) => f !== 'pids.txt'), ['.env', 'package.json', 'server.js']); // nothing written into the folder
  } finally { api.close(); }
});

test('a blocking problem prints "Nothing was uploaded." and sends no request', { skip }, async () => {
  const api = await fakeApi();
  try {
    const r = await cli(['capture', '--', 'node', 'server.js'], fixture('node-loopback'), api.url);
    assert.equal(r.code, 1); assert.match(r.out, /binds_loopback/); assert.match(r.out, /Nothing was uploaded\./);
    assert.equal(api.requests.length, 0);
    const local = await cli(['capture', '--', 'node', 'server.js'], fixture('node-local-db'), api.url, { DATABASE_URL: 'postgres://localhost:5432/x' });
    assert.equal(local.code, 1); assert.match(local.out, /local_service\s+DATABASE_URL points at localhost:5432/); assert.equal(api.requests.length, 0);
    const none = await cli(['capture'], fixture('node-cjs'), api.url);
    assert.equal(none.code, 1); assert.match(none.out, /Tell Cohostly how you start your app, for example: cohostly capture -- npm start/);
  } finally { api.close(); }
});

test('--json: one result, with problems and settings and no values', { skip }, async () => {
  const api = await fakeApi();
  try {
    const r = await cli(['capture', '--json', '--', 'node', 'server.js'], fixture('node-cjs'), api.url, { API_KEY: CANARY });
    assert.equal(r.code, 0, r.out);
    const j = JSON.parse(r.out);
    assert.equal(j.ok, true); assert.equal(j.stage, 'live'); assert.equal(j.url, 'https://shop-k3x9q.cohostly.app'); assert.deepEqual(j.problems, []);
    assert.equal(j.settings.secrets.value, 'API_KEY'); assert.ok(!r.out.includes(CANARY));
    const blocked = await cli(['capture', '--json', '--', 'node', 'server.js'], fixture('node-loopback'), api.url);
    const b = JSON.parse(blocked.out);
    assert.equal(blocked.code, 1); assert.equal(b.ok, false); assert.equal(b.stage, 'checks'); assert.equal(b.problems[0].code, 'binds_loopback'); assert.equal(b.problems[0].blocking, true);
  } finally { api.close(); }
});

test('--save writes cohostly.json with names only, and will not overwrite without --force; --no-deploy sends nothing', { skip }, async () => {
  const api = await fakeApi();
  const dir = fixture('node-cjs');
  try {
    const a = await cli(['capture', '--save', '--no-deploy', '--', 'node', 'server.js'], dir, api.url, { API_KEY: CANARY });
    assert.equal(a.code, 0, a.out); assert.equal(api.requests.length, 0);
    const text = readFileSync(join(dir, 'cohostly.json'), 'utf8');
    assert.ok(!text.includes(CANARY)); assert.deepEqual(JSON.parse(text).env.secrets, ['API_KEY']);
    const again = await cli(['capture', '--save', '--no-deploy', '--', 'node', 'server.js'], dir, api.url);
    assert.equal(again.code, 1); assert.match(again.out, /already here/);
    assert.equal((await cli(['capture', '--save', '--force', '--no-deploy', '--', 'node', 'server.js'], dir, api.url)).code, 0);
  } finally { api.close(); }
});

test('--set wins over what was seen and is shown as set by the person', { skip }, async () => {
  const api = await fakeApi();
  try {
    const r = await cli(['capture', '--no-deploy', '--set', 'runtime.build=npm run build', '--', 'node', 'server.js'], fixture('node-cjs'), api.url);
    assert.equal(r.code, 0, r.out); assert.match(r.out, /build\s+npm run build\s+\(you set it\)/);
  } finally { api.close(); }
});
