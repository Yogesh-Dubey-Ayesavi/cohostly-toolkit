// Type generation. Reads the OpenAPI documents the gateway serves (one per declared binding) and writes a typed `platform.gen.ts` plus a
// plain-language `platform.contract.md`. Only the bindings a project declared exist on `platform`. No dependencies: it runs inside the npm SDK.
import { createHash } from 'node:crypto'
import { CONTEXT_FIELD_INFO } from './context-fields.generated.js'

type Schema = Record<string, any>

/** The part of an OpenAPI 3.1 document this generator reads. The gateway adds `info['x-binding']`. */
export interface OpenApiDoc {
  info: { title: string; description?: string; 'x-binding': { name: string; namespace: string; keyed: boolean; kind: string } }
  paths?: Record<string, Record<string, any>>
  /** The data binding adds the project's own tables (from its migrations) so they can be typed. */
  'x-models'?: Record<string, { fields: { name: string; kind: string; optional: boolean; id: boolean; has_default: boolean }[]; policies: string[] }>
  webhooks?: Record<string, Record<string, any>>
  components?: { schemas?: Record<string, Schema> }
}

/** PLATFORM_BINDINGS: the addresses and the project-specific facts (allowed AI models, connection names) the manifest fixes. */
export type BindingsMap = Record<string, { url: string; kind?: string; models?: string[]; names?: Record<string, { url?: string; provider?: string; permissions?: string[] }> }>

const ident = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s))
const wrap = (t: string) => (/[|{]/.test(t) ? `(${t})` : t)

/** JSON Schema to a TypeScript type. No `any`: payloads the owner defines are `unknown`. */
export function tsType(s: Schema | undefined, indent = ''): string {
  if (!s || Object.keys(s).length === 0 || (Object.keys(s).length === 1 && s.description)) return 'unknown'
  if (s.$ref) return String(s.$ref).split('/').pop()!
  if (s.enum) return s.enum.map((v: unknown) => JSON.stringify(v)).join(' | ')
  if (s.oneOf || s.anyOf) return (s.oneOf ?? s.anyOf).map((x: Schema) => tsType(x, indent)).join(' | ')
  switch (s.type) {
    case 'string': return 'string'
    case 'integer': case 'number': return 'number'
    case 'boolean': return 'boolean'
    case 'array': return `${wrap(tsType(s.items, indent))}[]`
    case 'object': {
      const props = Object.entries<Schema>(s.properties ?? {})
      const extra = s.additionalProperties === true ? 'unknown' : s.additionalProperties && typeof s.additionalProperties === 'object' ? tsType(s.additionalProperties, indent) : undefined
      if (!props.length) return extra ? `Record<string, ${extra}>` : 'Record<string, never>'
      const req = new Set<string>(s.required ?? [])
      const inner = indent + '  '
      const lines = props.map(([k, v]) => `${inner}${ident(k)}${req.has(k) ? '' : '?'}: ${tsType(v, inner)};`)
      if (extra) lines.push(`${inner}[key: string]: ${extra};`)
      return `{\n${lines.join('\n')}\n${indent}}`
    }
    default: return 'unknown'
  }
}


const pascal = (t: string) => t.split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join('')
const TS_KIND: Record<string, string> = { string: 'string', number: 'number', boolean: 'boolean', datetime: 'string', bytes: 'string', json: 'unknown' }

/** Row, create, update and filter types for one table, from the columns the migrations made. */
function tableTypes(table: string, m: NonNullable<OpenApiDoc['x-models']>[string]): string {
  const P = pascal(table)
  const row = m.fields.map((f) => `  ${ident(f.name)}: ${TS_KIND[f.kind] ?? 'unknown'}${f.optional ? ' | null' : ''};`).join('\n')
  const create = m.fields.map((f) => `  ${ident(f.name)}${f.optional || f.has_default ? '?' : ''}: ${TS_KIND[f.kind] ?? 'unknown'}${f.optional ? ' | null' : ''};`).join('\n')
  return `/** One row of ${table}. */\nexport interface ${P} {\n${row}\n}\nexport interface ${P}Create {\n${create}\n}\nexport type ${P}Update = Partial<${P}Create>;\nexport type ${P}Where = { [K in keyof ${P}]?: Filter<${P}[K]> } & { AND?: ${P}Where[]; OR?: ${P}Where[]; NOT?: ${P}Where };`
}

const TABLE_HELPERS = `type Filter<T> = T | { equals?: T; not?: T; in?: T[]; notIn?: T[]; lt?: T; lte?: T; gt?: T; gte?: T; contains?: string; startsWith?: string; endsWith?: string };
export interface Table<Row, Create, Update, Where> {
  /** At most 1000 rows; 100 unless you say take. */
  findMany(args?: { where?: Where; orderBy?: { [K in keyof Row]?: 'asc' | 'desc' }; take?: number; skip?: number }): Promise<Row[]>;
  findFirst(args?: { where?: Where; orderBy?: { [K in keyof Row]?: 'asc' | 'desc' } }): Promise<Row | null>;
  findUnique(args: { where: Partial<Row> }): Promise<Row | null>;
  count(args?: { where?: Where }): Promise<number>;
  create(args: { data: Create }): Promise<Row>;
  createMany(args: { data: Create[] }): Promise<{ count: number }>;
  update(args: { where: Partial<Row>; data: Update }): Promise<Row>;
  updateMany(args: { where?: Where; data: Update }): Promise<{ count: number }>;
  delete(args: { where: Partial<Row> }): Promise<Row>;
  deleteMany(args?: { where?: Where }): Promise<{ count: number }>;
}`

interface Method { name: string; route: Record<string, unknown>; sig: string; doc: string }

function methodsOf(doc: OpenApiDoc, keyed: boolean): Method[] {
  const out: Method[] = []
  for (const [p, item] of Object.entries(doc.paths ?? {})) {
    for (const [m, op] of Object.entries<any>(item)) {
      if (op['x-sdk'] === false) continue // the stock provider endpoints are for provider SDKs, not the typed client
      const params = (op.parameters ?? []).filter((x: any) => x.in === 'path' && !(keyed && x.name === 'name'))
      const hasBody = !!op.requestBody
      const args: string[] = []
      if (params.length) args.push(`params: { ${params.map((x: any) => `${ident(x.name)}: ${tsType(x.schema)}`).join('; ')} }`)
      if (hasBody) args.push(`body${op.requestBody.required === false || (keyed && !op.requestBody.required) ? '?' : ''}: ${tsType(op.requestBody.content['application/json'].schema)}`)
      out.push({
        name: op.operationId,
        route: { method: m, path: p, ...(op['x-state-changing'] ? { stateChanging: true } : {}), ...(params.length ? { pathParams: params.map((x: any) => x.name) } : {}), ...(hasBody ? { hasBody: true } : {}) },
        sig: `(${args.join(', ')}): Promise<${tsType(op.responses?.['200']?.content?.['application/json']?.schema)}>`,
        doc: op.summary ?? '',
      })
    }
  }
  return out
}

/** The AI model list in the manifest narrows the `model` field to exactly those names. */
function narrow(doc: OpenApiDoc, info?: BindingsMap[string]): OpenApiDoc {
  if (doc.info['x-binding'].name !== 'ai' || !info?.models?.length) return doc
  const copy: OpenApiDoc = JSON.parse(JSON.stringify(doc))
  const req = copy.components?.schemas?.AiMessagesRequest
  if (req?.properties?.model) req.properties.model = { type: 'string', enum: info.models }
  return copy
}

export interface ProjectContract {
  declared: string[]
  /** platform.gen.ts */
  ts: string
  /** platform.contract.md */
  markdown: string
  /** Fingerprint of the contract. `platform types --check` compares it with the file in the project. */
  fingerprint: string
}

const HEADER = (fp: string) => `// platform.gen.ts: generated by \`platform types\` from this project's declared bindings. Do not edit; it is regenerated when the manifest changes.\n// contract: ${fp}\n`

export interface ContextSettings { preset?: string; expose?: string[] }
const PRESET_RANK: Record<string, number> = { none: 0, basic: 1, friendly: 2, full: 3 }

/** The context type for a manifest's settings: only the fields it can ever receive, and caller.kind as a union the compiler makes you handle. */
function contextTypes(c: ContextSettings = {}): { ts: string; summary: string } {
  const preset = c.preset && c.preset in PRESET_RANK ? c.preset : 'basic'
  const expose = new Set(c.expose ?? [])
  const groups = new Map<string, string[]>()
  const names: string[] = []
  for (const f of CONTEXT_FIELD_INFO) {
    if (!(f.always || PRESET_RANK[f.fromPreset] <= PRESET_RANK[preset] || expose.has(f.id))) continue
    const [g, n] = f.id.split('.')
    const t = f.id === 'caller.kind' ? "'person' | 'machine' | 'anonymous' | 'platform'" : f.list ? 'string[]' : 'string'
    const optional = f.id === 'caller.kind' || f.id === 'request.id' ? '' : '?'
    ;(groups.get(g) ?? groups.set(g, []).get(g)!).push(`    /** ${f.label.replace(/\*\//g, '')} */\n    ${n}${optional}: ${t};`)
    names.push(f.id)
  }
  const body = [...groups].map(([g, lines]) => `  ${g}: {\n${lines.join('\n')}\n  };`).join('\n')
  return {
    ts: `/** What this app is told about whoever is calling, under its manifest's context settings (preset "${preset}"${expose.size ? `, plus ${[...expose].join(', ')}` : ''}). A field the manifest never sends is not here, so using it does not compile. */\nexport interface Context {\n${body}\n}\n\n/** The verified context of a request (an Express request, a fetch Request or its headers), or undefined when the platform sent none. */\nexport const context = (request: Parameters<typeof verifiedContext>[0]) => verifiedContext(request) as unknown as Promise<Context | undefined>;`,
    summary: `## platform.context(request)\n\nUnder the "${preset}" preset${expose.size ? ` plus ${[...expose].join(', ')}` : ''} the app can read: ${names.join(', ')}.\n\nSwitch on \`caller.kind\` (person, machine, anonymous or platform) before using the rest.\n`,
  }
}

/** The typed module for one project. `docs` are the OpenAPI documents of the declared bindings; `map` is PLATFORM_BINDINGS. */
export function generateProject(docs: OpenApiDoc[], map: BindingsMap = {}, context?: ContextSettings): ProjectContract {
  const ctx = contextTypes(context)
  const sorted = [...docs].sort((a, b) => a.info['x-binding'].name.localeCompare(b.info['x-binding'].name))
  const schemaDecls: string[] = []
  const hooks: Record<string, { name: string; body: string; doc: string }[]> = {}
  const routes: Record<string, unknown> = {}
  const members: string[] = []
  const usesClients = new Set<string>()
  const md: string[] = ['# Platform contract', '', 'This file lists what `platform` can do in this project. It is generated from the bindings this project declares; run `platform types` again after you change `bindings` in the manifest.', '']

  for (const raw of sorted) {
    const b = raw.info['x-binding']
    const info = map[b.name]
    const doc = narrow(raw, info)
    for (const [n, s] of Object.entries<Schema>(doc.components?.schemas ?? {})) if (n !== 'Error') schemaDecls.push(`export type ${n} = ${tsType(s)};`)
    if (b.name === 'data') {
      // The project's tables, typed from its migrations. Callers are policy-checked; `$app` is the app acting as itself (background work, trusted code).
      const models = doc['x-models'] ?? {}
      const names = Object.keys(models).sort()
      for (const t of names) schemaDecls.push(tableTypes(t, models[t]))
      routes.data = { tables: names, methods: {} }
      const tbl = (t: string) => `${ident(t)}: Table<${pascal(t)}, ${pascal(t)}Create, ${pascal(t)}Update, ${pascal(t)}Where>;`
      members.push(`  data: {\n${names.map((t) => '    ' + tbl(t)).join('\n')}${names.length ? '\n' : ''}    /** The app itself, with no row policies. For background jobs and other trusted code, never for work done on a visitor's behalf. */\n    $app: {\n${names.map((t) => '      ' + tbl(t)).join('\n')}${names.length ? '\n' : ''}      /** One SELECT, INSERT, UPDATE or DELETE. Schema changes belong in migrations. */\n      sql(body: DataSql): Promise<DataSqlResult>;\n    };\n  };`)
      md.push(`## platform.data`, '', doc.info.description ?? '', '')
      if (!names.length) md.push('This project has no tables yet. Add migrations under `migrations/` and deploy.', '')
      for (const t of names) { md.push(`### platform.data.${t}`, '', `Columns: ${models[t].fields.map((f) => `${f.name} (${f.kind}${f.optional ? ', optional' : ''})`).join(', ')}.`, '', ...models[t].policies.map((p) => `- ${p}`), '') }
      md.push('Calls are checked against each table\'s row policies for the visitor whose request your app is handling. `platform.data.$app` is for the app\'s own work and is not.', '')
      continue
    }
    for (const [n, item] of Object.entries<any>(doc.webhooks ?? {})) for (const op of Object.values<any>(item)) (hooks[b.name] ??= []).push({ name: op.operationId ?? n, body: tsType(op.requestBody?.content?.['application/json']?.schema), doc: op.summary ?? '' })
    const keys = b.keyed ? Object.keys(info?.names ?? {}) : undefined
    const ms = methodsOf(doc, !!b.keyed)
    routes[b.name] = { ...(keys ? { keys } : {}), methods: Object.fromEntries(ms.map((m) => [m.name, m.route])) }
    const iface = `{\n${ms.map((m) => `    /** ${m.doc} */\n    ${m.name}${m.sig};`).join('\n')}\n  }`
    // A connection also hands out its provider's official client (GoogleConnection.google, MicrosoftConnection.microsoft).
    const clientsOf = (k: string) => { if (b.name !== 'connections') return ''; const p = info?.names?.[k]?.provider; if (p === 'google') { usesClients.add('GoogleConnection'); return ' & GoogleConnection'; } if (p === 'microsoft') { usesClients.add('MicrosoftConnection'); return ' & MicrosoftConnection'; } return ''; };
    members.push(b.name === 'approvals' ? '  approvals: ApprovalsApi;' : b.name === 'cron' ? '  cron: CronApi;' : keys ? `  ${b.namespace}: {\n${keys.map((k) => `    ${ident(k)}: ${iface.replace(/\n/g, '\n  ')}${clientsOf(k)};`).join('\n')}\n  };` : `  ${b.namespace}: ${iface};`)

    md.push(`## platform.${b.namespace}`, '', doc.info.description ?? '', '')
    if (b.name === 'connections') for (const k of keys ?? []) {
      const p = info?.names?.[k]?.provider
      if (p === 'google') md.push(`- \`platform.connections.${k}.google(factory, options)\`: an official Google client through this connection, for example \`google(gmail, { version: 'v1' })\` with \`import { gmail } from '@googleapis/gmail'\`. Every function and type is Google's own.`)
      if (p === 'microsoft') md.push(`- \`platform.connections.${k}.microsoft(graphSdk, kiota)\`: the official typed Microsoft Graph client through this connection, with \`import * as graphSdk from '@microsoft/msgraph-sdk'\` and \`import * as kiota from '@microsoft/kiota-http-fetchlibrary'\`.`)
    }
    for (const m of ms) md.push(`- \`platform.${b.namespace}.${keys ? `<${keys.join(' | ')}>.` : ''}${m.name}${m.sig.replace(/: Promise<.*>$/s, '')}\`: ${m.doc}`)
    if (b.name === 'ai' && info?.models?.length) md.push('', `Allowed models: ${info.models.join(', ')}.`)
    md.push('', 'Errors come back as `PlatformError` with `code`, `message` and `howToFix`.', '')
  }
  if (!sorted.length) md.push('No bindings are declared. Add one under `bindings` in the manifest (ai, approvals, data or connections), deploy, then run `platform types`.', '')

  const hasData = declaredHasData(sorted)
  for (const b of Object.keys(hooks)) md.push(`## The platform calls your app: ${b}`, '', ...hooks[b].map((h) => `- \`${h.name}\`: ${h.doc} Handle it with mountHandlers({ ${b}: { ${h.name}(payload, ctx) {} } }).`), '')
  md.push(ctx.summary)
  const hookBindings = Object.keys(hooks)
  const hooksTs = hookBindings.length ? `\n\n/** What the platform calls in to. Give a binding's handlers all together: leaving one out does not compile. */\nexport interface Handlers {\n${hookBindings.map((b) => `  ${b}?: {\n${hooks[b].map((h) => `    /** ${h.doc} */\n    ${h.name}(payload: ${h.body}, ctx: Context): void | Promise<void>;`).join('\n')}\n  };`).join('\n')}\n}\n\n/** Mount the handlers in your server: \`app.use(mountHandlers({ approvals: { decision } }).express)\`. Anything that is not a platform hook falls through to your own routes. */\nexport const mountHandlers = (handlers: Handlers) => mountHooks(handlers as never, ${JSON.stringify(Object.fromEntries(hookBindings.map((b) => [b, hooks[b].map((h) => h.name)])))});` : ''
  const core = `import { createPlatform, context as verifiedContext, mountHandlers as mountHooks, type Routes${sorted.some((d) => d.info['x-binding'].name === 'approvals') ? ', type ApprovalsApi' : ''}${sorted.some((d) => d.info['x-binding'].name === 'cron') ? ', type CronApi' : ''}${[...usesClients].sort().map((t) => `, type ${t}`).join('')} } from '@cohostly/sdk';\n\n${hasData ? TABLE_HELPERS + '\n\n' : ''}export const routes = ${JSON.stringify(routes, null, 2)} as const satisfies Routes;\n\n${schemaDecls.join('\n\n')}\n\n${ctx.ts}\n\nexport interface Platform {\n${members.join('\n')}\n  context: typeof context;\n}\n\n/** Only the bindings declared in the manifest exist here. */\nexport const platform: Platform = Object.assign(createPlatform<Omit<Platform, 'context'>>(routes as unknown as Routes), { context });\nexport default platform;${hooksTs}\n`
  const fingerprint = createHash('sha256').update(core).digest('hex').slice(0, 16)
  return { declared: sorted.map((d) => d.info['x-binding'].name), ts: HEADER(fingerprint) + core, markdown: md.join('\n'), fingerprint }
}

const declaredHasData = (docs: OpenApiDoc[]) => docs.some((d) => d.info['x-binding'].name === 'data')

/** Does a platform.gen.ts in the project still match what the declared bindings produce? The text must match exactly. */
export function checkGenerated(fresh: ProjectContract, existing: string | undefined): { ok: boolean; reason?: string } {
  if (existing === undefined) return { ok: false, reason: 'platform.gen.ts is missing. Run `platform types`.' }
  if (existing === fresh.ts) return { ok: true }
  const fp = /^(?:\/\/|#) contract: ([0-9a-f]{16})$/m.exec(existing)?.[1]
  return { ok: false, reason: fp === fresh.fingerprint ? 'platform.gen.ts was edited by hand. Run `platform types` to restore it.' : 'platform.gen.ts is older than the declared bindings. Run `platform types`.' }
}
