import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleCost } from './commands/cost.js';

const body = { estimate: true, sentences: ['This month so far: about $2 (AI $1.5, hosting 50 cents). This is an estimate.', 'Assumptions: AI cost is what the model providers charged; prices change, so these figures are estimates.'], ai_budget: { cap_usd: 2, spent_usd: 1.7, percent: 85, state: 'warning', how_to_raise: 'Set bindings.ai.monthly_cap_usd.' }, notices: [{ severity: 'warning', message: 'Your tool "todo" has used 80% of its AI budget.', at: '2026-10-20T00:00:00Z' }], by_caller: [{ kind: 'user', id: 'person-1', calls: 4, cost_usd: 0.4 }] };

test('platform cost prints the sentences, the AI budget, the notices and who used it', async () => {
  const seen: string[] = [];
  const server = http.createServer((req, res) => { seen.push(req.url!); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const out: string[] = []; const log = console.log; console.log = (...a: unknown[]) => { out.push(a.join(' ')); };
  try { await handleCost(['--project', 'todo'], `http://127.0.0.1:${(server.address() as any).port}`); } finally { console.log = log; server.close(); }
  const text = out.join('\n');
  assert.deepEqual(seen, ['/v1/projects/todo/cost']);
  assert.match(text, /This is an estimate/); assert.match(text, /Assumptions:/); assert.match(text, /\$1\.70 of \$2\.00 \(85%\).*close to the limit/); assert.match(text, /used 80% of its AI budget/); assert.match(text, /person-1/);
});
