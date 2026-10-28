// `platform types`: fetch the OpenAPI document of each declared binding from the gateway and write platform.gen.ts and platform.contract.md.
import fs from 'node:fs'
import path from 'node:path'
import { generatePython } from './generate-python.js'
import { generateProject, checkGenerated, type BindingsMap, type OpenApiDoc, type ProjectContract } from './generate.js'

export interface TypesOptions {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  /** Directory to write into (default: the current directory). */
  out?: string
  /** Do not write: fail when the files in `out` are out of date. */
  check?: boolean
  /** typescript (default) writes platform.gen.ts; python writes platform_gen.py, a single file that needs nothing installed. */
  lang?: 'typescript' | 'python'
}

export async function fetchDocs(o: Pick<TypesOptions, 'env' | 'fetch'> = {}): Promise<{ docs: OpenApiDoc[]; map: BindingsMap; context?: { preset?: string; expose?: string[] } }> {
  const env = o.env ?? process.env
  const f = o.fetch ?? fetch
  const token = env.PLATFORM_TOKEN
  if (!token) throw new Error('PLATFORM_TOKEN is not set. Run it on the platform, or locally with `platform dev -- platform types`.')
  const map = JSON.parse(env.PLATFORM_BINDINGS ?? '{}') as BindingsMap
  let context: { preset?: string; expose?: string[] } | undefined
  try { context = env.PLATFORM_CONTEXT ? JSON.parse(env.PLATFORM_CONTEXT) : undefined } catch { /* the default preset applies */ }
  const docs: OpenApiDoc[] = []
  for (const [name, b] of Object.entries(map)) {
    const res = await f(`${b.url.replace(/\/$/, '')}/openapi.json`, { headers: { 'x-platform-binding-token': token, accept: 'application/json' } })
    if (!res.ok) throw new Error(`Could not read the "${name}" contract (${res.status}). ${(await res.text()).slice(0, 200)}`)
    docs.push((await res.json()) as OpenApiDoc)
  }
  return { docs, map, context }
}

export async function fetchContract(o: Pick<TypesOptions, 'env' | 'fetch'> = {}): Promise<ProjectContract> {
  const { docs, map, context } = await fetchDocs(o)
  return generateProject(docs, map, context)
}

/** Returns the exit code and a message for the person running it. */
export async function runTypes(o: TypesOptions = {}): Promise<{ code: number; message: string }> {
  const out = o.out ?? process.cwd()
  let c: ProjectContract; let py: string | undefined
  try {
    const { docs, map, context } = await fetchDocs(o)
    c = generateProject(docs, map, context)
    if (o.lang === 'python') py = generatePython(docs, map).py
  } catch (e) { return { code: 1, message: e instanceof Error ? e.message : String(e) } }
  const tsFile = path.join(out, py ? 'platform_gen.py' : 'platform.gen.ts')
  if (o.check) {
    const r = py ? checkGenerated({ ...c, ts: py }, fs.existsSync(tsFile) ? fs.readFileSync(tsFile, 'utf8') : undefined) : checkGenerated(c, fs.existsSync(tsFile) ? fs.readFileSync(tsFile, 'utf8') : undefined)
    const nameOf = (t: string) => (py ? t.replace(/platform\.gen\.ts/g, 'platform_gen.py') : t)
    return r.ok ? { code: 0, message: nameOf('platform.gen.ts is up to date.') } : { code: 1, message: nameOf(r.reason!) }
  }
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(tsFile, py ?? c.ts)
  fs.writeFileSync(path.join(out, 'platform.contract.md'), c.markdown)
  const name = py ? 'platform_gen.py' : 'platform.gen.ts'
  return { code: 0, message: c.declared.length ? `Wrote ${name} and platform.contract.md for: ${c.declared.join(', ')}.` : `Wrote ${name}. No bindings are declared yet.` }
}
