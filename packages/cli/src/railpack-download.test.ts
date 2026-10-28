import { test } from 'node:test';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ensureRailpack, RAILPACK } from './tools.js';

// A tiny script standing in for the binary: it prints the pinned version.
function archive(version = RAILPACK.version) {
  const d = mkdtempSync(join(tmpdir(), 'cltools-src-'));
  writeFileSync(join(d, 'railpack'), `#!/bin/sh\necho "railpack version ${version}"\n`); chmodSync(join(d, 'railpack'), 0o755);
  execFileSync('tar', ['-czf', join(d, 'a.tar.gz'), '-C', d, 'railpack']);
  return execFileSync('cat', [join(d, 'a.tar.gz')]);
}

async function serve(body: Buffer) {
  let hits = 0;
  const s = createServer((_, res) => { hits++; res.end(body); });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const port = (s.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/r.tar.gz`, hits: () => hits, close: () => s.close() };
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const opts = (url: string, sha256: string, toolsDir: string, extra = {}) => ({
  table: { version: RAILPACK.version, assets: { 'linux-x64': { url, sha256 } } }, platform: 'linux', arch: 'x64', toolsDir, env: {}, log: () => {}, ...extra,
});

test('ensureRailpack: the right checksum installs, a second call does not download again', async () => {
  const body = archive(); const srv = await serve(body); const dir = mkdtempSync(join(tmpdir(), 'cltools-'));
  try {
    const p = await ensureRailpack(opts(srv.url, sha(body), dir));
    assert.equal(p, join(dir, `railpack-${RAILPACK.version}`, 'railpack'));
    assert.match(execFileSync(p).toString(), new RegExp(RAILPACK.version));
    assert.equal(await ensureRailpack(opts(srv.url, sha(body), dir)), p);
    assert.equal(srv.hits(), 1);
  } finally { srv.close(); }
});

test('ensureRailpack: a wrong checksum installs nothing', async () => {
  const srv = await serve(archive()); const dir = mkdtempSync(join(tmpdir(), 'cltools-'));
  try {
    await assert.rejects(ensureRailpack(opts(srv.url, 'a'.repeat(64), dir)), /did not match its checksum\. Nothing was run\./);
    assert.equal(existsSync(join(dir, `railpack-${RAILPACK.version}`)), false);
  } finally { srv.close(); }
});

test('ensureRailpack: COHOSTLY_RAILPACK wins when it prints the pinned version, and is refused otherwise', async () => {
  const good = mkdtempSync(join(tmpdir(), 'cltools-own-')); writeFileSync(join(good, 'rp'), `#!/bin/sh\necho "railpack version ${RAILPACK.version}"\n`); chmodSync(join(good, 'rp'), 0o755);
  const lines: string[] = [];
  const dir = mkdtempSync(join(tmpdir(), 'cltools-'));
  assert.equal(await ensureRailpack(opts('http://127.0.0.1:1/never', 'x', dir, { env: { COHOSTLY_RAILPACK: join(good, 'rp') }, log: (l: string) => lines.push(l) })), join(good, 'rp'));
  assert.deepEqual(lines, ['using your own Railpack build']);
  const bad = mkdtempSync(join(tmpdir(), 'cltools-own-')); writeFileSync(join(bad, 'rp'), '#!/bin/sh\necho "railpack version 0.1.0"\n'); chmodSync(join(bad, 'rp'), 0o755);
  await assert.rejects(ensureRailpack(opts('http://127.0.0.1:1/never', 'x', dir, { env: { COHOSTLY_RAILPACK: join(bad, 'rp') } })), /must print version/);
});

test('ensureRailpack: Windows stops with the WSL2 message; the pinned table has all four assets', async () => {
  await assert.rejects(ensureRailpack({ platform: 'win32', env: {} }), /On Windows, use WSL2\./);
  assert.deepEqual(Object.keys(RAILPACK.assets).sort(), ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64']);
  for (const a of Object.values(RAILPACK.assets)) assert.match(a.sha256, /^[0-9a-f]{64}$/);
});
