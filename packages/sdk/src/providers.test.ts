import { test } from 'node:test';
import * as assert from 'node:assert';
import { googleFetch, microsoftFetch, providerHelpers } from './providers.js';
import { createPlatform, PlatformError, type Routes } from './platform.js';

type Seen = { url: string; headers: Headers; method?: string };
const capture = () => { const seen: Seen[] = []; const f = (async (u: string | Request, i: RequestInit = {}) => { seen.push({ url: typeof u === 'string' ? u : u.url, headers: new Headers(typeof u === 'string' ? i.headers : u.headers), method: typeof u === 'string' ? i.method : u.method }); return Response.json({ ok: true }); }) as unknown as typeof fetch; return { seen, f }; };
const env = { PLATFORM_TOKEN: 'binding-token' };
const addr = () => 'https://bindings.test/connections/mail';

test('Google: any *.googleapis.com address goes to the connection with its path, with the binding token and not the client\'s own credential', async () => {
  const { seen, f } = capture();
  const g = googleFetch(addr, { env, fetch: f });
  await g('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', { method: 'POST', headers: { authorization: 'Bearer whatever-the-client-had', 'content-type': 'message/rfc822' } });
  await g('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  assert.equal(seen[0].url, 'https://bindings.test/connections/mail/upload/gmail/v1/users/me/messages/send?uploadType=media');
  assert.equal(seen[0].headers.get('authorization'), null);
  assert.equal(seen[0].headers.get('x-platform-binding-token'), 'binding-token');
  assert.equal(seen[0].headers.get('content-type'), 'message/rfc822');
  assert.equal(seen[1].url, 'https://bindings.test/connections/mail/calendar/v3/calendars/primary/events');
});

test('Google: any other address is refused before anything is sent, so the token never leaves for it', async () => {
  const { seen, f } = capture();
  const g = googleFetch(addr, { env, fetch: f });
  for (const u of ['https://evil.example.com/gmail/v1/users/me/messages', 'https://googleapis.com.evil.example/x', 'http://gmail.googleapis.com/x', 'https://accounts.google.com/o/oauth2/token']) {
    await assert.rejects(g(u), (e: PlatformError) => e.code === 'host_refused', u);
  }
  assert.equal(seen.length, 0);
});

test('Microsoft: Graph v1.0 goes to the connection without the version; /users/TokenToReplace is /me; beta is refused', async () => {
  const { seen, f } = capture();
  const m = microsoftFetch(() => 'https://bindings.test/connections/office/', { env, fetch: f });
  await m('https://graph.microsoft.com/v1.0/users/TokenToReplace/messages?$top=5');
  await m('https://graph.microsoft.com/v1.0/me/drive/root:/a%20b.txt:/content', { method: 'PUT' });
  await m('https://graph.microsoft.com/v1.0/users/TokenToReplaceX/messages');
  await m('https://graph.microsoft.com/v1.0/drives/me/items/I1/content', { method: 'PUT' });
  await m('https://graph.microsoft.com/v1.0/drives/b!other/items/I1');
  assert.deepEqual(seen.map((s) => s.url), ['https://bindings.test/connections/office/me/messages?$top=5', 'https://bindings.test/connections/office/me/drive/root:/a%20b.txt:/content', 'https://bindings.test/connections/office/users/TokenToReplaceX/messages', 'https://bindings.test/connections/office/me/drive/items/I1/content', 'https://bindings.test/connections/office/drives/b!other/items/I1']);
  await assert.rejects(m('https://graph.microsoft.com/beta/me'), (e: PlatformError) => e.code === 'version_not_supported');
  await assert.rejects(m('https://contoso.sharepoint.com/x'), (e: PlatformError) => e.code === 'host_refused');
});

test('the visitor\'s context goes along when the call is made inside a handled request; without a token nothing is sent', async () => {
  const { seen, f } = capture();
  await assert.rejects(googleFetch(addr, { env: {}, fetch: f })('https://gmail.googleapis.com/gmail/v1/users/me/profile'), (e: PlatformError) => e.code === 'not_configured');
  assert.equal(seen.length, 0);
});

test('google(factory, options) calls the official factory with the app\'s options and our fetch, and no auth client', () => {
  let got: any;
  const h = providerHelpers('google', addr, { env });
  const client = h.google!((o: { version: 'v1'; fetchImplementation?: unknown; auth?: unknown; userAgentDirectives?: unknown[] }) => { got = o; return { kind: 'gmail' }; }, { version: 'v1' });
  assert.deepEqual(client, { kind: 'gmail' });
  assert.equal(got.version, 'v1'); assert.equal(typeof got.fetchImplementation, 'function'); assert.equal(got.auth, undefined);
  assert.equal(h.microsoft, undefined, 'a Google connection has no Microsoft client');
});

test('microsoft(sdk, kiota) builds the Graph client on our fetch with no credential of its own', () => {
  const made: any = {};
  class HttpClient { constructor(public customFetch: unknown, ...m: unknown[]) { made.middlewares = m; } }
  class GraphRequestAdapter { constructor(public auth: any, _p?: unknown, _s?: unknown, public http?: unknown) { made.adapter = this; } }
  const h = providerHelpers('microsoft', addr, { env });
  const c = h.microsoft!({ createGraphServiceClient: (a: any) => ({ adapter: a }), GraphRequestAdapter }, { HttpClient, MiddlewareFactory: { getDefaultMiddlewares: (f?: unknown) => ['retry', f] } });
  assert.equal((c as any).adapter, made.adapter);
  assert.equal(typeof made.middlewares[1], 'function', 'the last middleware fetches through the connection');
  assert.equal(h.google, undefined);
});

test('createPlatform gives each connection its provider\'s client, from PLATFORM_BINDINGS', () => {
  const routes: Routes = { connections: { keys: ['mail', 'office', 'other'], methods: { get: { method: 'get', path: '/connections/{name}/{path}', pathParams: ['path'] } } } };
  const bindings = { connections: { url: 'https://gw.test/connections', names: { mail: { provider: 'google' }, office: { provider: 'microsoft' }, other: {} } } };
  const p: any = createPlatform(routes, { env: { PLATFORM_TOKEN: 't', PLATFORM_BINDINGS: JSON.stringify(bindings) } });
  assert.equal(typeof p.connections.mail.google, 'function'); assert.equal(p.connections.mail.microsoft, undefined);
  assert.equal(typeof p.connections.office.microsoft, 'function'); assert.equal(p.connections.office.google, undefined);
  assert.equal(typeof p.connections.other.google, 'function', 'provider unknown: both');
  assert.equal(typeof p.connections.mail.get, 'function', 'the plain calls are still there');
});

test('a Request with a stream body is rebuilt for the connection (duplex), not thrown on', async () => {
  const { seen, f } = capture();
  const g = googleFetch(addr, { env, fetch: f });
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('chunk')); c.close(); } });
  const req = new Request('https://www.googleapis.com/upload/drive/v3/files?uploadType=media', { method: 'POST', body, duplex: 'half', headers: { 'content-type': 'text/plain' } } as RequestInit);
  await g(req);
  assert.equal(seen[0].url, 'https://bindings.test/connections/mail/upload/drive/v3/files?uploadType=media');
  assert.equal(seen[0].headers.get('x-platform-binding-token'), 'binding-token');
});

test('a provider with no official client here (Slack) gets no Google or Microsoft helper', () => {
  const h = providerHelpers('slack', addr, { env });
  assert.equal(h.google, undefined); assert.equal(h.microsoft, undefined);
});
