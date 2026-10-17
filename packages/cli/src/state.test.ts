import { test } from 'node:test';
import * as assert from 'node:assert';
import { projectLine, stateDetail } from './commands/state.js';

const crashed = { name: 'shop', current_version: 2, visibility: 'public', role: 'admin', url: 'https://shop.apps.test', state: { state: 'crashed', label: 'Crashed', reason: 'The tool stopped running. It ran out of memory.', next_action: { label: 'Restart' }, badges: [{ label: '1 approval waiting' }] } };

test('platform ls shows the state label and badges beside the name', () => {
  assert.equal(projectLine(crashed), '- shop  CRASHED [1 approval waiting]  (v2, public, you are admin, https://shop.apps.test)');
});
test('a project that needs something gets its reason and next step; calm states get nothing', () => {
  assert.deepEqual(stateDetail(crashed), ['    The tool stopped running. It ran out of memory.', '    Next: Restart']);
  assert.deepEqual(stateDetail({ ...crashed, state: { state: 'live', label: 'Live', reason: 'Healthy.' } }), []);
});
test('an older API with no state still prints', () => {
  assert.equal(projectLine({ name: 'a', visibility: 'private' }), '- a  (vnone, private)');
});
