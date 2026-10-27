import { test } from 'node:test';
import * as assert from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { parseEnvFile, readEnvFiles, envForDeploy, ENV_FILES } from './env-files.js';
import { packFolder } from './commands/deploy.js';

const CANARY = 'canary-cli-91b7-do-not-leak';
const dir = (files: Record<string, string>) => { const d = mkdtempSync(join(tmpdir(), 'clienv-')); for (const [k, v] of Object.entries(files)) { mkdirSync(dirname(join(d, k)), { recursive: true }); writeFileSync(join(d, k), v); } return d; };
const listing = (b: Buffer) => execFileSync('tar', ['-tzf', '-'], { input: b }).toString().split('\n').map((l) => l.replace(/^\.\//, '')).filter(Boolean).sort();

// The same cases as the API's env-detect tests: the CLI and the server must read a file the same way.
test('parseEnvFile: comments, export, quotes, escapes, inline comments, multi-line values, Windows line endings', () => {
  assert.deepEqual(parseEnvFile(['# comment', 'A=1', 'export B="two words"', "C='single $x \\n'", 'D=plain # trailing', 'E="line\\nbreak"', 'F="multi', 'line"', 'G= spaced ', 'bad line', '=nokey', 'H="a#b"'].join('\n')),
    { A: '1', B: 'two words', C: 'single $x \\n', D: 'plain', E: 'line\nbreak', F: 'multi\nline', G: 'spaced', H: 'a#b' });
  assert.deepEqual(parseEnvFile('A=1\r\nB="2"\r\n'), { A: '1', B: '2' });
});

test('readEnvFiles: the four env files at the root, the later one wins, templates and other files are not read, links are not followed', () => {
  assert.deepEqual([...ENV_FILES], ['.env', '.env.local', '.env.production', '.env.production.local']);
  const d = dir({ '.env': 'A_KEY=base\nB_KEY=base\n', '.env.local': 'A_KEY=local\n', '.env.production': 'A_KEY=prod\n', '.env.production.local': 'B_KEY=prodlocal\n', '.env.example': 'EX_KEY=1', '.env.development': 'DEV_KEY=1', 'sub/.env': 'SUB_KEY=1' });
  const r = readEnvFiles(d);
  assert.deepEqual(r.values, { A_KEY: 'prod', B_KEY: 'prodlocal' }); assert.deepEqual(r.files, ['.env', '.env.local', '.env.production', '.env.production.local']);
  const l = dir({ 'real.txt': 'LINKED=1' }); symlinkSync(join(l, 'real.txt'), join(l, '.env'));
  assert.deepEqual(readEnvFiles(l).values, {});
});

test('packFolder leaves the env files out of the archive, even with a canary in them; templates, subfolders and code stay', () => {
  const d = dir({ 'server.js': 'x', '.env': `STRIPE_KEY=${CANARY}`, '.env.local': `X_KEY=${CANARY}`, '.env.production': 'P_KEY=1', '.env.production.local': 'Q_KEY=1', '.env.example': 'STRIPE_KEY=', 'sub/.env': 'SUB=1', 'node_modules/x/index.js': 'x' });
  const archive = packFolder(d);
  assert.deepEqual(listing(archive).filter((n) => !n.endsWith('/')), ['.env.example', 'server.js', 'sub/.env']);
  assert.ok(!gunzipSync(archive).toString('latin1').includes(CANARY));
});

test('envForDeploy: values go in secrets, names are listed, values never appear in what is printed', () => {
  const d = dir({ '.env': `STRIPE_KEY=${CANARY}\nNEXT_PUBLIC_API_URL=https://api.example.com\nPORT=3000\nNODE_ENV=production\nEMPTY=\n` });
  const e = envForDeploy(d, false);
  assert.deepEqual(JSON.parse(e.secrets!), { STRIPE_KEY: CANARY, NEXT_PUBLIC_API_URL: 'https://api.example.com' });
  assert.deepEqual(e.names, ['NEXT_PUBLIC_API_URL', 'STRIPE_KEY']);
  assert.ok(!e.message.includes(CANARY)); assert.match(e.message, /Found 2 values in your \.env files/); assert.match(e.message, /STRIPE_KEY/);
});

test('envForDeploy with --no-env-file sends nothing and says the files were left out', () => {
  const d = dir({ '.env': `STRIPE_KEY=${CANARY}` });
  const e = envForDeploy(d, true);
  assert.equal(e.secrets, undefined); assert.deepEqual(e.names, []); assert.match(e.message, /left out/); assert.ok(!e.message.includes(CANARY));
  assert.equal(envForDeploy(dir({ 'a.js': 'x' }), false).message, ''); assert.equal(envForDeploy(dir({ 'a.js': 'x' }), true).message, '');
});

test('more than 100 usable values is an error that names the limit', () => {
  const d = dir({ '.env': Array.from({ length: 101 }, (_, i) => `NAME_${String(i).padStart(3, '0')}=1`).join('\n') });
  assert.throws(() => envForDeploy(d, false), /at most 100/);
});
