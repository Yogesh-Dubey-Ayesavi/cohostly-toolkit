import { test } from 'node:test';
import * as assert from 'node:assert';
import { SETTING_FLAGS, takeSetFlags } from './commands/manifest.js';
import { parseCaptureArgs } from './commands/capture.js';

test('the build-setting flags are shortcuts for --set path=value: the same overrides come out', () => {
  const flags = takeSetFlags(['--language', 'node', '--node-version', '22', '--root', 'app', '--install', 'npm ci', '--build', 'npm run build:prod', '--start', 'node server.js', '--port', '3000', '--package-manager', 'pnpm', '.']);
  const sets = takeSetFlags(['--set', 'runtime.language=node', '--set', 'runtime.version=22', '--set', 'runtime.root=app', '--set', 'runtime.install_command=npm ci', '--set', 'runtime.build=npm run build:prod',
    '--set', 'runtime.entrypoint=node server.js', '--set', 'health.port=3000', '--set', 'runtime.package_manager=pnpm', '.']);
  assert.deepEqual(flags.rest, ['.']);
  // A version stays text ("22"), where --set would read the JSON number 22; the settings file holds it as text.
  assert.deepEqual({ ...flags.overrides, 'runtime.version': '22' }, { ...sets.overrides, 'runtime.version': '22' });
  assert.equal(flags.overrides['runtime.version'], '22'); assert.equal(flags.overrides['health.port'], 3000);
});

test('--python-version and --go-version set runtime.version too; every flag points at a build setting', () => {
  assert.deepEqual(takeSetFlags(['--python-version', '3.12']).overrides, { 'runtime.version': '3.12' });
  assert.deepEqual(takeSetFlags(['--go-version', '1.22']).overrides, { 'runtime.version': '1.22' });
  assert.deepEqual(Object.keys(SETTING_FLAGS).sort(), ['--build', '--go-version', '--install', '--language', '--node-version', '--package-manager', '--port', '--python-version', '--root', '--start']);
});

test('capture accepts the same flags before --, and they win over what was seen', () => {
  const a = parseCaptureArgs(['--build', 'npm run build:prod', '--port', '8080', '--', 'npm', 'start']);
  assert.equal(a.error, undefined); assert.deepEqual(a.argv, ['npm', 'start']); assert.deepEqual(a.overrides, { 'runtime.build': 'npm run build:prod', 'health.port': 8080 });
});
