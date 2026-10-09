import { test } from 'node:test';
import * as assert from 'node:assert';
import { mergeEnv, parseDevArgs, parseDotenv } from './commands/dev.js';

test('parseDevArgs splits platform options from the command after --', () => {
  assert.deepEqual(parseDevArgs(['--project', 'shop', '--no-secrets', '--', 'npm', 'start', '--port', '3000']), { project: 'shop', noSecrets: true, command: ['npm', 'start', '--port', '3000'] });
  assert.deepEqual(parseDevArgs(['--project', 'shop']), { project: 'shop', noSecrets: false, command: [] });
  assert.equal(parseDevArgs(['--project', 'a', '--env-file', 'x.env', '--', 'ls']).envFile, 'x.env');
});

test('parseDotenv reads quotes and export, and ignores comments and junk', () => {
  assert.deepEqual(parseDotenv('# c\nA=1\nexport B="two words"\nC=\'x\'\nnot a line\n  D = spaced \n'), { A: '1', B: 'two words', C: 'x', D: 'spaced' });
});

test('the platform\'s own variables always win, and a developer\'s own value beats the platform\'s secret', () => {
  const m = mergeEnv({ PATH: '/bin', STRIPE_KEY: 'sk_test_mine', PLATFORM_TOKEN: 'old-token' }, { PLATFORM_TOKEN: 'fresh', DATA_URL: 'https://b/data' }, { STRIPE_KEY: 'sk_live_platform', MAIL_KEY: 'm-platform', FROM_FILE: 'platform' }, { FROM_FILE: 'local-file', ONLY_LOCAL: 'yes' });
  assert.equal(m.env.PLATFORM_TOKEN, 'fresh'); assert.equal(m.env.DATA_URL, 'https://b/data');
  assert.equal(m.env.STRIPE_KEY, 'sk_test_mine', 'the environment beats the platform'); assert.equal(m.env.FROM_FILE, 'local-file', 'the local file beats the platform');
  assert.equal(m.env.MAIL_KEY, 'm-platform'); assert.equal(m.env.ONLY_LOCAL, 'yes'); assert.equal(m.env.PATH, '/bin');
  assert.deepEqual(m.loaded, ['MAIL_KEY']); assert.deepEqual(m.replaced.sort(), ['FROM_FILE', 'STRIPE_KEY']);
});

test('the real environment object is not changed', () => {
  const base = { A: '1' }; mergeEnv(base, { B: '2' }, { C: '3' }); assert.deepEqual(base, { A: '1' });
});
