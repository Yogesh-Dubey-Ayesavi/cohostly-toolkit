import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPlatform, PlatformError, type Routes } from './platform.js'
import { mountHandlers } from './handlers.js';
import { generateProject, checkGenerated, tsType, type OpenApiDoc } from './generate.js';
import { runTypes } from './types-command.js';

const routes: Routes = {
  widgets: { methods: { request: { method: 'post', path: '/widgets/request', stateChanging: true, hasBody: true }, get: { method: 'get', path: '/widgets/{id}', pathParams: ['id'] } } },
  connections: { keys: ['sheet'], methods: { call: { method: 'post', path: '/connections/{name}/{action}', stateChanging: true, pathParams: ['action'], hasBody: true } } },
};
const env = { PLATFORM_TOKEN: 'tok', PLATFORM_BINDINGS: JSON.stringify({ widgets: { url: 'https://gw.test/widgets' } }) };
const ok = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers });
const err = (status: number, code: string, headers: Record<string, string> = {}) => new Response(JSON.stringify({ error: { code, message: `m-${code}`, how_to_fix: `fix-${code}` } }), { status, headers });

describe('the platform runtime', () => {
  test('sends the token, a request id and the body to the binding address; fills path parameters', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const p: any = createPlatform(routes, { env, fetch: (async (u: string, i: RequestInit) => { seen.push({ url: u, init: i }); return ok({ id: 'a1', status: 'pending' }); }) as any });
    assert.deepEqual(await p.widgets.request({ title: 'x' }), { id: 'a1', status: 'pending' });
    await p.widgets.get({ id: 'a b' });
    assert.equal(seen[0].url, 'https://gw.test/widgets/request'); assert.equal(seen[1].url, 'https://gw.test/widgets/a%20b');
    const h = seen[0].init.headers as Record<string, string>;
    assert.equal(h['x-platform-binding-token'], 'tok'); assert.ok(h['x-request-id']); assert.ok(h['idempotency-key']);
    assert.equal((seen[1].init.headers as Record<string, string>)['idempotency-key'], undefined); // a read needs none
    assert.equal(seen[0].init.body, JSON.stringify({ title: 'x' }));
  });

  test('a keyed binding has one client per key, and the key fills {name}', async () => {
    let url = '';
    const p: any = createPlatform(routes, { env, fetch: (async (u: string) => { url = u; return ok({}); }) as any });
    await p.connections.sheet.call({ action: 'append' }, { row: 1 });
    assert.equal(url, 'https://gw.test/connections/sheet/append');
    assert.equal(p.connections.other, undefined);
  });

  test('errors carry the platform code, a plain message and how to fix it', async () => {
    const p: any = createPlatform(routes, { env, retries: 0, fetch: (async () => err(403, 'binding_not_declared', { 'x-request-id': 'rid-1' })) as any });
    await assert.rejects(p.widgets.get({ id: '1' }), (e: PlatformError) => e instanceof PlatformError && e.status === 403 && e.code === 'binding_not_declared' && e.howToFix === 'fix-binding_not_declared' && e.requestId === 'rid-1');
  });

  test('a busy platform is retried with the same idempotency key, then succeeds', async () => {
    const keys: string[] = []; let n = 0;
    const p: any = createPlatform(routes, { env, retries: 2, fetch: (async (_u: string, i: RequestInit) => { keys.push((i.headers as any)['idempotency-key']); return ++n < 3 ? err(503, 'unavailable', { 'retry-after': '0' }) : ok({ id: 'z' }); }) as any });
    assert.deepEqual(await p.widgets.request({ title: 't' }), { id: 'z' });
    assert.equal(n, 3); assert.equal(new Set(keys).size, 1);
  });

  test('a 4xx answer is not retried', async () => {
    let n = 0;
    const p: any = createPlatform(routes, { env, retries: 2, fetch: (async () => { n++; return err(400, 'invalid_request'); }) as any });
    await assert.rejects(p.widgets.request({ title: 1 }));
    assert.equal(n, 1);
  });

  test('a network failure is retried and then reported as network_error', async () => {
    let n = 0;
    const p: any = createPlatform(routes, { env, retries: 1, fetch: (async () => { n++; throw new Error('boom'); }) as any });
    await assert.rejects(p.widgets.get({ id: '1' }), (e: PlatformError) => e.code === 'network_error');
    assert.equal(n, 2);
  });

  test('without a token it says how to get one, before any request', async () => {
    let n = 0;
    const p: any = createPlatform(routes, { env: { PLATFORM_BINDINGS: env.PLATFORM_BINDINGS }, fetch: (async () => { n++; return ok({}); }) as any });
    await assert.rejects(p.widgets.get({ id: '1' }), (e: PlatformError) => e.code === 'not_configured' && /platform dev/.test(e.howToFix));
    assert.equal(n, 0);
  });

  test('a call that times out is reported, not left hanging', async () => {
    const keepAlive = setTimeout(() => {}, 500); // AbortSignal.timeout's own timer does not hold the process open
    const p: any = createPlatform(routes, { env, retries: 0, timeoutMs: 20, fetch: ((_u: string, i: RequestInit) => new Promise((_r, rej) => i.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as any });
    await assert.rejects(p.widgets.get({ id: '1' }), (e: PlatformError) => e.code === 'network_error').finally(() => clearTimeout(keepAlive));
  });
});

const doc = (name: string, extra: Partial<OpenApiDoc> = {}, keyed = false): OpenApiDoc => ({
  info: { title: name, description: `${name} desc`, 'x-binding': { name, namespace: name, keyed, kind: 'out' } },
  paths: { [`/${name}/go`]: { post: { operationId: 'go', summary: 'Go.', 'x-state-changing': true, requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoReq' } } } }, responses: { '200': { content: { 'application/json': { schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } } } } } } } } },
  components: { schemas: { GoReq: { type: 'object', required: ['model'], properties: { model: { type: 'string', enum: ['a', 'b'] }, n: { type: 'integer' } } }, Error: { type: 'object' } } },
  ...extra,
});

describe('type generation from OpenAPI documents', () => {
  test('only the documents given appear, in a stable order, with no `any`', () => {
    const c = generateProject([doc('zeta'), doc('alpha')]);
    assert.deepEqual(c.declared, ['alpha', 'zeta']);
    assert.ok(!/\bany\b/.test(c.ts.replace(/\/\/.*$/gm, '')));
    assert.equal(c.ts, generateProject([doc('alpha'), doc('zeta')]).ts);
    assert.match(c.ts, /go\(body: GoReq\): Promise<\{\n\s+ok: boolean;/);
  });
  test('the project-specific model list narrows the model field', () => {
    const ai = doc('ai'); ai.components!.schemas!.AiMessagesRequest = { type: 'object', required: ['model'], properties: { model: { type: 'string', enum: ['a', 'b'] } } };
    const c = generateProject([ai], { ai: { url: 'u', models: ['b'] } });
    assert.match(c.ts, /AiMessagesRequest = \{\n\s+model: "b";/);
  });
  test('an empty project says so', () => { const c = generateProject([]); assert.deepEqual(c.declared, []); assert.match(c.markdown, /No bindings are declared/); });
  test('a stale or hand-edited file is detected, and the reason says what to do', () => {
    const fresh = generateProject([doc('a')]);
    assert.equal(checkGenerated(fresh, fresh.ts).ok, true);
    assert.match(checkGenerated(fresh, undefined).reason!, /platform types/);
    assert.match(checkGenerated(fresh, generateProject([doc('a'), doc('b')]).ts).reason!, /older than the declared bindings/);
    assert.match(checkGenerated(fresh, fresh.ts + '// mine\n').reason!, /edited by hand/);
  });
  test('tsType handles refs, enums, arrays, optional and free-form objects', () => {
    assert.equal(tsType({ $ref: '#/components/schemas/X' }), 'X');
    assert.equal(tsType({ type: 'array', items: { type: 'string', enum: ['a', 'b'] } }), '("a" | "b")[]');
    assert.equal(tsType({ type: 'object', additionalProperties: true }), 'Record<string, unknown>');
    assert.equal(tsType({ description: 'owner defined' }), 'unknown');
  });
});

describe('platform types (the command)', () => {
  test('fetches each binding document with the token, writes the files, and --check passes then fails once the manifest moves on', async () => {
    const docs: Record<string, OpenApiDoc> = { '/a/openapi.json': doc('a') };
    const calls: string[] = [];
    const f = (async (u: string, i: RequestInit) => { const p = new URL(u).pathname; calls.push(`${p}|${(i.headers as any)['x-platform-binding-token']}`); return docs[p] ? ok(docs[p]) : err(403, 'binding_not_declared'); }) as any;
    const e = { PLATFORM_TOKEN: 't1', PLATFORM_BINDINGS: JSON.stringify({ a: { url: 'https://gw.test/a' } }) };
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'types-'));
    assert.equal((await runTypes({ env: e, fetch: f, out })).code, 0);
    assert.deepEqual(calls, ['/a/openapi.json|t1']);
    assert.ok(fs.existsSync(path.join(out, 'platform.gen.ts')) && fs.existsSync(path.join(out, 'platform.contract.md')));
    assert.equal((await runTypes({ env: e, fetch: f, out, check: true })).code, 0);
    docs['/b/openapi.json'] = doc('b');
    const moved = { ...e, PLATFORM_BINDINGS: JSON.stringify({ a: { url: 'https://gw.test/a' }, b: { url: 'https://gw.test/b' } }) };
    const r = await runTypes({ env: moved, fetch: f, out, check: true });
    assert.equal(r.code, 1); assert.match(r.message, /older than the declared bindings/);
  });
  test('an undeclared binding or missing token gives a plain message', async () => {
    assert.match((await runTypes({ env: {} })).message, /platform dev/);
    const r = await runTypes({ env: { PLATFORM_TOKEN: 't', PLATFORM_BINDINGS: JSON.stringify({ x: { url: 'https://gw.test/x' } }) }, fetch: (async () => err(403, 'binding_not_declared')) as any, out: os.tmpdir() });
    assert.equal(r.code, 1); assert.match(r.message, /"x" contract \(403\)/);
  });
});

describe('the project\'s tables on platform.data', () => {
  const dataDoc = (): OpenApiDoc => ({
    info: { title: 'Managed data', description: 'Data.', 'x-binding': { name: 'data', namespace: 'data', keyed: false, kind: 'out' } },
    components: { schemas: { DataSql: { type: 'object', required: ['sql'], properties: { sql: { type: 'string' }, args: { type: 'array', items: {} } } }, DataSqlResult: { type: 'object', required: ['rows', 'changed'], properties: { rows: { type: 'array', items: { type: 'object', additionalProperties: true } }, changed: { type: 'integer' } } } } },
    'x-models': { order_items: { fields: [{ name: 'id', kind: 'string', optional: false, id: true, has_default: true }, { name: 'user_id', kind: 'string', optional: false, id: false, has_default: false }, { name: 'note', kind: 'string', optional: true, id: false, has_default: false }, { name: 'paid', kind: 'boolean', optional: false, id: false, has_default: true }], policies: ['Each person sees only their own rows.'] } },
  })
  test('each table gets row, create, update and filter types; columns with a default or that may be empty are optional to create', () => {
    const c = generateProject([dataDoc()])
    assert.match(c.ts, /export interface OrderItems \{\n\s+id: string;\n\s+user_id: string;\n\s+note: string \| null;\n\s+paid: boolean;/)
    assert.match(c.ts, /export interface OrderItemsCreate \{\n\s+id\?: string;\n\s+user_id: string;\n\s+note\?: string \| null;\n\s+paid\?: boolean;/)
    assert.match(c.ts, /order_items: Table<OrderItems, OrderItemsCreate, OrderItemsUpdate, OrderItemsWhere>;/)
    assert.match(c.ts, /\$app: \{[\s\S]*sql\(body: DataSql\): Promise<DataSqlResult>/)
    assert.ok(!/\bany\b/.test(c.ts.replace(/\/\/.*$/gm, '')))
    assert.match(c.markdown, /Each person sees only their own rows/)
  })
  test('a project with data but no tables says so', () => {
    const d = dataDoc(); d['x-models'] = {}
    assert.match(generateProject([d]).markdown, /no tables yet/)
  })
  test('calls go to ZenStack\'s strict routes: reads are GET with q, writes send a body, the answer is unwrapped, and $app says so', async () => {
    const seen: { url: string; method: string; headers: Record<string, string>; body?: string }[] = []
    const f = (async (u: string, i: RequestInit) => { seen.push({ url: u, method: String(i.method), headers: i.headers as any, body: i.body as string }); return ok({ data: [{ id: '1' }] }) }) as any
    const p: any = createPlatform({ data: { tables: ['order_items'], methods: {} } }, { env: { PLATFORM_TOKEN: 't', PLATFORM_BINDINGS: JSON.stringify({ data: { url: 'https://gw.test/data' } }) }, fetch: f })
    assert.deepEqual(await p.data.order_items.findMany({ where: { paid: true }, take: 5 }), [{ id: '1' }])
    assert.equal(seen[0].method, 'GET'); assert.equal(seen[0].url, 'https://gw.test/data/api/model/order_items/findMany?q=' + encodeURIComponent('{"where":{"paid":true},"take":5}'))
    assert.equal(seen[0].headers['x-platform-authority'], undefined)
    await p.data.order_items.create({ data: { user_id: 'u' } }); assert.equal(seen[1].method, 'POST'); assert.equal(seen[1].body, '{"data":{"user_id":"u"}}'); assert.ok(seen[1].headers['idempotency-key'])
    await p.data.order_items.update({ where: { id: '1' }, data: { paid: true } }); assert.equal(seen[2].method, 'PATCH')
    await p.data.order_items.deleteMany({ where: {} }); assert.equal(seen[3].method, 'DELETE'); assert.match(seen[3].url, /deleteMany\?q=/)
    await p.data.$app.order_items.count(); assert.equal(seen[4].headers['x-platform-authority'], 'app')
    await p.data.$app.sql({ sql: 'select 1' }); assert.equal(seen[5].url, 'https://gw.test/data/sql'); assert.equal(seen[5].headers['x-platform-authority'], 'app')
  })
})

describe('calls in: the platform calls the app', () => {
  const table = { approvals: ['decision'] }
  const seen: unknown[] = []
  const h = (kind: string | undefined) => mountHandlers({ approvals: { decision: async (p: unknown) => { seen.push(p) } } }, table, { verify: async () => (kind ? ({ caller: { kind } } as any) : undefined) })
  const post = (path: string, body: unknown = { id: 'a1', status: 'approved' }) => new Request('http://app.test' + path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

  test('only the platform itself gets through; a person, a program or no context at all is refused and the handler never runs', async () => {
    for (const kind of ['person', 'machine', 'anonymous', undefined]) { const r = await h(kind).handle(post('/__platform/hooks/approvals/decision')); assert.equal(r!.status, 403, String(kind)) }
    assert.deepEqual(seen, [])
    const ok = await h('platform').handle(post('/__platform/hooks/approvals/decision')); assert.equal(ok!.status, 200); assert.deepEqual(seen, [{ id: 'a1', status: 'approved' }])
  })
  test('other paths are not ours; unknown hooks are 404; a missing handler is 501; a bad body is 400; a failing handler is a 500 that hides the error', async () => {
    assert.equal(await h('platform').handle(post('/orders')), undefined)
    assert.equal((await h('platform').handle(post('/__platform/hooks/approvals/nope')))!.status, 404)
    assert.equal((await mountHandlers({}, table, { verify: async () => ({ caller: { kind: 'platform' } }) as any }).handle(post('/__platform/hooks/approvals/decision')))!.status, 501)
    assert.equal((await h('platform').handle(new Request('http://app.test/__platform/hooks/approvals/decision', { method: 'POST', body: 'not json' })))!.status, 400)
    const boom = mountHandlers({ approvals: { decision: () => { throw new Error('secret detail') } } }, table, { verify: async () => ({ caller: { kind: 'platform' } }) as any })
    const r = await boom.handle(post('/__platform/hooks/approvals/decision')); assert.equal(r!.status, 500); assert.ok(!(await r!.text()).includes('secret detail'))
    assert.equal((await h('platform').handle(new Request('http://app.test/__platform/hooks/approvals/decision')))!.status, 405)
  })
  test('the generated file types the handlers: a binding that has calls in gets a Handlers type and mountHandlers', () => {
    const d = doc('approvals', { webhooks: { decision: { post: { operationId: 'decision', summary: 'Answered.', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } } } } } } })
    const c = generateProject([d])
    assert.match(c.ts, /export interface Handlers \{\n\s+approvals\?: \{[\s\S]*decision\(payload: \{[\s\S]*ctx: Context\): void \| Promise<void>;/)
    assert.match(c.ts, /export const mountHandlers = \(handlers: Handlers\) => mountHooks\(handlers as never, \{"approvals":\["decision"\]\}\);/)
    assert.match(c.markdown, /The platform calls your app: approvals/)
  })
})
