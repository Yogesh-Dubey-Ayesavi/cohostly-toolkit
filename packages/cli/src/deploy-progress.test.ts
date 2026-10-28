import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeployProgress, type Out } from './deploy-progress.js';

const label = (s: string) => ({ building: '[2/4] Building', starting: '[3/4] Starting' } as Record<string, string>)[s] ?? s;
const sink = (tty: boolean): Out & { text: () => string } => { let t = ''; return { write: (s) => { t += s; }, isTTY: tty, columns: 80, text: () => t }; };

test('a build prints one line per stage and no log lines by default on a pipe', () => {
  const out = sink(false); let now = 0;
  const p = new DeployProgress(label, { verbose: false, out, now: () => now });
  p.event({ stage: 'building', message: 'Building your app.' });
  p.event({ stage: 'building', log: 'Step 4/9 : RUN npm install' });
  p.event({ stage: 'starting', message: 'Build finished.' });
  p.done();
  assert.equal(out.text(), '[2/4] Building  Building your app.\n[3/4] Starting  Build finished.\n');
});

test('--verbose prints every build line', () => {
  const out = sink(false);
  const p = new DeployProgress(label, { verbose: true, out });
  p.event({ stage: 'building', message: 'Building your app.' });
  p.event({ stage: 'building', log: 'Step 4/9 : RUN npm install' });
  p.event({ stage: 'building', log: 'added 812 packages' });
  p.done();
  assert.match(out.text(), /    Step 4\/9 : RUN npm install\n    added 812 packages\n/);
});

test('on a terminal the newest build line and the time spent show on one status line that is cleared before the next stage', () => {
  const out = sink(true); let now = 0;
  const p = new DeployProgress(label, { verbose: false, out, now: () => now });
  p.event({ stage: 'building', message: 'Building your app.' });
  now = 42_000;
  p.event({ stage: 'building', log: 'Creating an optimized production build' });
  assert.match(out.text(), /\x1b\[K    42s  Creating an optimized production build$/);
  p.event({ stage: 'starting', message: 'Build finished.' });
  p.done();
  assert.match(out.text(), /\x1b\[K\[3\/4\] Starting {2}Build finished\.\n$/);
});

test('a long build line is cut to the terminal width', () => {
  const out = sink(true);
  const p = new DeployProgress(label, { verbose: false, out });
  p.event({ stage: 'building', message: 'Building your app.' });
  p.event({ stage: 'building', log: 'x'.repeat(500) });
  p.done();
  const drawn = out.text().split('\r\x1b[K').filter((s) => s.includes('xxx')).pop()!;
  assert.ok(drawn.length <= 80, `${drawn.length} columns`);
});
