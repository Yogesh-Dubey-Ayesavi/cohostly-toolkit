import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { createHmac } from 'node:crypto';
import { createPlatform, PlatformError, type Routes } from './platform.js';
import { verifyDecisionSignature, type ApprovalsApi } from './approvals.js';
import { generateProject } from './generate.js';

const routes: Routes = { approvals: { methods: {
  request: { method: 'post', path: '/approvals', stateChanging: true, hasBody: true },
  get: { method: 'get', path: '/approvals/{id}', pathParams: ['id'] },
  cancel: { method: 'post', path: '/approvals/{id}/cancel', stateChanging: true, pathParams: ['id'] },
  signingKey: { method: 'get', path: '/approvals/signing-key' },
} } };
const env = { PLATFORM_TOKEN: 'tok', PLATFORM_BINDINGS: JSON.stringify({ approvals: { url: 'https://gw.test/approvals' } }) };
const KEY = 'k'.repeat(64);
const sig = (key: string, t: number, id: string, status: string, hash: string) => `t=${t},v1=${createHmac('sha256', key).update(`${t}.${id}.${status}.${hash}`).digest('hex')}`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function server(initial: string[] = ['pending', 'pending', 'approved']) {
  const seen: { method: string; url: string; headers: Record<string, string>; body?: any }[] = []; const statuses = [...initial];
  const fetch = (async (url: string, init: RequestInit) => {
    const u = new URL(url); const headers = init.headers as Record<string, string>; seen.push({ method: init.method!, url: u.pathname, headers, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (init.method === 'POST' && u.pathname === '/approvals') return json({ id: 'ap1', status: 'pending', details_hash: 'h'.repeat(64) });
    if (u.pathname === '/approvals/signing-key') return json({ key: KEY, algorithm: 'hmac-sha256', header: 'x-approval-signature', tolerance_seconds: 300 });
    if (u.pathname === '/approvals/ap1/cancel') return json({ id: 'ap1', status: 'cancelled' });
    if (u.pathname === '/approvals/ap1') return json({ id: 'ap1', status: statuses.length > 1 ? statuses.shift() : statuses[0] });
    return json({ error: { code: 'not_found', message: 'x', how_to_fix: 'y' } }, 404);
  }) as any;
  return { fetch, seen };
}
const platform = (s: ReturnType<typeof server>) => (createPlatform<{ approvals: ApprovalsApi }>(routes, { env, fetch: s.fetch, retries: 0 })).approvals;

describe('platform.approvals', () => {
  test('request sends the summary, details, risk and expiry, a stable idempotency key of the caller\'s choice, and returns a handle', async () => {
    const s = server(); const a = platform(s);
    const h = await a.request({ summary: 'Delete 12 rows', details: { rows: 12 }, risk: 'high', action: 'delete_rows', expiresIn: 3600 }, { idempotencyKey: 'order-77-delete' });
    assert.equal(h.id, 'ap1'); assert.equal(typeof h.wait, 'function');
    assert.deepEqual(s.seen[0].body, { summary: 'Delete 12 rows', details: { rows: 12 }, risk: 'high', action: 'delete_rows', expires_in: 3600 });
    assert.equal(s.seen[0].headers['idempotency-key'], 'order-77-delete'); assert.equal(s.seen[0].headers['x-platform-binding-token'], 'tok');
    const again = await a.request({ summary: 'x' }); assert.ok(s.seen[1].headers['idempotency-key'] && s.seen[1].headers['idempotency-key'] !== 'order-77-delete'); assert.ok(again.id);
  });

  test('wait polls with backoff until the approval is decided', async () => {
    const s = server(['pending', 'pending', 'approved']); const h = await platform(s).request({ summary: 'x' });
    const t0 = Date.now(); const r = await h.wait({ firstDelayMs: 5, maxDelayMs: 20 });
    assert.equal(r.status, 'approved'); assert.equal(s.seen.filter((x) => x.method === 'GET' && x.url === '/approvals/ap1').length, 3); assert.ok(Date.now() - t0 < 2000);
  });
  test('wait gives up with a plain error that says the approval is still alive', async () => {
    const s = server(['pending']); const h = await platform(s).request({ summary: 'x' });
    await assert.rejects(h.wait({ timeoutMs: 40, firstDelayMs: 20 }), (e: PlatformError) => e.code === 'wait_timeout' && /still pending/.test(e.message) && /callback/.test(e.howToFix));
  });
  test('wait can be aborted, and a decision that already happened returns at once (also by id after a restart)', async () => {
    const s = server(['pending']); const a = platform(s); const ac = new AbortController(); const h = await a.request({ summary: 'x' });
    const p = h.wait({ signal: ac.signal, firstDelayMs: 1000 }); setTimeout(() => ac.abort(), 10);
    await assert.rejects(p, (e: PlatformError) => e.code === 'aborted');
    const d = server(['denied']); assert.equal((await platform(d).wait('ap1')).status, 'denied');
  });
  test('cancel and refresh use the approval\'s own id', async () => {
    const s = server(['pending']); const h = await platform(s).request({ summary: 'x' });
    assert.equal((await h.cancel()).status, 'cancelled'); assert.equal((await h.refresh()).status, 'pending');
  });
});

describe('the callback', () => {
  const decision = { id: 'ap1', status: 'approved' as const, details_hash: 'h'.repeat(64), approvals: 1, required: 1 };
  const post = (d: unknown, header?: string) => new Request('http://app.test/__platform/hooks/approvals/decision', { method: 'POST', headers: { 'content-type': 'application/json', ...(header ? { 'x-approval-signature': header } : {}) }, body: JSON.stringify(d) });
  const from = (kind: string | undefined) => async () => (kind ? { caller: { kind } } : undefined);
  const now = 1_700_000_000_000, t = now / 1000;

  test('a verified decision runs the handler for that approval and the global ones; a handler that throws makes the platform retry', async () => {
    const a = platform(server()); const got: string[] = [];
    const h = await a.request({ summary: 'x' }); h.onDecision((d) => { got.push('one:' + d.status); });
    a.onDecision((d) => { got.push('all:' + d.id); });
    const cb = a.callback({ verify: from('platform'), now: () => now });
    const r = await cb.handle(post(decision, sig(KEY, t, 'ap1', 'approved', 'h'.repeat(64)))); assert.equal(r.status, 200); assert.deepEqual(got, ['one:approved', 'all:ap1']);
    got.length = 0; await cb.handle(post(decision, sig(KEY, t, 'ap1', 'approved', 'h'.repeat(64)))); assert.deepEqual(got, ['all:ap1'], 'the per-approval handler runs once; the global one runs every time');
    const boom = platform(server()); boom.onDecision(() => { throw new Error('db down'); });
    const bad = await boom.callback({ verify: from('platform'), now: () => now }).handle(post(decision, sig(KEY, t, 'ap1', 'approved', 'h'.repeat(64)))); assert.equal(bad.status, 500);
  });
  test('only the platform may call it, and a body that does not match the signature is ignored', async () => {
    const a = platform(server()); let ran = 0; a.onDecision(() => { ran++; });
    const good = sig(KEY, t, 'ap1', 'approved', 'h'.repeat(64));
    for (const kind of ['person', 'machine', 'anonymous', undefined]) assert.equal((await a.callback({ verify: from(kind), now: () => now }).handle(post(decision, good))).status, 403, String(kind));
    const cb = a.callback({ verify: from('platform'), now: () => now });
    assert.equal((await cb.handle(post({ ...decision, status: 'denied' }, good))).status, 401, 'status changed after signing');
    assert.equal((await cb.handle(post({ ...decision, details_hash: 'x'.repeat(64) }, good))).status, 401);
    assert.equal((await cb.handle(post(decision, sig('z'.repeat(64), t, 'ap1', 'approved', 'h'.repeat(64))))).status, 401, 'another project\'s key');
    assert.equal((await cb.handle(post(decision))).status, 401, 'no signature');
    assert.equal((await cb.handle(post(decision, sig(KEY, t - 600, 'ap1', 'approved', 'h'.repeat(64))))).status, 401, 'too old');
    assert.equal((await cb.handle(new Request('http://app.test/x', { method: 'GET' }))).status, 405);
    assert.equal((await cb.handle(post({ nope: 1 }, good))).status, 400);
    assert.equal(ran, 0);
  });
  test('the signature check itself', () => {
    const d = { id: 'i', status: 'approved' as const, details_hash: 'h' };
    assert.ok(verifyDecisionSignature(KEY, sig(KEY, t, 'i', 'approved', 'h'), d, now));
    assert.ok(!verifyDecisionSignature(KEY, sig(KEY, t, 'i', 'denied', 'h'), d, now));
    assert.ok(!verifyDecisionSignature(KEY, 'garbage', d, now));
    assert.ok(!verifyDecisionSignature(KEY, undefined, d, now));
  });
});

describe('the generated types', () => {
  test('a project that declares approvals gets the helper type, and one that does not gets no import of it', () => {
    const doc = (name: string): any => ({ info: { title: name, 'x-binding': { name, namespace: name, keyed: false, kind: 'out' } }, paths: {}, components: { schemas: {} } });
    assert.match(generateProject([doc('approvals')], {}).ts, /approvals: ApprovalsApi;/);
    assert.match(generateProject([doc('approvals')], {}).ts, /type ApprovalsApi \}/);
    assert.ok(!generateProject([doc('ai')], {}).ts.includes('ApprovalsApi'));
  });
});
