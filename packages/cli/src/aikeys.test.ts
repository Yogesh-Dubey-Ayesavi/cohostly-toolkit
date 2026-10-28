import { test } from 'node:test';
import * as assert from 'node:assert';
import http from 'node:http';
import { handleAiKeys } from './commands/aikeys.js';

test('platform ai-keys list shows what the platform provides, what needs a key, and the saved keys without any key', async () => {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/me') return res.end(JSON.stringify({ accounts: [{ id: 'acc1', kind: 'team' }, { id: 'acc2', kind: 'personal' }] }));
    res.end(JSON.stringify({
      models: [{ model: 'gemini-3.5-flash-lite', provider: 'google-vertex-ai', paid_by: 'platform', default: true, key: null, price_per_million_tokens_usd: { input: 0.3, output: 2.5 }, price_checked: false },
        { model: 'claude-sonnet-5-5', provider: 'anthropic', paid_by: 'your key', default: false, key: 'saved', price_per_million_tokens_usd: { input: 3, output: 15 }, price_checked: true },
        { model: 'llama-fast', provider: 'groq', paid_by: 'your key', default: false, key: 'invalid', price_per_million_tokens_usd: { input: 0.05, output: 0.08 }, price_checked: true }],
      keys: [{ provider: 'anthropic', hint: 'sk-a…wxyz', status: 'active', last_used_at: null }], providers_you_can_bring: ['anthropic', 'groq'],
    }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const out: string[] = []; const log = console.log; console.log = (...a: unknown[]) => { out.push(a.join(' ')); };
  try { await handleAiKeys(['list'], `http://127.0.0.1:${(server.address() as any).port}`); } finally { console.log = log; server.close(); }
  const text = out.join('\n');
  assert.deepEqual(seen, ['GET /v1/me', 'GET /v1/accounts/acc2/ai-keys'], 'the personal account is the default');
  assert.match(text, /gemini-3\.5-flash-lite\s+\(default\) \$0\.3\/2\.5 per million tokens \(in\/out\) - price not checked yet/);
  assert.match(text, /claude-sonnet-5-5\s+anthropic\s+key saved/); assert.match(text, /llama-fast\s+groq\s+KEY REJECTED - replace it/);
  assert.match(text, /anthropic\s+sk-a…wxyz\s+active, not used yet/); assert.match(text, /platform ai-keys set <provider>/);
});
