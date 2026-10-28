import { test } from 'node:test';
import * as assert from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { findManifestFile, isPlatformManifest } from './manifest-file.js';

const ours = '{"runtime":{"language":"node"}}';
const pwa = '{"name":"My app","short_name":"app","start_url":"/","display":"standalone","icons":[]}';
const dir = (files: Record<string, string>) => { const d = mkdtempSync(join(tmpdir(), 'mfile-')); for (const [k, v] of Object.entries(files)) { mkdirSync(dirname(join(d, k)), { recursive: true }); writeFileSync(join(d, k), v); } return d; };
const CASES: [string, Record<string, string>][] = [
  ['cohostly.json only', { 'cohostly.json': ours }],
  ['an empty cohostly.json', { 'cohostly.json': '{}' }],
  ['manifest.json that is ours', { 'manifest.json': ours }],
  ['both, both ours', { 'cohostly.json': '{"health":{"port":1}}', 'manifest.json': ours }],
  ['both, manifest.json is a PWA file', { 'cohostly.json': ours, 'manifest.json': pwa }],
  ['a PWA manifest.json only', { 'manifest.json': pwa }],
  ['a browser extension manifest.json', { 'manifest.json': '{"manifest_version":3,"name":"x","version":"1"}' }],
  ['invalid JSON in manifest.json', { 'manifest.json': 'not json' }],
  ['neither', { 'index.html': '<p>hi</p>' }],
  ['cohostly.json in a subfolder only', { 'sub/cohostly.json': ours }],
];

test('findManifestFile: cohostly.json first, manifest.json only when it is ours, and the same answer as the image-builder copy', async () => {
  const theirsPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'image-builder', 'dist', 'manifest.js');
  const theirs = existsSync(theirsPath) ? await import(theirsPath) : null;
  for (const [name, files] of CASES) {
    const d = dir(files);
    const mine = findManifestFile(d);
    if (theirs) assert.deepEqual(mine, theirs.findManifestFile(d), name);
    for (const f of Object.values(files)) assert.equal(isPlatformManifest(f), theirs ? theirs.isPlatformManifest(f) : isPlatformManifest(f), name);
  }
  const both = findManifestFile(dir({ 'cohostly.json': '{"health":{"port":1}}', 'manifest.json': ours }))!;
  assert.deepEqual([both.file, both.notice], ['cohostly.json', 'Both cohostly.json and manifest.json are here; cohostly.json was used.']);
  assert.equal(findManifestFile(dir({ 'manifest.json': pwa })), null);
  assert.equal(findManifestFile(dir({ 'manifest.json': ours }))!.file, 'manifest.json');
  assert.equal(findManifestFile(dir({ 'cohostly.json': ours, 'manifest.json': pwa }))!.notice, undefined);
});
