import { AsyncLocalStorage } from 'node:async_hooks'
import type { PlatformContext } from './context-fields.generated.js'
import { CONTEXT_FIELD_HEADERS } from './context-fields.generated.js'

// The request context, for apps. The platform adds `X-Platform-*` headers and one signed token (`X-Platform-Context`) to every request.
// The headers are convenient hints. The token is what to verify before doing anything sensitive, and what to forward to bindings.

export class ContextVerificationError extends Error {}

export interface VerifyOptions {
  /** Where the platform publishes its public keys: https://auth.<platform-domain>/.well-known/jwks.json. Defaults to $PLATFORM_JWKS_URL, or $PLATFORM_AUTH_URL + /.well-known/jwks.json. */
  jwksUrl?: string
  /** The platform's issuer address (https://auth.<platform-domain>). Defaults to $PLATFORM_AUTH_URL. When set, the token's issuer must match. */
  issuer?: string
  /** The host this app is served at. The token is only good for that one host. Defaults to the request's Host header. */
  audience?: string
  fetch?: typeof fetch
  now?: () => number
  /** Seconds of clock difference to forgive. Default 30. */
  clockSkewSeconds?: number
}

export type VerifiedContext = PlatformContext & { _claims: { iss?: string; aud?: string; sub?: string; exp: number; iat?: number; jti?: string } }

const env = (k: string): string | undefined => (typeof process !== 'undefined' ? process.env?.[k] : undefined)
const b64u = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
const utf8 = (b: Uint8Array) => new TextDecoder().decode(b)

interface Jwk { kty: string; crv: string; x: string; y: string; kid?: string; alg?: string }

/** Public keys by id, fetched once and refreshed when the platform rotates them (at most every 10 seconds, so junk tokens cannot make us hammer it). */
export class JwksCache {
  private keys = new Map<string, CryptoKey>()
  private fetchedAt = 0
  constructor(private url: string, private doFetch: typeof fetch = fetch, private now: () => number = Date.now, private maxAgeMs = 5 * 60_000) {}
  private async refresh() {
    this.fetchedAt = this.now()
    const r = await this.doFetch(this.url, { headers: { accept: 'application/json' } })
    if (!r.ok) throw new ContextVerificationError(`the platform's public keys could not be fetched (HTTP ${r.status})`)
    const jwks = (await r.json()) as { keys?: Jwk[] }
    const next = new Map<string, CryptoKey>()
    for (const k of jwks.keys ?? []) {
      if (k.kty !== 'EC' || k.crv !== 'P-256' || !k.kid) continue
      next.set(k.kid, await crypto.subtle.importKey('jwk', { kty: k.kty, crv: k.crv, x: k.x, y: k.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']))
    }
    this.keys = next
  }
  async get(kid: string): Promise<CryptoKey | undefined> {
    const stale = this.now() - this.fetchedAt > this.maxAgeMs
    if (stale || (!this.keys.has(kid) && this.now() - this.fetchedAt > 10_000)) await this.refresh()
    return this.keys.get(kid)
  }
}

const caches = new Map<string, JwksCache>()
function cacheFor(url: string, f?: typeof fetch, now?: () => number): JwksCache {
  if (f || now) return new JwksCache(url, f, now) // a test or a custom fetch gets its own cache
  let c = caches.get(url)
  if (!c) caches.set(url, (c = new JwksCache(url)))
  return c
}

function jwksUrlOf(o: VerifyOptions): string {
  const u = o.jwksUrl ?? env('PLATFORM_JWKS_URL') ?? (env('PLATFORM_AUTH_URL') ? `${env('PLATFORM_AUTH_URL')!.replace(/\/$/, '')}/.well-known/jwks.json` : undefined)
  if (!u) throw new ContextVerificationError('Cannot verify the context token: set PLATFORM_AUTH_URL (or pass jwksUrl).')
  return u
}

/** Checks the token's signature against the platform's published keys, its lifetime, its issuer and that it was issued for this host. Throws ContextVerificationError. */
export async function verifyContextToken(token: string, o: VerifyOptions = {}): Promise<VerifiedContext> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new ContextVerificationError('not a token')
  let header: any, claims: any
  try { header = JSON.parse(utf8(b64u(parts[0]))); claims = JSON.parse(utf8(b64u(parts[1]))) } catch { throw new ContextVerificationError('not a token') }
  if (header.alg !== 'ES256') throw new ContextVerificationError('the token must be signed with ES256') // never "none", never a shared-secret algorithm
  if (typeof header.kid !== 'string') throw new ContextVerificationError('the token names no key')
  const now = (o.now ?? Date.now)()
  const key = await cacheFor(jwksUrlOf(o), o.fetch, o.now).get(header.kid)
  if (!key) throw new ContextVerificationError('the token was signed with a key the platform does not publish')
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  if (!ok) throw new ContextVerificationError('the token\'s signature does not verify')
  const skew = (o.clockSkewSeconds ?? 30) * 1000
  if (typeof claims.exp !== 'number' || claims.exp * 1000 + skew < now) throw new ContextVerificationError('the token has expired')
  if (typeof claims.iat === 'number' && claims.iat * 1000 - skew > now) throw new ContextVerificationError('the token is from the future')
  const issuer = o.issuer ?? env('PLATFORM_AUTH_URL')?.replace(/\/$/, '')
  if (issuer && claims.iss !== issuer) throw new ContextVerificationError('the token was issued by a different platform')
  if (!o.audience) throw new ContextVerificationError('say which host this app is served at (audience), or call context(request), which reads it from the request')
  if (claims.aud !== o.audience.toLowerCase()) throw new ContextVerificationError('the token is for a different app')
  return { ...(claims.ctx ?? {}), _claims: { iss: claims.iss, aud: claims.aud, sub: claims.sub, exp: claims.exp, iat: claims.iat, jti: claims.jti } }
}

type HeadersLike = Headers | Record<string, string | string[] | undefined> | { headers: Headers | Record<string, string | string[] | undefined> }

function getHeader(h: HeadersLike, name: string): string | undefined {
  const bag: any = 'headers' in (h as any) && typeof (h as any).headers === 'object' ? (h as any).headers : h
  if (typeof bag.get === 'function') return bag.get(name) ?? undefined
  const v = bag[name] ?? bag[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

/**
 * The verified context for a request (a fetch Request, a Node request, or just its headers), or undefined when the platform sent none
 * (running outside it). The token is verified against the Host the request arrived on. Throws if the token is there but not valid.
 */
export async function context(request: HeadersLike, o: VerifyOptions = {}): Promise<VerifiedContext | undefined> {
  const token = getHeader(request, 'x-platform-context')
  if (!token) return undefined
  const host = o.audience ?? getHeader(request, 'x-forwarded-host') ?? getHeader(request, 'host') ?? (() => { try { return new URL((request as Request).url).host } catch { return undefined } })()
  return verifyContextToken(token, { ...o, audience: host })
}

/** The headers read as a context, without verifying anything. Convenient for display and logging; never base access decisions on it. */
export function contextFromHeaders(request: HeadersLike): PlatformContext {
  const out: Record<string, Record<string, any>> = {}
  for (const [id, header] of Object.entries(CONTEXT_FIELD_HEADERS)) {
    const raw = getHeader(request, header.toLowerCase())
    if (raw === undefined || raw === '') continue
    let v: string
    try { v = decodeURIComponent(raw) } catch { v = raw }
    const [group, name] = id.split('.')
    ;(out[group] ??= {})[name] = id === 'access.scopes' ? raw.split(',').map((s) => decodeURIComponent(s)) : v
  }
  return out as PlatformContext
}

/** In the browser: the caller's context from the platform, same origin, using the session cookie. */
export async function me(o: { fetch?: typeof fetch; path?: string } = {}): Promise<PlatformContext> {
  const r = await (o.fetch ?? fetch)(o.path ?? '/__platform/me', { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`could not read who is calling (HTTP ${r.status})`)
  return (await r.json()) as PlatformContext
}

// ---- passing the context on to bindings
const als = new AsyncLocalStorage<{ token: string }>()

/** Headers to add to a call to a binding (data, AI, approvals) so it knows who is asking. Empty outside a request handled by middleware(). */
export function bindingHeaders(): Record<string, string> {
  const s = als.getStore()
  return s ? { 'X-Platform-Context': s.token } : {}
}

/** fetch() that carries the current request's context token. Use it for calls to bindings. */
export function platformFetch(input: string | URL | Request, init: RequestInit = {}, f: typeof fetch = fetch): Promise<Response> {
  const h = new Headers(init.headers)
  for (const [k, v] of Object.entries(bindingHeaders())) h.set(k, v)
  return f(input, { ...init, headers: h })
}

/**
 * Express/Connect-style middleware: verifies the token and puts the context on `req.platform`, and every platformFetch() made while the
 * request is handled carries the token. `required: true` answers 401 when there is no valid context (use it for anything not public).
 */
export function middleware(o: VerifyOptions & { required?: boolean } = {}) {
  return (req: any, res: any, next: (err?: unknown) => void) => {
    context(req, o).then((ctx) => {
      if (!ctx && o.required) { res.statusCode = 401; res.end('This app must be opened through the platform.'); return }
      req.platform = ctx
      const token = getHeader(req, 'x-platform-context')
      if (token) als.run({ token }, () => next()); else next()
    }, (e) => {
      if (o.required !== false) { res.statusCode = 401; res.end('The platform\'s context for this request could not be verified.'); return }
      next() // verification was optional and failed: carry on without a context
    })
  }
}

/**
 * Where to send an anonymous visitor to sign in, coming back to `returnTo` afterwards. Uses $PLATFORM_LOGIN_URL, which the platform sets
 * for every app (a path on the app's own address, so a redirect to it stays on the same host).
 */
export function loginUrl(returnTo = '/'): string {
  const base = env('PLATFORM_LOGIN_URL') ?? '/__platform/login'
  return `${base}${base.includes('?') ? '&' : '?'}return=${encodeURIComponent(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/')}`
}
