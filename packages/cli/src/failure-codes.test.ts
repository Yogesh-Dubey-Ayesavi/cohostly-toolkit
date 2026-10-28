import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'index.js');
const FIXTURES = join(HERE, '..', 'test-fixtures');

/** A stand-in API whose deploy always ends the way the test says. */
async function api(last: object, status = 200) {
  const s = createServer((req, res) => {
    req.resume();
    req.on('end', () => { res.setHeader('content-type', 'application/x-ndjson'); res.end(JSON.stringify({ stage: 'building' }) + '\n' + JSON.stringify({ stage: 'failed', status, ...last }) + '\n'); });
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(s.address() as { port: number }).port}`, close: () => s.close() };
}
const run = (args: string[], cwd: string, apiUrl: string) => new Promise<{ code: number | null; out: string }>((resolve) => {
  const c = spawn(process.execPath, [CLI, ...args], { cwd, env: { PATH: process.env.PATH, HOME: mkdtempSync(join(tmpdir(), 'fchome-')), API_URL: apiUrl } as any });
  let out = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d)); c.on('close', (code) => resolve({ code, out }));
});
const app = () => { const d = mkdtempSync(join(tmpdir(), 'fcapp-')); cpSync(join(FIXTURES, 'node-cjs'), d, { recursive: true }); return d; };

test('platform deploy: a failed deploy prints its code with the cause and the fix', async () => {
  const s = await api({ error: 'Deployment failed', code: 'build_failed_dependency', error_code: 'missing_dependency', failed_stage: 'building', cause: 'The app imports "flask", but it is not installed in the build.', fix: 'Add "flask" to requirements.txt and deploy again.' }, 422);
  try {
    const r = await run(['deploy', '--yes', '--skip-types-check', '.'], app(), s.url);
    assert.equal(r.code, 1); assert.match(r.out, /Deployment failed while building\./); assert.match(r.out, /Code:\s+build_failed_dependency/);
    assert.match(r.out, /What went wrong: The app imports "flask"/); assert.match(r.out, /What to do:\s+Add "flask"/);
  } finally { s.close(); }
});

test('platform deploy: a reply with no code prints no Code line', async () => {
  const s = await api({ error: 'Deployment failed', details: 'Something odd happened.' }, 500);
  try { const r = await run(['deploy', '--yes', '--skip-types-check', '.'], app(), s.url); assert.equal(r.code, 1); assert.doesNotMatch(r.out, /Code:/); assert.match(r.out, /Something odd happened/); } finally { s.close(); }
});
