// platform.cron: schedules and one-off timers (Phase 13B). The platform owns the clock, because a sandbox that is paused runs nothing: this file only tells the platform what to run
// and runs it when the platform calls. It takes its arguments in the same order as node-cron (`schedule(when, handler, options)`), so moving from a timer library is an import change.
//   - schedule(when, handler, { name, timeZone, ... })  registers a schedule. All of them are sent to the platform together, once, shortly after start-up.
//   - on(name, handler) + once(at, name, payload)       a handler for one-off timers, and a timer that calls it at a time you choose (the payload is at most 8 KB).
//   - handle(request) / express()                        the address the platform calls (POST /__platform/jobs/<name>); only the platform may reach it.
//   - run mode: when PLATFORM_RUN=<name> is set (a script with no server), only that handler runs, then the process exits 0 on success and 1 when it throws.
import { readFileSync } from 'node:fs'
import { context } from './context.js'

export const JOB_PREFIX = '/__platform/jobs/'
export const MAX_TIMER_PAYLOAD_BYTES = 8192

export interface Run { id: string; name: string; scheduledFor: Date; attempt: number; payload: any }
export type CronHandler = (run: Run) => unknown | Promise<unknown>
export interface ScheduleOptions {
  /** The schedule's identity across versions. Required unless the handler is a named function. */
  name?: string
  /** An IANA zone such as "Asia/Kolkata". Left out, the platform uses the owner's profile zone and shows it. */
  timeZone?: string
  /** node-cron's spelling of timeZone, so code moved from node-cron keeps its options. */
  timezone?: string
  timeout?: string | number
  overlap?: 'skip' | 'queue' | 'allow'
  retries?: number
  misfire?: string | number
  catchUp?: 'latest'
  /** A fresh sandbox for each run (the default for stateless projects). */
  freshSandbox?: boolean
  /** No random 0 to 60 seconds of jitter. */
  exact?: boolean
}

/** The generated methods of the cron binding. */
export interface CronMethods {
  sync(body: { version?: number; schedules: unknown[] }): Promise<{ ok: boolean; schedules?: unknown[]; warnings?: string[] }>
  once(body: { name: string; at: string; payload?: unknown }): Promise<{ id: string; name?: string; run_at?: string }>
  timers(): Promise<{ timers: unknown[] }>
  cancel(args: { id: string }): Promise<{ cancelled: boolean }>
}

export interface CronApi {
  schedule(when: string, handler: CronHandler, options?: ScheduleOptions): void
  on(name: string, handler: CronHandler): void
  once(at: Date | string, name: string, payload?: unknown): Promise<{ id: string }>
  /** The generated form, one object, is accepted too. */
  once(body: { name: string; at: string; payload?: unknown }): Promise<{ id: string; name?: string; run_at?: string }>
  cancel(id: string): Promise<{ cancelled: boolean }>
  cancel(args: { id: string }): Promise<{ cancelled: boolean }>
  timers(): Promise<{ timers: unknown[] }>
  /** Sends the registered schedules now. It runs by itself shortly after start-up; call it only to wait for it (for example in a test). Given a body of schedules it sends exactly those (the generated form). */
  sync(): Promise<void>
  sync(body: { version?: number; schedules: unknown[] }): Promise<{ ok: boolean; schedules?: unknown[]; warnings?: string[] }>
  /** Fetch style: a Request in, a Response out, or undefined when the path is not a job (let the rest of your app answer). */
  handle(req: Request): Promise<Response | undefined>
  /** Express / Connect style. Calls next() for anything that is not a job. */
  express(): (req: any, res: any, next: (e?: unknown) => void) => void
}

export interface CronOptions {
  env?: Record<string, string | undefined>
  /** How to verify the caller. Defaults to the SDK's own check of the platform's signed context. */
  verify?: (req: any) => Promise<{ caller?: { kind?: string; label?: string } } | undefined>
  /** For tests: the milliseconds to wait before the first sync and between retries. */
  syncDelayMs?: number
  retryDelayMs?: number
  /** Run mode: how long the code has to define the handler it was started for. Default 30000. */
  defineWithinMs?: number
  exit?: (code: number) => void
  log?: (line: string) => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/

export function cronHelper(m: CronMethods, o: CronOptions = {}): CronApi {
  const env = o.env ?? process.env
  const log = o.log ?? ((l: string) => console.error(l))
  const exit = o.exit ?? ((c: number) => process.exit(c))
  const schedules = new Map<string, { def: Record<string, unknown>; handler: CronHandler }>()
  const handlers = new Map<string, CronHandler>()
  const verify = o.verify ?? ((r: any) => context(r))
  const runMode = env.PLATFORM_RUN || undefined
  let syncTimer: NodeJS.Timeout | undefined
  let synced: Promise<void> | undefined
  let ran = false

  function nameFor(handler: CronHandler, options: ScheduleOptions): string {
    const n = options.name ?? (handler.name && handler.name !== 'handler' ? handler.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() : '')
    if (!n) throw new Error('platform.cron.schedule needs a name: the name is the schedule\'s identity across versions. Pass { name: "daily-report" }, or use a named function.')
    if (!NAME.test(n)) throw new Error(`The schedule name "${n}" is not allowed: use lower-case letters, digits, "." "_" and "-", up to 64 characters.`)
    return n
  }

  function register(name: string) {
    if (runMode === name) setImmediate(() => void runOnce())
    if (!runMode) scheduleSync()
  }

  function scheduleSync() {
    if (syncTimer || synced) return
    // Every schedule() call made while the app starts is collected, then sent together.
    syncTimer = setTimeout(() => { syncTimer = undefined; void doSync().catch((e) => log(`platform.cron: ${e instanceof Error ? e.message : String(e)}`)) }, o.syncDelayMs ?? 250)
    syncTimer.unref?.()
  }

  async function doSync(): Promise<void> {
    if (!env.PLATFORM_TOKEN) { log('platform.cron: PLATFORM_TOKEN is not set, so the schedules were not sent. They run only on the platform (or with `platform dev`).'); return }
    if (!schedules.size) { if (env.PLATFORM_SYNC_ONLY) exit(0); return }
    const body = { schedules: [...schedules.values()].map((s) => s.def) }
    let last: unknown
    for (let attempt = 0; attempt < 6; attempt++) {
      try { const r = await m.sync(body); for (const w of r.warnings ?? []) log(`platform.cron: ${w}`); if (env.PLATFORM_SYNC_ONLY) exit(0); return } catch (e) {
        last = e
        const status = (e as { status?: number }).status
        if (status !== undefined && status >= 400 && status < 500 && status !== 429) break // a mistake in the schedules does not get better by waiting
        await sleep((o.retryDelayMs ?? 1000) * 2 ** attempt)
      }
    }
    const e = last as { message?: string; howToFix?: string }
    throw new Error(`the schedules could not be sent to the platform: ${e?.message ?? String(last)}${e?.howToFix ? ` ${e.howToFix}` : ''}`)
  }

  const runFrom = (b: any, headers?: Headers): Run => ({
    id: String(b?.run_id ?? headers?.get('x-platform-run-id') ?? ''), name: String(b?.name ?? ''), scheduledFor: new Date(String(b?.scheduled_for ?? headers?.get('x-platform-scheduled-for') ?? '')),
    attempt: Number(b?.attempt) || 1, payload: b?.payload ?? null,
  })
  const find = (name: string) => schedules.get(name)?.handler ?? handlers.get(name)

  async function runOnce() {
    if (ran) return; ran = true
    const name = runMode!
    let payload: unknown = null
    try { if (env.PLATFORM_RUN_PAYLOAD_FILE) payload = JSON.parse(readFileSync(env.PLATFORM_RUN_PAYLOAD_FILE, 'utf8')) } catch { /* no payload */ }
    const fn = find(name)
    if (!fn) { log(`platform.cron: this run is for "${name}", but the code defines no schedule or handler with that name.`); return exit(127) }
    try {
      await fn({ id: env.PLATFORM_RUN_ID ?? '', name, scheduledFor: new Date(env.PLATFORM_SCHEDULED_FOR ?? Date.now()), attempt: Number(env.PLATFORM_RUN_ATTEMPT) || 1, payload })
      exit(0)
    } catch (e) { log(`platform.cron: "${name}" failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`); exit(1) }
  }
  if (runMode) {
    // The code has until it registers the handler to define it; a run for a name that never appears fails clearly instead of hanging.
    const t = setTimeout(() => { if (!ran && !find(runMode)) { ran = true; log(`platform.cron: this run is for "${runMode}", but the code did not define it within ${Math.round((o.defineWithinMs ?? 30_000) / 1000)} seconds of starting.`); exit(127) } }, o.defineWithinMs ?? 30_000)
    t.unref?.()
  }

  async function handle(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith(JOB_PREFIX)) return undefined
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (req.method !== 'POST') return json(405, { error: 'Scheduled jobs are POST requests.' })
    let ctx
    try { ctx = await verify(req) } catch { return json(401, { error: 'The request context could not be verified.' }) }
    // Only the platform's scheduler may call a job. A visitor or a program that guessed the path gets nothing.
    if (!ctx || ctx.caller?.kind !== 'platform' || ctx.caller?.label !== 'scheduler') return json(403, { error: 'This address is for the platform, not for visitors.' })
    const name = decodeURIComponent(url.pathname.slice(JOB_PREFIX.length).split('/')[0] ?? '')
    const fn = find(name)
    if (!fn) return json(404, { error: `This app has no schedule or timer handler called "${name}".` })
    let body: unknown = {}
    try { const t = await req.text(); body = t ? JSON.parse(t) : {} } catch { return json(400, { error: 'The body is not valid JSON.' }) }
    try { await fn(runFrom(body, req.headers)); return json(200, { ok: true }) }
    catch (e) { console.error(`job ${name} failed: ${e instanceof Error ? e.message : String(e)}`); return json(500, { error: 'The handler failed.' }) }
  }

  return {
    schedule(when, handler, options = {}) {
      const name = nameFor(handler, options)
      if (schedules.has(name) && !runMode) log(`platform.cron: the schedule "${name}" is defined twice; the later one wins.`)
      schedules.set(name, {
        handler,
        def: {
          name, when, ...((options.timeZone ?? options.timezone) ? { time_zone: options.timeZone ?? options.timezone } : {}), ...(options.timeout !== undefined ? { timeout: options.timeout } : {}), ...(options.overlap ? { overlap: options.overlap } : {}),
          ...(options.retries !== undefined ? { retries: options.retries } : {}), ...(options.misfire !== undefined ? { misfire: options.misfire } : {}), ...(options.catchUp ? { catch_up: options.catchUp } : {}),
          ...(options.freshSandbox !== undefined ? { fresh_sandbox: options.freshSandbox } : {}), ...(options.exact !== undefined ? { exact: options.exact } : {}),
        },
      })
      register(name)
    },
    on(name, handler) { handlers.set(name, handler); register(name) },
    async once(at: any, name?: any, payload?: any): Promise<any> {
      if (at && typeof at === 'object' && !(at instanceof Date)) return m.once(at)   // the generated form: one object
      const when = at instanceof Date ? at.toISOString() : String(at)
      if (payload !== undefined && Buffer.byteLength(JSON.stringify(payload)) > MAX_TIMER_PAYLOAD_BYTES) throw new Error(`The timer's payload is larger than 8 KB. Keep an id in the payload and look the rest up when the timer fires.`)
      const t = await m.once({ name, at: when, ...(payload !== undefined ? { payload } : {}) })
      return { id: t.id }
    },
    cancel: (id: any) => m.cancel(typeof id === 'string' ? { id } : id),
    timers: () => m.timers(),
    async sync(body?: any): Promise<any> {
      if (body && typeof body === 'object' && Array.isArray(body.schedules)) return m.sync(body)   // the generated form: send exactly these
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = undefined }
      return (synced = doSync())
    },
    handle,
    express() {
      return (req, res, next) => {
        if (!String(req.url ?? '').startsWith(JOB_PREFIX)) return next()
        const chunks: Buffer[] = []
        const run = async (raw?: Buffer) => {
          const host = req.headers?.host ?? 'localhost'
          const r = new Request(`http://${host}${req.url}`, { method: req.method, headers: Object.entries(req.headers ?? {}).filter(([, v]) => typeof v === 'string') as [string, string][], body: req.method === 'POST' ? (req.body !== undefined ? JSON.stringify(req.body) : raw ? new Uint8Array(raw) : undefined) : undefined })
          const out = await handle(r)
          if (!out) return next()
          res.statusCode = out.status; res.setHeader('content-type', 'application/json'); res.end(await out.text())
        }
        if (req.body !== undefined) run().catch(next)
        else { req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => run(Buffer.concat(chunks)).catch(next)); req.on('error', next) }
      }
    },
  }
}
