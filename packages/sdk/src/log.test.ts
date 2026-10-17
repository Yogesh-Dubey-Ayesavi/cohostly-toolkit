import { test } from 'node:test';
import * as assert from 'node:assert';
import { logger, requestId } from './log.js';

test('a request id from the platform tags every line, including each line of a multi-line message', () => {
  const out: string[] = [], err: string[] = [];
  const log = logger(new Headers({ 'X-Platform-Request-Id': '01JC8Q4Z7M2V9K5X3N6T1H8B0D' }), (l) => out.push(l), (l) => err.push(l));
  log.info('charged', { cents: 500 }); log.error(new Error('card declined').message + '\nsecond line');
  assert.deepEqual(out, ['[req:01JC8Q4Z7M2V9K5X3N6T1H8B0D] charged {"cents":500}']);
  assert.deepEqual(err, ['[req:01JC8Q4Z7M2V9K5X3N6T1H8B0D] card declined\n[req:01JC8Q4Z7M2V9K5X3N6T1H8B0D] second line']);
  assert.equal(log.id, '01JC8Q4Z7M2V9K5X3N6T1H8B0D');
});

test('without an id, or with a malformed one, lines are written as they are, so nothing a caller sends can inject a tag', () => {
  const out: string[] = [];
  logger({}, (l) => out.push(l)).info('plain');
  logger({ 'x-platform-request-id': '] [req:forged' }, (l) => out.push(l)).info('still plain');
  assert.deepEqual(out, ['plain', 'still plain']);
  assert.equal(requestId({ headers: { 'x-platform-request-id': 'abc-123' } }), 'abc-123'); assert.equal(requestId(undefined), undefined);
});

test('errors print their stack, and objects that cannot be turned into text do not throw', () => {
  const out: string[] = [], cyc: any = {}; cyc.me = cyc;
  const log = logger({ 'x-platform-request-id': 'r1' }, (l) => out.push(l), (l) => out.push(l));
  log.error(new Error('boom')); log.info(cyc);
  assert.match(out[0], /^\[req:r1\] Error: boom\n\[req:r1\]\s+at /); assert.match(out[1], /^\[req:r1\] \[object Object\]$/);
});
