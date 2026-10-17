import { test } from 'node:test'
import * as assert from 'node:assert'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cronHelper, type CronMethods } from './cron.js'
import { createPlatform, type Routes } from './platform.js'
import { generatePython } from './generate-python.js'
import { spawnSync } from 'node:child_process'

function fakeMethods() {
  const syncs: any[] = []; const onces: any[] = []; const cancels: string[] = []; let failSync: (() => Error | undefined) | undefined
  const m: CronMethods = {
    async sync(b) { const e = failSync?.(); if (e) throw e; syncs.push(b); return { ok: true, schedules: [], warnings: [] } },
    async once(b) { onces.push(b); return { id: 'tm-1', name: b.name, run_at: b.at } },
    async timers() { return { timers: [] } },
    async cancel(a) { cancels.push(a.id); return { cancelled: true } },
  }
  return { m, syncs, onces, cancels, failSync: (f: typeof failSync) => { failSync = f } }
}
const env = { PLATFORM_TOKEN: 't' }
const fast = { syncDelayMs: 5, retryDelayMs: 1, env, log: () => undefined }
const sched = (id = 'job') => ({ kind: 'platform', label: 'scheduler', id })
const post = (name: string, body: unknown = {}) => new Request(`http://app.test/__platform/jobs/${name}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

test('schedules made while the app starts are sent together, once, in the argument order of node-cron', async () => {
  const f = fakeMethods(); const c = cronHelper(f.m, fast)
  c.schedule('every weekday at 9:00', async function dailyReport() {}, { timeZone: 'Asia/Kolkata', retries: 2, timeout: '10m' })
  c.schedule('0 9 * * 1-5', () => undefined, { name: 'weekly-digest', overlap: 'queue', exact: true })
  await new Promise((r) => setTimeout(r, 40))
  assert.equal(f.syncs.length, 1)
  assert.deepEqual(f.syncs[0].schedules, [
    { name: 'daily-report', when: 'every weekday at 9:00', time_zone: 'Asia/Kolkata', timeout: '10m', retries: 2 },
    { name: 'weekly-digest', when: '0 9 * * 1-5', overlap: 'queue', exact: true },
  ])
})

test('node-cron\'s spelling of the zone works too, so code moved from node-cron keeps its options', async () => {
  const f = fakeMethods(); const c = cronHelper(f.m, fast)
  c.schedule('0 9 * * *', function sendDigest() {}, { timezone: 'Europe/Paris' } as never)
  await c.sync(); assert.deepEqual(f.syncs[0].schedules, [{ name: 'send-digest', when: '0 9 * * *', time_zone: 'Europe/Paris' }])
})

test('an anonymous function with no name is refused with a plain message; a bad name too', () => {
  const c = cronHelper(fakeMethods().m, fast)
  assert.throws(() => c.schedule('every day at 8:00', () => undefined), /needs a name/)
  assert.throws(() => c.schedule('every day at 8:00', () => undefined, { name: 'Bad Name' }), /not allowed/)
})

test('a sync that fails with a server error is retried; one the platform refuses is not', async () => {
  const a = fakeMethods(); let n = 0; a.failSync(() => (++n < 3 ? Object.assign(new Error('busy'), { status: 503 }) : undefined))
  const ca = cronHelper(a.m, fast); ca.schedule('every day at 8:00', () => undefined, { name: 'x' }); await ca.sync()
  assert.equal(a.syncs.length, 1); assert.equal(n, 3)
  const b = fakeMethods(); let tries = 0; b.failSync(() => { tries++; return Object.assign(new Error('"sometimes" is not a time I understand'), { status: 400, howToFix: 'Fix it.' }) })
  const cb = cronHelper(b.m, fast); cb.schedule('sometimes', () => undefined, { name: 'y' })
  await assert.rejects(cb.sync(), /sometimes.*not a time I understand/); assert.equal(tries, 1)
})

test('without a platform token nothing is sent and the app still starts', async () => {
  const f = fakeMethods(); const lines: string[] = []; const c = cronHelper(f.m, { ...fast, env: {}, log: (l) => lines.push(l) })
  c.schedule('every day at 8:00', () => undefined, { name: 'x' }); await c.sync()
  assert.equal(f.syncs.length, 0); assert.match(lines[0], /PLATFORM_TOKEN is not set/)
})

test('once sends the time and payload; a payload over 8 KB is refused before anything is sent; cancel passes the id', async () => {
  const f = fakeMethods(); const c = cronHelper(f.m, fast)
  const t = await c.once(new Date('2026-11-01T09:00:00Z'), 'trial-ending', { userId: 7 })
  assert.equal(t.id, 'tm-1'); assert.deepEqual(f.onces[0], { name: 'trial-ending', at: '2026-11-01T09:00:00.000Z', payload: { userId: 7 } })
  await assert.rejects(c.once('2026-11-01T09:00:00Z', 'x', { big: 'x'.repeat(9000) }), /larger than 8 KB/); assert.equal(f.onces.length, 1)
  assert.deepEqual(await c.cancel('tm-1'), { cancelled: true }); assert.deepEqual(f.cancels, ['tm-1'])
})

test('the job address answers only the platform scheduler, runs the handler with the run object, and a throw is a 500 so the platform retries', async () => {
  const c = cronHelper(fakeMethods().m, { ...fast, verify: async (r) => ({ caller: JSON.parse(r.headers.get('x-test-caller') ?? 'null') ?? undefined }) })
  let seen: any
  c.schedule('every day at 8:00', (run) => { seen = run }, { name: 'daily' })
  c.on('trial-ending', () => { throw new Error('boom') })
  const as = (caller: unknown, name: string, body?: unknown) => { const r = post(name, body); r.headers.set('x-test-caller', JSON.stringify(caller)); return c.handle(r) }
  const ok = await as(sched(), 'daily', { run_id: 'r1', name: 'daily', scheduled_for: '2026-11-02T03:30:00.000Z', attempt: 2, payload: { a: 1 } })
  assert.equal(ok!.status, 200); assert.equal(seen.id, 'r1'); assert.equal(seen.attempt, 2); assert.deepEqual(seen.payload, { a: 1 }); assert.equal(seen.scheduledFor.toISOString(), '2026-11-02T03:30:00.000Z')
  assert.equal((await as({ kind: 'person' }, 'daily'))!.status, 403)
  assert.equal((await as({ kind: 'platform', label: 'approvals' }, 'daily'))!.status, 403)
  assert.equal((await as(null, 'daily'))!.status, 403)
  assert.equal((await as(sched(), 'nope'))!.status, 404)
  const origErr = console.error; console.error = () => undefined
  try { assert.equal((await as(sched(), 'trial-ending'))!.status, 500) } finally { console.error = origErr }
  assert.equal(await c.handle(new Request('http://app.test/other', { method: 'POST' })), undefined)
  assert.equal((await c.handle(new Request('http://app.test/__platform/jobs/daily', { method: 'GET' })))!.status, 405)
})

test('run mode: only the named handler runs, with its payload from the file, then the process exits 0 or 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cron-')); const file = join(dir, 'payload.json'); writeFileSync(file, JSON.stringify({ userId: 9 }))
  const runEnv = { PLATFORM_RUN: 'daily', PLATFORM_RUN_ID: 'run-7', PLATFORM_SCHEDULED_FOR: '2026-11-02T03:30:00.000Z', PLATFORM_RUN_ATTEMPT: '2', PLATFORM_RUN_PAYLOAD_FILE: file, PLATFORM_TOKEN: 't' }
  for (const [outcome, code] of [['ok', 0], ['throws', 1]] as const) {
    const f = fakeMethods(); const codes: number[] = []; let seen: any; let other = 0
    const c = cronHelper(f.m, { ...fast, env: runEnv, exit: (n) => codes.push(n) })
    c.schedule('every day at 8:00', (run) => { seen = run; if (outcome === 'throws') throw new Error('nope') }, { name: 'daily' })
    c.schedule('every day at 9:00', () => { other++ }, { name: 'other' })
    await new Promise((r) => setTimeout(r, 40))
    assert.deepEqual(codes, [code], outcome); assert.equal(other, 0); assert.equal(f.syncs.length, 0, 'run mode does not send schedules')
    assert.equal(seen.id, 'run-7'); assert.equal(seen.attempt, 2); assert.deepEqual(seen.payload, { userId: 9 })
  }
})

test('run mode for a name the code does not define exits 127 and says so', async () => {
  const lines: string[] = []; const codes: number[] = []
  cronHelper(fakeMethods().m, { ...fast, env: { PLATFORM_RUN: 'ghost' }, defineWithinMs: 20, exit: (n) => codes.push(n), log: (l) => lines.push(l) })
  await new Promise((r) => setTimeout(r, 60))
  assert.deepEqual(codes, [127]); assert.match(lines[0], /"ghost".*did not define it/)
})

test('run mode runs a handler once even if it is registered twice', async () => {
  const codes: number[] = []; let n = 0
  const c = cronHelper(fakeMethods().m, { ...fast, env: { PLATFORM_RUN: 'ghost' }, exit: (x) => codes.push(x) })
  c.on('ghost', () => { n++ }); c.on('ghost', () => { n++ })
  await new Promise((r) => setTimeout(r, 30)); assert.deepEqual(codes, [0]); assert.equal(n, 1)
})

test('createPlatform gives a declared cron binding the helper methods', () => {
  const routes: Routes = { cron: { methods: { sync: { method: 'post', path: '/cron/sync', stateChanging: true, hasBody: true }, once: { method: 'post', path: '/cron/timers', stateChanging: true, hasBody: true }, timers: { method: 'get', path: '/cron/timers' }, cancel: { method: 'delete', path: '/cron/timers/{id}', pathParams: ['id'], stateChanging: true } } } }
  const p: any = createPlatform(routes, { env: { PLATFORM_TOKEN: 't', PLATFORM_BINDINGS: '{"cron":{"url":"http://gw.test/cron"}}' }, fetch: (async () => new Response('{}')) as never })
  for (const k of ['schedule', 'on', 'once', 'cancel', 'timers', 'handle', 'express', 'sync']) assert.equal(typeof p.cron[k], 'function', k)
})

const hasPython = spawnSync('python3', ['--version']).status === 0
test('the Python client: the decorator registers, run mode exits with the right code, and handle() refuses anyone but the scheduler', { skip: hasPython ? false : 'python3 is not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'pycron-'))
  writeFileSync(join(dir, 'platform_gen.py'), generatePython([{ info: { 'x-binding': { name: 'cron', namespace: 'cron' } }, paths: {} } as never], {}).py)
  writeFileSync(join(dir, 'payload.json'), JSON.stringify({ boom: false }))
  writeFileSync(join(dir, 'app.py'), [
    'from platform_gen import Platform', 'platform = Platform()',
    '@platform.cron("0 9 * * 1-5", name="daily-report", time_zone="Asia/Kolkata")', 'def daily_report(run):', '    print("RAN", run["id"], run["attempt"], run["payload"])',
    '    if run["payload"] and run["payload"].get("boom"): raise RuntimeError("boom")',
    'print(platform.cron.handle("daily-report", {"run_id": "r"}, {"kind": "platform", "label": "scheduler"})[0], platform.cron.handle("daily-report", {}, {"kind": "person"})[0], platform.cron.handle("x", {}, {"kind": "platform", "label": "scheduler"})[0])',
  ].join('\n'))
  const py = (e: Record<string, string>) => spawnSync('python3', ['-I', '-c', 'import sys; sys.path.insert(0, sys.argv[1]); exec(open(sys.argv[1] + "/app.py").read()); import time; time.sleep(0.6)', dir], { env: { PATH: process.env.PATH ?? '', ...e }, encoding: 'utf8' })
  const web = py({}); assert.match(web.stdout, /^200 403 404/m)
  const ok = py({ PLATFORM_RUN: 'daily-report', PLATFORM_RUN_ID: 'run-1', PLATFORM_RUN_ATTEMPT: '3', PLATFORM_RUN_PAYLOAD_FILE: join(dir, 'payload.json') })
  assert.equal(ok.status, 0); assert.match(ok.stdout, /RAN run-1 3 \{'boom': False\}/)
  writeFileSync(join(dir, 'payload.json'), JSON.stringify({ boom: true }))
  assert.equal(py({ PLATFORM_RUN: 'daily-report', PLATFORM_RUN_PAYLOAD_FILE: join(dir, 'payload.json') }).status, 1)
  assert.equal(py({ PLATFORM_RUN: 'ghost', PLATFORM_RUN_DEFINE_WITHIN: '0.1' }).status, 127)
})
