import { test } from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

test('both bin names point at the same launcher', () => {
  assert.equal(pkg.bin.cohostly, './bin/platform');
  assert.equal(pkg.bin.platform, './bin/platform');
});
