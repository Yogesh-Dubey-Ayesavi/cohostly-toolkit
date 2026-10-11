// The approvals helper: `platform.approvals.request({...})` returns a handle that can wait for the decision, be told about it, or be cancelled.
// It sits on the generated methods (the HTTP is the same), and adds the two ways a decision arrives: polling with backoff (`wait`, survives anything) and
// the platform's callback (`callback`, which wakes the app if it was asleep). Polling is never the only path, and the callback may arrive more than once,
// so handlers must be safe to repeat.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { context } from './context.js'
import { PlatformError } from './platform.js'

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled'
export interface ApprovalRecord {
  id: string; status: ApprovalStatus; summary?: string; action?: string; risk?: string; details_hash?: string
  created_at?: string; expires_at?: string; decided_at?: string; decision_note?: string; approvals?: number; required?: number
  callback?: { path: string; status: string }
}
/** What the platform sends to the callback path. */
export interface ApprovalDecision { id: string; status: 'approved' | 'denied' | 'expired'; action?: string; details_hash: string; decided_at?: string; decision_note?: string; approvals?: number; required?: number }
export type DecisionHandler = (decision: ApprovalDecision) => void | Promise<void>

export interface ApprovalRequestInput {
  /** One plain sentence saying what will happen if this is approved. The approver reads it exactly as written. */
  summary: string
  /** The facts the approver should see (up to 16 KiB). Shown as written. */
  details?: Record<string, unknown>
  risk?: 'low' | 'medium' | 'high'
  /** A short key such as "delete_rows". The project's rules and blocks can target it. */
  action?: string
  /** Seconds until it expires (60 to 604800). Default 24 hours. */
  expiresIn?: number
}
export interface WaitOptions { timeoutMs?: number; signal?: AbortSignal; /** First poll delay, default 1000. It doubles up to maxDelayMs. */ firstDelayMs?: number; maxDelayMs?: number }

export interface ApprovalHandle extends ApprovalRecord {
  /** Polls until the approval is decided, expires or is cancelled (backoff 1 s up to 15 s). Throws `wait_timeout` if `timeoutMs` (default 15 minutes) passes first: the approval is still pending, so wait again or use the callback. */
  wait(o?: WaitOptions): Promise<ApprovalRecord>
  refresh(): Promise<ApprovalRecord>
  cancel(): Promise<ApprovalRecord>
  /** Runs when the platform's callback for THIS approval arrives (needs `platform.approvals.callback()` mounted at the registered path). In memory only: after a restart, use `platform.approvals.onDecision`. */
  onDecision(handler: DecisionHandler): ApprovalHandle
}

export interface CallbackHandler {
  /** Fetch style: give it a Request, get a Response. Mount it at the path in `bindings.approvals.callback_path` (or let `mountHandlers` serve /__platform/hooks/approvals/decision). */
  handle(req: Request): Promise<Response>
  /** Express / Connect style. */
  express(req: any, res: any, next?: (e?: unknown) => void): void
}
export interface CallbackOptions { handler?: DecisionHandler; verify?: (req: Request) => Promise<{ caller?: { kind?: string } } | undefined>; now?: () => number }

export interface ApprovalsApi {
  request(input: ApprovalRequestInput, o?: { idempotencyKey?: string }): Promise<ApprovalHandle>
  get(args: { id: string }): Promise<ApprovalRecord>
  cancel(args: { id: string }): Promise<ApprovalRecord>
  /** Polls an approval you only have the id of (after a restart, say). */
  wait(id: string, o?: WaitOptions): Promise<ApprovalRecord>
  /** Runs for every decision the callback receives, whichever approval it is for. Register it once at startup. */
  onDecision(handler: DecisionHandler): () => void
  /** The verified callback endpoint. It checks the request is from the platform (signed context) and that the body is untampered (HMAC), then runs the handlers. A handler that throws makes the platform retry. */
  callback(o?: CallbackOptions): CallbackHandler
  signingKey(): Promise<{ key: string; algorithm: string; header: string; tolerance_seconds: number }>
}

// ---- signature
const mac = (key: string, t: number, id: string, status: string, hash: string) => createHmac('sha256', key).update(`${t}.${id}.${status}.${hash}`).digest('hex')
/** Does X-Approval-Signature match this decision? `t=<unix seconds>,v1=<hmac over t.id.status.details_hash>`, within 5 minutes. */
export function verifyDecisionSignature(key: string, header: string | null | undefined, d: Pick<ApprovalDecision, 'id' | 'status' | 'details_hash'>, nowMs = Date.now(), toleranceSec = 300): boolean {
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? '')
  if (!m || Math.abs(nowMs / 1000 - Number(m[1])) > toleranceSec) return false
  return timingSafeEqual(Buffer.from(m[2], 'hex'), Buffer.from(mac(key, Number(m[1]), d.id, d.status, d.details_hash), 'hex'))
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new PlatformError(0, 'aborted', 'The wait was cancelled.', 'Call wait again when you need the decision.')) }, { once: true })
})

/** Wraps the generated approvals methods. `m` are the methods the route table produced (request, get, cancel, signingKey). */
export function approvalsHelper(m: Record<string, (...a: any[]) => Promise<any>>, requestWithKey: (body: unknown, key?: string) => Promise<ApprovalRecord>): ApprovalsApi {
  const perId = new Map<string, DecisionHandler[]>()
  const global = new Set<DecisionHandler>()
  let keyCache: { value: Awaited<ReturnType<ApprovalsApi['signingKey']>>; at: number } | undefined
  const signingKey = async () => {
    if (keyCache && Date.now() - keyCache.at < 3_600_000) return keyCache.value
    const value = await m.signingKey(); keyCache = { value, at: Date.now() }; return value
  }
  const get = (args: { id: string }): Promise<ApprovalRecord> => m.get(args)
  const wait = async (id: string, o: WaitOptions = {}): Promise<ApprovalRecord> => {
    const deadline = Date.now() + (o.timeoutMs ?? 15 * 60_000)
    let delay = o.firstDelayMs ?? 1000
    for (;;) {
      const a = await get({ id })
      if (a.status !== 'pending') return a
      if (Date.now() + delay > deadline) throw new PlatformError(0, 'wait_timeout', `The approval ${id} is still pending after waiting.`, 'It is not lost: wait again with platform.approvals.wait(id), or register platform.approvals.callback() to be told when it is decided.')
      await sleep(delay, o.signal)
      delay = Math.min(o.maxDelayMs ?? 15_000, delay * 2)
    }
  }
  const handle = (a: ApprovalRecord): ApprovalHandle => ({
    ...a,
    wait: (o) => wait(a.id, o),
    refresh: () => get({ id: a.id }),
    cancel: () => m.cancel({ id: a.id }),
    onDecision(h) { perId.set(a.id, [...(perId.get(a.id) ?? []), h]); return this },
  })

  return {
    async request(input, o) {
      const { expiresIn, ...rest } = input
      const body = { ...rest, ...(expiresIn !== undefined ? { expires_in: expiresIn } : {}) }
      return handle(await requestWithKey(body, o?.idempotencyKey))
    },
    get, cancel: (args) => m.cancel(args), wait, signingKey,
    onDecision(h) { global.add(h); return () => global.delete(h) },
    callback(o = {}) {
      if (o.handler) global.add(o.handler)
      const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
      const verify = o.verify ?? ((r: Request) => context(r as never) as never)
      const handle = async (req: Request): Promise<Response> => {
        if (req.method !== 'POST') return json(405, { error: 'The approvals callback is a POST.' })
        let ctx: Awaited<ReturnType<typeof verify>>
        try { ctx = await verify(req) } catch { return json(401, { error: 'The request context could not be verified.' }) }
        if (!ctx || ctx.caller?.kind !== 'platform') return json(403, { error: 'This address is for the platform, not for visitors.' })
        let d: ApprovalDecision
        try { d = await req.json() } catch { return json(400, { error: 'The body is not valid JSON.' }) }
        if (!d || typeof d.id !== 'string' || typeof d.status !== 'string' || typeof d.details_hash !== 'string') return json(400, { error: 'This is not an approval decision.' })
        try {
          const { key } = await signingKey()
          if (!verifyDecisionSignature(key, req.headers.get('x-approval-signature'), d, (o.now ?? Date.now)())) return json(401, { error: 'The signature does not match, so the decision was ignored.' })
        } catch { return json(503, { error: 'The signing key could not be fetched; the platform will retry.' }) }
        try {
          for (const h of [...(perId.get(d.id) ?? []), ...global]) await h(d)
          perId.delete(d.id)
        } catch (e) { console.error(`approval handler for ${d.id} failed: ${e instanceof Error ? e.message : String(e)}`); return json(500, { error: 'The handler failed; the platform will retry.' }) }
        return json(200, { ok: true })
      }
      const express = (req: any, res: any, next?: (e?: unknown) => void) => {
        const chunks: Buffer[] = []
        const run = async (raw?: Buffer) => {
          const r = new Request(`http://${req.headers?.host ?? 'localhost'}${req.url}`, { method: req.method, headers: Object.entries(req.headers ?? {}).filter(([, v]) => typeof v === 'string') as [string, string][], body: req.method === 'POST' ? (req.body !== undefined ? JSON.stringify(req.body) : raw ? new Uint8Array(raw) : undefined) : undefined })
          const out = await handle(r)
          res.statusCode = out.status; res.setHeader('content-type', 'application/json'); res.end(await out.text())
        }
        const fail = (e: unknown) => (next ? next(e) : (res.statusCode = 500, res.end()))
        if (req.body !== undefined) run().catch(fail)
        else { req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => run(Buffer.concat(chunks)).catch(fail)); req.on('error', fail) }
      }
      return { handle, express }
    },
  }
}
