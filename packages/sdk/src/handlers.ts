// Calls in: the platform calls the app (an approval was answered, later a scheduled job). They arrive on a reserved path with the platform's signed context
// (caller.kind = platform). This checks that, then hands the payload to the handler the app registered. A handler for something that was never declared does
// not compile (the generated `Handlers` type), and a request that is not from the platform never reaches one.
import { context, type VerifiedContext } from './context.js'

export const HOOK_PREFIX = '/__platform/hooks/'

export type HookTable = Record<string, string[]>

export interface MountOptions {
  /** How to verify the request's context. Defaults to the SDK's own verification (the platform's published keys). */
  verify?: (request: any) => Promise<Pick<VerifiedContext, 'caller'> | undefined>
}

type Handler = (payload: any, ctx: any) => unknown | Promise<unknown>

/** A fetch-style handler: give it a Request, get a Response, or undefined when the path is not a platform hook (let the rest of your app answer). */
export function mountHandlers(handlers: Record<string, Record<string, Handler> | undefined>, table: HookTable, o: MountOptions = {}) {
  const verify = o.verify ?? ((r: any) => context(r))
  async function handle(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith(HOOK_PREFIX)) return undefined
    const [binding, name] = url.pathname.slice(HOOK_PREFIX.length).split('/')
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (req.method !== 'POST') return json(405, { error: 'Platform hooks are POST requests.' })
    let ctx
    try { ctx = await verify(req) } catch { return json(401, { error: 'The request context could not be verified.' }) }
    // Only the platform itself may call a hook. A person or a program that guessed the path gets nothing.
    if (!ctx || ctx.caller?.kind !== 'platform') return json(403, { error: 'This address is for the platform, not for visitors.' })
    if (!table[binding]?.includes(name)) return json(404, { error: `There is no hook ${binding}/${name}.` })
    const fn = handlers[binding]?.[name]
    if (!fn) return json(501, { error: `This app has no handler for ${binding}/${name}.` })
    let payload: unknown
    try { payload = await req.json() } catch { return json(400, { error: 'The body is not valid JSON.' }) }
    try { await fn(payload, ctx); return json(200, { ok: true }) } catch (e) { console.error(`hook ${binding}/${name} failed: ${e instanceof Error ? e.message : String(e)}`); return json(500, { error: 'The handler failed.' }) }
  }
  /** Express / Connect style: calls next() for anything that is not a hook. */
  const express = (req: any, res: any, next: (e?: unknown) => void) => {
    if (!String(req.url ?? '').startsWith(HOOK_PREFIX)) return next()
    const chunks: Buffer[] = []
    const run = async (raw: Buffer | undefined) => {
      const host = req.headers?.host ?? 'localhost'
      const r = new Request(`http://${host}${req.url}`, { method: req.method, headers: Object.entries(req.headers ?? {}).filter(([, v]) => typeof v === 'string') as [string, string][], body: req.method === 'POST' ? (req.body !== undefined ? JSON.stringify(req.body) : raw ? new Uint8Array(raw) : undefined) : undefined })
      const out = await handle(r)
      if (!out) return next()
      res.statusCode = out.status; res.setHeader('content-type', 'application/json'); res.end(await out.text())
    }
    if (req.body !== undefined) run(undefined).catch(next)
    else { req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => run(Buffer.concat(chunks)).catch(next)); req.on('error', next) }
  }
  return { handle, express }
}
