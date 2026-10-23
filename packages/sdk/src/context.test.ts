import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loginUrl, verifyContextToken, context, contextFromHeaders, middleware, bindingHeaders, platformFetch, ContextVerificationError } from './index.js'

// A stand-in for the platform: a key pair, a published key set, and a signer that mints tokens like the proxy does.
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pub = await crypto.subtle.exportKey('jwk', kp.publicKey)
const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
async function mint(claims: Record<string, unknown>, o: { key?: CryptoKeyPair; kid?: string; alg?: string } = {}) {
  const h = enc({ alg: o.alg ?? 'ES256', typ: 'JWT', kid: o.kid ?? 'k1' })
  const p = enc(claims)
  const sig = Buffer.from(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, (o.key ?? kp).privateKey, new TextEncoder().encode(`${h}.${p}`))).toString('base64url')
  return `${h}.${p}.${sig}`
}
let fetches = 0
let published: Record<string, unknown>[] = [{ ...pub, kid: 'k1', alg: 'ES256', use: 'sig' }]
const fakeFetch = (async () => { fetches++; return new Response(JSON.stringify({ keys: published })) }) as typeof fetch
const NOW = 1_800_000_000_000
const opts = { jwksUrl: 'https://auth.test/.well-known/jwks.json', issuer: 'https://auth.test', audience: 'app-aaaaa.apps.test', fetch: fakeFetch, now: () => NOW }
const good = (over: Record<string, unknown> = {}) => ({ iss: 'https://auth.test', aud: 'app-aaaaa.apps.test', sub: 'u1', iat: NOW / 1000 - 5, exp: NOW / 1000 + 295, jti: 'REQ1', ctx: { caller: { kind: 'person', name: 'Zoë Ñandú' }, access: { role: 'editor' } }, ...over })

test('a good token yields the context', async () => {
  const c = await verifyContextToken(await mint(good()), opts)
  assert.equal(c.caller?.kind, 'person'); assert.equal(c.caller?.name, 'Zoë Ñandú'); assert.equal(c.access?.role, 'editor'); assert.equal(c._claims.jti, 'REQ1')
})

test('it refuses a tampered token, a token for another app, an expired one, another issuer, an unknown key and a forged signature', async () => {
  const t = await mint(good())
  const [h, p, s] = t.split('.')
  const evil = JSON.parse(Buffer.from(p, 'base64url').toString()); evil.ctx.access.role = 'owner'
  await assert.rejects(verifyContextToken(`${h}.${enc(evil)}.${s}`, opts), /signature/)
  await assert.rejects(verifyContextToken(await mint(good()), { ...opts, audience: 'other-bbbbb.apps.test' }), /different app/)
  await assert.rejects(verifyContextToken(await mint(good({ exp: NOW / 1000 - 120 })), opts), /expired/)
  await assert.rejects(verifyContextToken(await mint(good({ iss: 'https://evil.test' })), opts), /different platform/)
  await assert.rejects(verifyContextToken(await mint(good(), { kid: 'nope' }), opts), /does not publish/)
  await assert.rejects(verifyContextToken(await mint(good(), { key: other }), opts), /signature/)
  await assert.rejects(verifyContextToken(await mint(good({ iat: NOW / 1000 + 3600 })), opts), /future/)
  await assert.rejects(verifyContextToken('not.a.token', opts), ContextVerificationError)
  await assert.rejects(verifyContextToken('nope', opts), /not a token/)
})

test('it never trusts the algorithm the token names', async () => {
  const h = enc({ alg: 'none', typ: 'JWT', kid: 'k1' }), p = enc(good())
  await assert.rejects(verifyContextToken(`${h}.${p}.`, opts), /ES256/)
  const hs = enc({ alg: 'HS256', typ: 'JWT', kid: 'k1' })
  await assert.rejects(verifyContextToken(`${hs}.${p}.${enc('x')}`, opts), /ES256/)
})

test('keys are cached, and refetched once when the platform rotates to a new one', async () => {
  fetches = 0
  const fresh = { ...opts, now: () => NOW } // one cache for this fetch
  const rotated = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  published = [{ ...pub, kid: 'k1', alg: 'ES256', use: 'sig' }]
  const f2 = (async () => { fetches++; return new Response(JSON.stringify({ keys: published })) }) as typeof fetch
  let clock = NOW
  const o = { ...fresh, fetch: f2, now: () => clock }
  // each call builds its own cache when fetch is overridden, so test the cache class directly
  const { JwksCache } = await import('./index.js')
  const cache = new JwksCache('https://auth.test/jwks', f2, () => clock)
  assert.ok(await cache.get('k1')); assert.ok(await cache.get('k1')); assert.equal(fetches, 1, 'cached')
  assert.equal(await cache.get('k2'), undefined); assert.equal(fetches, 1, 'an unknown key does not refetch within 10 seconds')
  clock += 11_000; published = [{ ...pub, kid: 'k1' }, { ...(await crypto.subtle.exportKey('jwk', rotated.publicKey)), kid: 'k2' }]
  assert.ok(await cache.get('k2')); assert.equal(fetches, 2, 'a rotated key is picked up')
  void o
})

test('context(request) reads the token from the request and checks it against the host the request came in on', async () => {
  const t = await mint(good())
  const ok = await context({ headers: { 'x-platform-context': t, host: 'app-aaaaa.apps.test' } }, { ...opts, audience: undefined })
  assert.equal(ok?.caller?.kind, 'person')
  const viaFetchApi = await context(new Headers({ 'x-platform-context': t, host: 'app-aaaaa.apps.test' }), { ...opts, audience: undefined })
  assert.equal(viaFetchApi?.access?.role, 'editor')
  await assert.rejects(context({ headers: { 'x-platform-context': t, host: 'other-bbbbb.apps.test' } }, { ...opts, audience: undefined }), /different app/)
  assert.equal(await context({ headers: { host: 'app-aaaaa.apps.test' } }, opts), undefined, 'outside the platform there is simply no context')
})

test('the headers can be read as a hint, decoded, with absent fields absent', () => {
  const c = contextFromHeaders({ headers: { 'x-platform-caller-kind': 'person', 'x-platform-caller-name': 'Zo%C3%AB%20%C3%91and%C3%BA', 'x-platform-access-scopes': 'a,b%20c', 'x-platform-place-time-zone': 'Asia/Kolkata' } })
  assert.equal(c.caller?.name, 'Zoë Ñandú'); assert.equal(c.place?.time_zone, 'Asia/Kolkata'); assert.deepEqual(c.access?.scopes, ['a', 'b c'])
  assert.equal(c.caller?.email, undefined); assert.equal(c.device, undefined)
})

test('middleware attaches the context and passes the token on to bindings made while handling the request', async () => {
  const t = await mint(good())
  const req: any = { headers: { 'x-platform-context': t, host: 'app-aaaaa.apps.test' } }
  let seen: Record<string, string> = {}; let sent: Headers | undefined
  await new Promise<void>((resolve) => middleware(opts as any)(req, { end() {} }, () => {
    seen = bindingHeaders()
    platformFetch('https://bindings.test/ai', {}, (async (_u: any, init: any) => { sent = new Headers(init.headers); return new Response('ok') }) as any).then(() => resolve())
  }))
  assert.equal(req.platform.caller.kind, 'person'); assert.equal(seen['X-Platform-Context'], t); assert.equal(sent?.get('x-platform-context'), t)
  assert.deepEqual(bindingHeaders(), {}, 'outside a request there is nothing to forward')
})

test('required middleware answers 401 without a valid context', async () => {
  const res: any = { statusCode: 200, body: '', end(b: string) { this.body = b } }
  await new Promise<void>((resolve) => { res.end = (b: string) => { res.body = b; resolve() }; middleware({ ...opts, required: true } as any)({ headers: { host: 'app-aaaaa.apps.test' } }, res, () => resolve()) })
  assert.equal(res.statusCode, 401)
  const res2: any = { statusCode: 200, end() { res2.done?.() } }
  await new Promise<void>((resolve) => { res2.done = resolve; middleware({ ...opts, required: true } as any)({ headers: { 'x-platform-context': 'junk.junk.junk', host: 'app-aaaaa.apps.test' } }, res2, () => resolve()) })
  assert.equal(res2.statusCode, 401)
})

test('loginUrl comes back to a path on the same host, and never to another site', () => {
  const saved = process.env.PLATFORM_LOGIN_URL
  try {
    delete process.env.PLATFORM_LOGIN_URL
    assert.equal(loginUrl('/orders?id=1'), '/__platform/login?return=%2Forders%3Fid%3D1')
    assert.equal(loginUrl(), '/__platform/login?return=%2F')
    assert.equal(loginUrl('//evil.example'), '/__platform/login?return=%2F')
    assert.equal(loginUrl('https://evil.example/x'), '/__platform/login?return=%2F')
    process.env.PLATFORM_LOGIN_URL = '/__platform/login'
    assert.equal(loginUrl('/a'), '/__platform/login?return=%2Fa')
  } finally { if (saved === undefined) delete process.env.PLATFORM_LOGIN_URL; else process.env.PLATFORM_LOGIN_URL = saved }
})

// Phase 24: a personal field the app asked for and the person does not share arrives as null with a status, so the app can tell "not shared" from "never asked".
test('a field the person does not share is null with a not_shared status, from the headers and from the signed token', async () => {
  const h = contextFromHeaders({ headers: { 'x-platform-caller-kind': 'person', 'x-platform-caller-name': 'Ana', 'x-platform-caller-email-status': 'not_shared' } })
  assert.equal(h.caller?.name, 'Ana')
  assert.equal(h.caller?.email, null)
  assert.equal(h.caller?.email_status, 'not_shared')
  assert.ok(!('avatar_url' in (h.caller ?? {})), 'a field nobody asked for stays absent')
  assert.equal(h.caller?.name_status, undefined)

  const c = await verifyContextToken(await mint(good({ ctx: { caller: { kind: 'person', name: 'Ana', email: null, email_status: 'not_shared' } } })), opts)
  assert.equal(c.caller?.email, null)
  assert.equal(c.caller?.email_status, 'not_shared')
})
