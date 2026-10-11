// The `platform` object. The methods are not written by hand: `platform types` generates a route table from the project's declared bindings
// and this runtime turns it into callable, typed methods. It owns the token, request ids, idempotency keys, timeouts and retries,
// so an app (or an AI assistant writing one) never writes HTTP by hand. Underneath it is plain HTTP to the binding's address.
import { randomUUID } from 'node:crypto'
import { bindingHeaders } from './context.js'
import { approvalsHelper } from './approvals.js'

/** One callable method: where it goes and how its arguments map onto the request. */
export interface Route {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** The path with {name} placeholders, for example /approvals/{id}. */
  path: string
  /** State-changing calls carry an Idempotency-Key, the same one on every retry. */
  stateChanging?: boolean
  /** The path placeholders the caller fills (the rest, such as {name} of a keyed binding, come from the key). */
  pathParams?: string[]
  hasBody?: boolean
}
export interface BindingRoutes {
  /** The data binding: the project's table names. Each gets findMany, create and the rest, sent to /data/api/model/<table>/<operation>. */
  tables?: string[]
  /** Environment variable that holds this binding's address, when it has one for the whole binding. */
  url?: string
  /** A keyed binding (connections) has one client per key. */
  keys?: string[]
  methods: Record<string, Route>
}
export type Routes = Record<string, BindingRoutes>

export class PlatformError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly howToFix: string, readonly requestId?: string) {
    super(message)
    this.name = 'PlatformError'
  }
}

export interface PlatformOptions {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  /** Per-attempt timeout in milliseconds. Default 30000. */
  timeoutMs?: number
  /** Extra attempts after the first for network errors, 429 and 502-504. Default 2. */
  retries?: number
}

// ZenStack's strict HTTP methods: reads are GET with the query as JSON in `q`; the others send the arguments as the body (DELETE uses `q` too).
const TABLE_OPS: Record<string, { method: Route['method']; how: 'q' | 'body'; unwrap?: boolean }> = {
  findMany: { method: 'get', how: 'q' }, findFirst: { method: 'get', how: 'q' }, findUnique: { method: 'get', how: 'q' }, count: { method: 'get', how: 'q' },
  create: { method: 'post', how: 'body' }, createMany: { method: 'post', how: 'body' },
  update: { method: 'patch', how: 'body' }, updateMany: { method: 'patch', how: 'body' },
  delete: { method: 'delete', how: 'q' }, deleteMany: { method: 'delete', how: 'q' },
}

const RETRY_STATUS = new Set([429, 502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function baseFor(env: Record<string, string | undefined>): string {
  // PLATFORM_BINDINGS holds every address as JSON; the gateway root is the parent of any one of them.
  try {
    const map = JSON.parse(env.PLATFORM_BINDINGS ?? '{}') as Record<string, { url: string }>
    const first = Object.values(map)[0]?.url
    if (first) return first.replace(/\/[^/]*\/?$/, '')
  } catch { /* fall through */ }
  const url = env.AI_BASE_URL ?? env.APPROVALS_URL ?? env.DATA_URL
  if (url) return url.replace(/\/[^/]*$/, '')
  throw new PlatformError(0, 'not_configured', 'This code is not running with platform bindings.', 'Run it on the platform, or locally with `platform dev -- <command>`.')
}

async function call(o: Required<Pick<PlatformOptions, 'timeoutMs' | 'retries'>> & { f: typeof fetch; env: Record<string, string | undefined> }, route: Route, path: string, body: unknown, extra: Record<string, string> = {}): Promise<unknown> {
  const token = o.env.PLATFORM_TOKEN
  if (!token) throw new PlatformError(0, 'not_configured', 'PLATFORM_TOKEN is not set.', 'Run on the platform, or locally with `platform dev -- <command>`.')
  const url = baseFor(o.env) + path
  const requestId = randomUUID()
  const headers: Record<string, string> = { 'x-platform-binding-token': token, 'x-request-id': requestId, accept: 'application/json', ...bindingHeaders(), ...extra }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (route.stateChanging && !headers['idempotency-key']) headers['idempotency-key'] = randomUUID() // one key for every attempt of this call (the caller may bring its own)
  const safeToRepeat = route.method === 'get' || !!route.stateChanging

  let last: PlatformError | undefined
  for (let attempt = 0; attempt <= o.retries; attempt++) {
    try {
      const res = await o.f(url, { method: route.method.toUpperCase(), headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(o.timeoutMs) })
      const text = await res.text()
      let data: any
      try { data = text ? JSON.parse(text) : undefined } catch { data = undefined }
      if (res.ok) return data
      const e = data?.error
      last = new PlatformError(res.status, e?.code ?? 'error', e?.message ?? `The platform answered ${res.status}.`, e?.how_to_fix ?? 'Try again in a moment.', res.headers.get('x-request-id') ?? requestId)
      if (!(RETRY_STATUS.has(res.status) && safeToRepeat) || attempt === o.retries) throw last
      await sleep(Math.min(5000, Number(res.headers.get('retry-after')) * 1000 || 200 * 2 ** attempt))
    } catch (e) {
      if (e instanceof PlatformError) throw e
      last = new PlatformError(0, 'network_error', e instanceof Error ? e.message : String(e), 'Check the connection and try again.', requestId)
      if (!safeToRepeat || attempt === o.retries) throw last
      await sleep(200 * 2 ** attempt)
    }
  }
  throw last!
}

function methodFor(opts: Parameters<typeof call>[0], route: Route, fill: Record<string, string>) {
  return async (...args: unknown[]) => {
    let i = 0
    const values: Record<string, string> = { ...fill }
    if (route.pathParams?.length) Object.assign(values, args[i++] as Record<string, string>)
    const body = route.hasBody ? args[i] : undefined
    const path = route.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(values[k] ?? '')))
    return call(opts, route, path, body)
  }
}

/** Builds the `platform` object from a generated route table. Only the declared bindings are in the table, so only they exist. */
export function createPlatform<T>(routes: Routes, options: PlatformOptions = {}): T {
  const opts = { f: options.fetch ?? fetch, env: options.env ?? process.env, timeoutMs: options.timeoutMs ?? 30_000, retries: options.retries ?? 2 }
  const out: Record<string, unknown> = {}
  for (const [name, b] of Object.entries(routes)) {
    if (b.tables) {
      const tables = (extra: Record<string, string>) => Object.fromEntries(b.tables!.map((t) => [t, Object.fromEntries(Object.entries(TABLE_OPS).map(([op, d]) => [op, async (args: unknown = {}) => {
        const route: Route = { method: d.method, path: `/data/api/model/${t}/${op}`, stateChanging: d.method !== 'get' }
        const withQ = d.how === 'q'
        const r = (await call(opts, route, route.path + (withQ ? `?q=${encodeURIComponent(JSON.stringify(args))}` : ''), withQ ? undefined : args, extra)) as { data: unknown }
        return r?.data
      }]))]))
      out[name] = { ...tables({}), $app: { ...tables({ 'x-platform-authority': 'app' }), sql: (body: unknown) => call(opts, { method: 'post', path: '/data/sql', stateChanging: true, hasBody: true }, '/data/sql', body, { 'x-platform-authority': 'app' }) } }
      continue
    }
    const make = (fill: Record<string, string>) => Object.fromEntries(Object.entries(b.methods).map(([m, r]) => [m, methodFor(opts, r, fill)]))
    const methods = b.keys ? undefined : make({})
    if (name === 'approvals' && methods && b.methods.request) {
      // The request/wait/callback helper sits on the generated methods. Its request call can carry the caller's own Idempotency-Key.
      const reqRoute = b.methods.request
      out[name] = { ...methods, ...approvalsHelper(methods as never, (body, key) => call(opts, reqRoute, reqRoute.path, body, key ? { 'idempotency-key': key } : {}) as never) }
      continue
    }
    out[name] = b.keys ? Object.fromEntries(b.keys.map((k) => [k, make({ name: k })])) : methods
  }
  return out as T
}
