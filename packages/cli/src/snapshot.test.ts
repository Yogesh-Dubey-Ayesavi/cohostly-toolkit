import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:http';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { inspectSnapshot, parseExpires, sealSnapshot, ustar } from './snapshot/seal.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'index.js');
const FIXTURES = join(HERE, '..', 'test-fixtures');
const CANARY = 'canary-cli-seal-3b8d-do-not-leak';
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const rp = process.env.COHOSTLY_RAILPACK || process.env.RAILPACK_BIN || spawnSync('which', ['railpack']).stdout.toString().trim();
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });

async function api() {
  const seen: { method: string; url: string; body: Buffer }[] = [];
  const s = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen.push({ method: req.method ?? '', url: req.url ?? '', body: Buffer.concat(chunks) });
      if (req.url === '/v1/keys/snapshot') return void res.setHeader('content-type', 'application/json').end(JSON.stringify({ key_id: 'local/test', public_key_pem: publicKey }));
      if (req.url === '/v1/me') return void res.setHeader('content-type', 'application/json').end(JSON.stringify({ id: 'user-1', accounts: [{ id: ACCOUNT }] }));
      res.setHeader('content-type', 'application/x-ndjson'); res.end(JSON.stringify({ stage: 'live', project: 'x', version: 1, url: 'https://sealed.cohostly.app' }) + '\n');
    });
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(s.address() as { port: number }).port}`, seen, close: () => s.close() };
}
const cli = (args: string[], cwd: string, apiUrl: string, env: Record<string, string> = {}) => new Promise<{ code: number | null; out: string }>((resolve) => {
  const c = spawn(process.execPath, [CLI, ...args], { cwd, env: { PATH: process.env.PATH, HOME: mkdtempSync(join(tmpdir(), 'snhome-')), TMPDIR: process.env.TMPDIR, API_URL: apiUrl, COHOSTLY_RAILPACK: rp, ...env } as any });
  let out = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d)); c.on('close', (code) => resolve({ code, out }));
});
const folder = () => { const d = mkdtempSync(join(tmpdir(), 'snapp-')); writeFileSync(join(d, 'server.js'), `// ${CANARY}-code\nrequire("http").createServer((q,r)=>r.end("ok")).listen(0)`); writeFileSync(join(d, 'package.json'), '{"scripts":{"start":"node server.js"}}');
  writeFileSync(join(d, 'cohostly.json'), JSON.stringify({ runtime: { language: 'node', entrypoint: 'node server.js' }, health: { port: 3000 }, env: { secrets: ['STRIPE_KEY', 'MAIL_KEY'] } }));
  writeFileSync(join(d, '.env'), `STRIPE_KEY=${CANARY}\n`); writeFileSync(join(d, '.env.example'), 'STRIPE_KEY=\n'); return d; };

test('--expires takes 1d to 30d and defaults to 7 days', () => {
  assert.equal(parseExpires(undefined), 7 * 86_400_000); assert.equal(parseExpires('3d'), 3 * 86_400_000); assert.equal(parseExpires('30d'), 30 * 86_400_000);
  for (const bad of ['0d', '31d', '7', 'week', '-1d', '1.5d']) assert.throws(() => parseExpires(bad), /1d to 30d/, bad);
});

test('ustar: a plain archive of the given entries, in order, that the system tar reads back', () => {
  const t = ustar([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'b.bin', data: Buffer.alloc(600, 7) }], 1_700_000_000);
  const d = mkdtempSync(join(tmpdir(), 'ustar-')); writeFileSync(join(d, 't.tar'), t);
  const list = spawnSync('tar', ['-tf', join(d, 't.tar')]).stdout.toString().split('\n').filter(Boolean);
  assert.deepEqual(list, ['a.txt', 'b.bin']); assert.equal(t.length % 512, 0);
});

test('cohostly pack seals a folder: no .env in it, the secret only in the sealed part, the settings readable; inspect reads it with no network', async () => {
  const s = await api(); const dir = folder(); const out = join(mkdtempSync(join(tmpdir(), 'snout-')), 'app.cohostly');
  try {
    const p = await cli(['pack', '.', '--out', out, '--env-file', '.env'], dir, s.url);
    assert.equal(p.code, 0, p.out); assert.match(p.out, /Sealed secrets: STRIPE_KEY\./); assert.match(p.out, /Not in \.env, so not in the file: MAIL_KEY/);
    assert.deepEqual(s.seen.map((r) => r.url), ['/v1/keys/snapshot', '/v1/me']);
    const file = readFileSync(out);
    const raw = gunzipSync(file).toString('latin1');
    assert.ok(!raw.includes(CANARY) && !file.toString('latin1').includes(CANARY), 'a value or a line of code is readable in the file');
    const i = inspectSnapshot(file);
    assert.deepEqual([i.hasSecrets, i.secretNames, i.meta.account_id, i.meta.created_by, i.meta.key_id], [true, ['STRIPE_KEY', 'MAIL_KEY'], ACCOUNT, 'user-1', 'local/test']);
    assert.equal(i.settings.runtime.entrypoint, 'node server.js'); assert.ok(Date.parse(i.meta.expires_at) - Date.parse(i.meta.created_at) === 7 * 86_400_000);
    const view = await cli(['inspect', out], dir, 'http://127.0.0.1:1');   // an address nothing listens on: inspect must not need the network
    assert.equal(view.code, 0, view.out); assert.match(view.out, /sealed inside: STRIPE_KEY/); assert.match(view.out, /runtime\.entrypoint\s+node server\.js/); assert.ok(!view.out.includes(CANARY));
  } finally { s.close(); }
});

test('--no-secrets leaves them out; --expires sets the life; a bad value is refused before anything is sealed', async () => {
  const s = await api(); const dir = folder(); const d = mkdtempSync(join(tmpdir(), 'snout-'));
  try {
    const a = await cli(['pack', '.', '--out', join(d, 'a.cohostly'), '--env-file', '.env', '--no-secrets', '--expires', '2d'], dir, s.url); assert.equal(a.code, 0, a.out);
    const i = inspectSnapshot(readFileSync(join(d, 'a.cohostly'))); assert.equal(i.hasSecrets, false); assert.equal(Date.parse(i.meta.expires_at) - Date.parse(i.meta.created_at), 2 * 86_400_000);
    const view = await cli(['inspect', join(d, 'a.cohostly')], dir, s.url); assert.match(view.out, /not included; the settings name STRIPE_KEY, MAIL_KEY/);
    const bad = await cli(['pack', '.', '--out', join(d, 'b.cohostly'), '--expires', '60d'], dir, s.url); assert.equal(bad.code, 1); assert.match(bad.out, /1d to 30d/);
  } finally { s.close(); }
});

test('cohostly deploy app.cohostly sends the file as it is, with a project name from the file name', async () => {
  const s = await api(); const dir = folder(); const out = join(mkdtempSync(join(tmpdir(), 'snout-')), 'My App.cohostly');
  try {
    assert.equal((await cli(['pack', '.', '--out', out], dir, s.url)).code, 0);
    const r = await cli(['deploy', out], dir, s.url); assert.equal(r.code, 0, r.out); assert.match(r.out, /Live: https:\/\/sealed\.cohostly\.app/);
    const post = s.seen.find((x) => x.url === '/v1/deploy')!; assert.ok(post.body.includes(readFileSync(out)), 'the file was not sent whole');
    assert.match(post.body.toString('latin1'), /name="project"\r\n\r\nmy-app\r\n/);
    const named = await cli(['deploy', out, '--project', 'shop'], dir, s.url); assert.equal(named.code, 0, named.out);
    assert.match(s.seen.filter((x) => x.url === '/v1/deploy').at(-1)!.body.toString('latin1'), /name="project"\r\n\r\nshop\r\n/);
  } finally { s.close(); }
});

test('cohostly pack seals a snapshot folder: its settings are readable and its Dockerfile is in the sealed files', async () => {
  const s = await api(); const dir = mkdtempSync(join(tmpdir(), 'snapfolder-')); writeFileSync(join(dir, 'server.js'), 'console.log(1)');
  mkdirSync(join(dir, '.cohostly')); writeFileSync(join(dir, '.cohostly', 'cohostly.json'), JSON.stringify({ name: 'folder-app', runtime: { language: 'dockerfile', entrypoint: 'node server.js' }, health: { port: 3000 }, env: { secrets: ['API_KEY'] } }));
  writeFileSync(join(dir, '.cohostly', 'Dockerfile'), 'FROM node:22-slim\nCOPY . .\n'); writeFileSync(join(dir, '.cohostly', 'env.json'), JSON.stringify({ API_KEY: { value: CANARY, source: 'process' } }));
  const out = join(mkdtempSync(join(tmpdir(), 'snout-')), 'f.cohostly');
  try {
    const r = await cli(['pack', dir, '--out', out], dir, s.url); assert.equal(r.code, 0, r.out); assert.ok(!r.out.includes(CANARY));
    const i = inspectSnapshot(readFileSync(out)); assert.equal(i.settings.name, 'folder-app'); assert.equal(i.settings.runtime.language, 'dockerfile'); assert.equal(i.hasSecrets, true); assert.deepEqual(i.secretNames, ['API_KEY']);
    assert.ok(!gunzipSync(readFileSync(out)).toString('latin1').includes(CANARY));
  } finally { s.close(); }
});

test('the file has exactly the entries of the format, and no secrets.enc when there are none', () => {
  const f = sealSnapshot({ key: { key_id: 'k', public_key_pem: publicKey }, accountId: ACCOUNT, createdBy: 'u', expiresAt: new Date(Date.now() + 1e9), settings: { a: 1 }, source: Buffer.from('x') });
  const d = mkdtempSync(join(tmpdir(), 'snl-')); writeFileSync(join(d, 'f.tgz'), f);
  assert.deepEqual(spawnSync('tar', ['-tzf', join(d, 'f.tgz')]).stdout.toString().split('\n').filter(Boolean), ['snapshot.json', 'cohostly.json', 'source.enc']);
});
