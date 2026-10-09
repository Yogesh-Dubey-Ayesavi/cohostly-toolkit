// The Python client: one self-contained file (platform_gen.py) generated from the same OpenAPI documents as the TypeScript one. Standard library only
// (urllib), so there is nothing to install. It has the same behaviour as the TypeScript runtime: the token, a request id, an idempotency key kept across
// retries, timeouts, retries on 429 and 502 to 504, and a structured PlatformError.
import { createHash } from 'node:crypto'
import type { BindingsMap, OpenApiDoc } from './generate.js'

type Schema = Record<string, any>
const pascal = (t: string) => t.split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join('')
const PY_KIND: Record<string, string> = { string: 'str', number: 'float', boolean: 'bool', datetime: 'str', bytes: 'str', json: 'Any' }
const lit = (v: unknown) => JSON.stringify(v)

class Emitter {
  classes: string[] = []
  seen = new Set<string>()
  /** A TypedDict for an object schema. Required and optional keys are split into two classes, which works on every supported Python version. */
  object(name: string, s: Schema, doc: OpenApiDoc): string {
    if (this.seen.has(name)) return name
    this.seen.add(name)
    const props = Object.entries<Schema>(s.properties ?? {}); const req = new Set<string>(s.required ?? [])
    const mk = (cls: string, pairs: [string, Schema][], total: boolean) => `class ${cls}(${total ? 'TypedDict' : 'TypedDict, total=False'}):\n${pairs.map(([k, v]) => `    ${/^[A-Za-z_]\w*$/.test(k) ? k : `# ${k}`}: ${this.type(v, name + pascal(k), doc)}`).join('\n') || '    pass'}`
    const required = props.filter(([k]) => req.has(k)), optional = props.filter(([k]) => !req.has(k))
    if (!props.length) { this.classes.push(`${name} = Dict[str, Any]`); return name }
    if (optional.length && required.length) { this.classes.push(mk(`_${name}Required`, required, true)); this.classes.push(`${mk(`_${name}Optional`, optional, false)}`); this.classes.push(`class ${name}(_${name}Required, _${name}Optional):\n    pass`) }
    else this.classes.push(mk(name, props, required.length > 0))
    return name
  }
  type(s: Schema | undefined, hint: string, doc: OpenApiDoc): string {
    if (!s || !Object.keys(s).length || (Object.keys(s).length === 1 && s.description)) return 'Any'
    if (s.$ref) { const n = String(s.$ref).split('/').pop()!; const t = doc.components?.schemas?.[n]; if (t && !this.seen.has(n)) this.declared(n, t, doc); return n }
    if (s.enum) return `Literal[${s.enum.map(lit).join(', ')}]`
    switch (s.type) {
      case 'string': return 'str'
      case 'integer': return 'int'
      case 'number': return 'float'
      case 'boolean': return 'bool'
      case 'array': return `List[${this.type(s.items, hint + 'Item', doc)}]`
      case 'object':
        if (s.properties) return this.object(hint, s, doc)
        return s.additionalProperties === true || !s.additionalProperties ? 'Dict[str, Any]' : `Dict[str, ${this.type(s.additionalProperties, hint + 'Value', doc)}]`
      default: return 'Any'
    }
  }
  declared(name: string, s: Schema, doc: OpenApiDoc) {
    if (s.type === 'object' && s.properties) this.object(name, s, doc)
    else if (!this.seen.has(name)) { this.seen.add(name); this.classes.push(`${name} = ${this.type(s, name, doc)}`) }
  }
}

const RUNTIME = `
class PlatformError(Exception):
    """Everything the platform refuses or fails at. \`how_to_fix\` says what to do."""

    def __init__(self, status: int, code: str, message: str, how_to_fix: str, request_id: Optional[str] = None):
        super().__init__(message)
        self.status, self.code, self.message, self.how_to_fix, self.request_id = status, code, message, how_to_fix, request_id


class _Core:
    def __init__(self, env: Optional[Dict[str, str]] = None, timeout: float = 30.0, retries: int = 2, headers: Optional[Dict[str, str]] = None):
        self.env = env if env is not None else dict(os.environ)
        self.timeout, self.retries, self.extra = timeout, retries, headers or {}

    def _base(self) -> str:
        try:
            first = next(iter(json.loads(self.env.get("PLATFORM_BINDINGS", "{}")).values()))["url"]
            return first.rstrip("/").rsplit("/", 1)[0]
        except (StopIteration, KeyError, ValueError):
            for k in ("AI_BASE_URL", "APPROVALS_URL", "DATA_URL"):
                if self.env.get(k):
                    return self.env[k].rstrip("/").rsplit("/", 1)[0]
        raise PlatformError(0, "not_configured", "This code is not running with platform bindings.", "Run it on the platform, or locally with \`platform dev -- <command>\`.")

    def call(self, method: str, path: str, body: Any = None, query: Optional[Dict[str, str]] = None, state_changing: bool = False, headers: Optional[Dict[str, str]] = None) -> Any:
        token = self.env.get("PLATFORM_TOKEN")
        if not token:
            raise PlatformError(0, "not_configured", "PLATFORM_TOKEN is not set.", "Run on the platform, or locally with \`platform dev -- <command>\`.")
        url = self._base() + path + ("?" + urllib.parse.urlencode(query) if query else "")
        request_id = str(uuid.uuid4())
        hdrs = {"x-platform-binding-token": token, "x-request-id": request_id, "accept": "application/json", **self.extra, **(headers or {})}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            hdrs["content-type"] = "application/json"
        if state_changing:
            hdrs["idempotency-key"] = str(uuid.uuid4())  # one key for every attempt of this call
        safe = method == "GET" or state_changing
        last: Optional[PlatformError] = None
        for attempt in range(self.retries + 1):
            try:
                req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
                with urllib.request.urlopen(req, timeout=self.timeout) as res:
                    text = res.read().decode()
                    return json.loads(text) if text else None
            except urllib.error.HTTPError as e:
                try:
                    err = json.loads(e.read().decode()).get("error", {})
                except ValueError:
                    err = {}
                last = PlatformError(e.code, err.get("code", "error"), err.get("message", f"The platform answered {e.code}."), err.get("how_to_fix", "Try again in a moment."), e.headers.get("x-request-id") or request_id)
                if not (e.code in (429, 502, 503, 504) and safe) or attempt == self.retries:
                    raise last
                try:
                    wait = float(e.headers.get("retry-after") or 0)
                except ValueError:
                    wait = 0.0
                time.sleep(min(5.0, wait or 0.2 * 2 ** attempt))
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = PlatformError(0, "network_error", str(e), "Check the connection and try again.", request_id)
                if not safe or attempt == self.retries:
                    raise last
                time.sleep(0.2 * 2 ** attempt)
        raise last  # type: ignore[misc]
`

/** platform_gen.py for a project: only the bindings its manifest declared. */
export function generatePython(docs: OpenApiDoc[], map: BindingsMap = {}): { py: string; fingerprint: string } {
  const em = new Emitter()
  const sorted = [...docs].sort((a, b) => a.info['x-binding'].name.localeCompare(b.info['x-binding'].name))
  const classes: string[] = []; const members: string[] = []
  for (const doc of sorted) {
    const b = doc.info['x-binding']; const info = map[b.name]
    for (const [n, s] of Object.entries<Schema>(doc.components?.schemas ?? {})) if (n !== 'Error') em.declared(n, b.name === 'ai' && n === 'AiMessagesRequest' && info?.models?.length ? { ...s, properties: { ...s.properties, model: { type: 'string', enum: info.models } } } : s, doc)
    if (b.name === 'data') {
      const models = doc['x-models'] ?? {}
      const names = Object.keys(models).sort()
      for (const t of names) {
        const P = pascal(t); const f = models[t].fields
        const row = f.map((x) => `    ${x.name}: ${x.optional ? `Optional[${PY_KIND[x.kind] ?? 'Any'}]` : PY_KIND[x.kind] ?? 'Any'}`).join('\n')
        const need = f.filter((x) => !x.optional && !x.has_default), rest = f.filter((x) => x.optional || x.has_default)
        em.classes.push(`class ${P}(TypedDict):\n${row}`)
        if (need.length && rest.length) { em.classes.push(`class _${P}CreateRequired(TypedDict):\n${need.map((x) => `    ${x.name}: ${PY_KIND[x.kind] ?? 'Any'}`).join('\n')}`); em.classes.push(`class ${P}Create(_${P}CreateRequired, total=False):\n${rest.map((x) => `    ${x.name}: ${PY_KIND[x.kind] ?? 'Any'}`).join('\n')}`) }
        else em.classes.push(`class ${P}Create(TypedDict${need.length ? '' : ', total=False'}):\n${f.map((x) => `    ${x.name}: ${PY_KIND[x.kind] ?? 'Any'}`).join('\n') || '    pass'}`)
        em.classes.push(`class ${P}Update(TypedDict, total=False):\n${f.map((x) => `    ${x.name}: ${PY_KIND[x.kind] ?? 'Any'}`).join('\n') || '    pass'}`)
      }
      classes.push(`class _Table(Generic[Row, Create, Update]):
    def __init__(self, core: _Core, model: str, headers: Optional[Dict[str, str]] = None):
        self._c, self._m, self._h = core, model, headers

    def _get(self, op: str, args: Any) -> Any:
        return self._c.call("GET", f"/data/api/model/{self._m}/{op}", query={"q": json.dumps(args or {})}, headers=self._h)["data"]

    def _send(self, method: str, op: str, args: Any) -> Any:
        if method == "DELETE":
            return self._c.call("DELETE", f"/data/api/model/{self._m}/{op}", query={"q": json.dumps(args or {})}, state_changing=True, headers=self._h)["data"]
        return self._c.call(method, f"/data/api/model/{self._m}/{op}", body=args or {}, state_changing=True, headers=self._h)["data"]

    def find_many(self, where: Optional[Dict[str, Any]] = None, order_by: Optional[Dict[str, str]] = None, take: Optional[int] = None, skip: Optional[int] = None) -> List[Row]:
        return self._get("findMany", {k: v for k, v in {"where": where, "orderBy": order_by, "take": take, "skip": skip}.items() if v is not None})

    def find_first(self, where: Optional[Dict[str, Any]] = None) -> Optional[Row]:
        return self._get("findFirst", {"where": where} if where else {})

    def find_unique(self, where: Dict[str, Any]) -> Optional[Row]:
        return self._get("findUnique", {"where": where})

    def count(self, where: Optional[Dict[str, Any]] = None) -> int:
        return self._get("count", {"where": where} if where else {})

    def create(self, data: Create) -> Row:
        return self._send("POST", "create", {"data": data})

    def create_many(self, data: List[Create]) -> Dict[str, int]:
        return self._send("POST", "createMany", {"data": data})

    def update(self, where: Dict[str, Any], data: Update) -> Row:
        return self._send("PATCH", "update", {"where": where, "data": data})

    def update_many(self, data: Update, where: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
        return self._send("PATCH", "updateMany", {"where": where or {}, "data": data})

    def delete(self, where: Dict[str, Any]) -> Row:
        return self._send("DELETE", "delete", {"where": where})

    def delete_many(self, where: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
        return self._send("DELETE", "deleteMany", {"where": where or {}})`)
      const tables = (hdr: string) => names.map((t) => `        self.${t} = _Table[${pascal(t)}, ${pascal(t)}Create, ${pascal(t)}Update](core, ${lit(t)}${hdr})`).join('\n') || '        pass'
      classes.push(`class _DataApp:
    """The app itself, with no row policies. For background jobs and other trusted code, never for work done on a visitor's behalf."""

    def __init__(self, core: _Core):
        self._c = core
${names.map((t) => `        self.${t} = _Table[${pascal(t)}, ${pascal(t)}Create, ${pascal(t)}Update](core, ${lit(t)}, {"x-platform-authority": "app"})`).join('\n')}

    def sql(self, sql: str, args: Optional[List[Any]] = None) -> DataSqlResult:
        return self._c.call("POST", "/data/sql", body={"sql": sql, "args": args or []}, state_changing=True, headers={"x-platform-authority": "app"})


class _Data:
    def __init__(self, core: _Core):
${tables('')}
        self.app = _DataApp(core)`)
      members.push('data: _Data')
      continue
    }
    const keyed = b.keyed; const keys = keyed ? Object.keys(info?.names ?? {}) : []
    const cls = `_${pascal(b.namespace)}`
    const methods: string[] = []
    for (const [p, item] of Object.entries<any>(doc.paths ?? {})) for (const [m, op] of Object.entries<any>(item)) {
      const params = (op.parameters ?? []).filter((x: any) => x.in === 'path' && !(keyed && x.name === 'name'))
      const body = op.requestBody?.content?.['application/json']?.schema
      const bt = body ? em.type(body, pascal(op.operationId) + 'Body', doc) : undefined
      const res = em.type(op.responses?.['200']?.content?.['application/json']?.schema, pascal(op.operationId) + 'Result', doc)
      const args = [...params.map((x: any) => `${x.name}: str`), ...(bt ? [`body: ${bt}`] : [])]
      const pathExpr = 'f' + lit(p.replace(/\{(\w+)\}/g, '{$1}')).replace(/\{name\}/, keyed ? '{self._name}' : '{name}')
      methods.push(`    def ${op.operationId}(self${args.length ? ', ' + args.join(', ') : ''}) -> ${res}:\n        """${(op.summary ?? '').replace(/"""/g, "'")}"""\n        return self._c.call(${lit(m.toUpperCase())}, ${pathExpr}${bt ? ', body=body' : ''}${op['x-state-changing'] ? ', state_changing=True' : ''})`)
    }
    classes.push(`class ${cls}:\n    def __init__(self, core: _Core${keyed ? ', name: str' : ''}):\n        self._c = core\n${keyed ? '        self._name = name\n' : ''}\n${methods.join('\n\n') || '    pass'}`)
    if (keyed) { classes.push(`class ${cls}Group:\n    def __init__(self, core: _Core):\n${keys.map((k) => `        self.${/^\w+$/.test(k) ? k : '_' + k} = ${cls}(core, ${lit(k)})`).join('\n') || '        pass'}`); members.push(`${b.namespace}: ${cls}Group`) } else members.push(`${b.namespace}: ${cls}`)
  }
  const ctor = sorted.map((d) => { const b = d.info['x-binding']; return `        self.${b.namespace} = ${b.name === 'data' ? '_Data' : `_${pascal(b.namespace)}${b.keyed ? 'Group' : ''}`}(core)` }).join('\n') || '        pass'
  const hasData = sorted.some((d) => d.info['x-binding'].name === 'data')
  const body = `from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar, TypedDict
${hasData ? '\nRow = TypeVar("Row")\nCreate = TypeVar("Create")\nUpdate = TypeVar("Update")\n' : ''}
${RUNTIME}

${em.classes.join('\n\n\n')}


${classes.join('\n\n\n')}


class Platform:
    """Only the bindings declared in the manifest exist here."""

    def __init__(self, env: Optional[Dict[str, str]] = None, timeout: float = 30.0, retries: int = 2, _headers: Optional[Dict[str, str]] = None):
        core = _Core(env, timeout, retries, _headers)
        self._core = core
${ctor}

    def as_caller(self, context_token: str) -> "Platform":
        """The same client, forwarding the signed context of the request being handled, so row policies apply to that visitor."""
        return Platform(self._core.env, self._core.timeout, self._core.retries, {**self._core.extra, "x-platform-context": context_token})


platform = Platform()
`
  const fingerprint = createHash('sha256').update(body).digest('hex').slice(0, 16)
  return { py: `# platform_gen.py: generated by \`platform types --lang python\` from this project's declared bindings. Do not edit; it is regenerated when the manifest changes.\n# contract: ${fingerprint}\n${body}`, fingerprint }
}
