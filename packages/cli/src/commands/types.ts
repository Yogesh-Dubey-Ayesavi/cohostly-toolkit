import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runTypes } from '@cohostly/sdk';
import { findManifestFile } from '../manifest-file.js';

// `platform types --project <name> [--check] [--out dir]`: writes platform.gen.ts (the typed `platform` object) and platform.contract.md into the project.
// It makes a short-lived dev token, asks the gateway for the OpenAPI document of each binding the project declared, generates the types from those documents
// on this computer, and ends the token. `--check` writes nothing and fails when the files are older than the manifest (use it in CI and before deploy).

/** What the contract WOULD be for this folder's manifest and migrations, asked of the platform without deploying anything. */
export async function localPreview(apiUrl: string, dir: string, manifestText?: string): Promise<{ typescript: string; python: string; summary: string; fingerprint: string; declared: string[] }> {
  const manifest = manifestText ?? (findManifestFile(dir)?.text ?? '{}');
  const md = path.join(dir, 'migrations');
  const migrations = fs.existsSync(md) ? fs.readdirSync(md).filter((f) => f.endsWith('.sql') && !f.startsWith('.')).sort().map((name) => ({ name, sql: fs.readFileSync(path.join(md, name), 'utf8') })) : [];
  const r = await fetch(`${apiUrl}/v1/contract-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ manifest_content: manifest, migrations }) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(j.error ?? `Could not work out the contract (HTTP ${r.status}).`);
  return j;
}

/** For `platform deploy`: an empty string when platform.gen.ts matches what this folder would produce, otherwise what to do. */
export async function staleTypesMessage(apiUrl: string, dir: string, manifestText?: string): Promise<string> {
  const file = path.join(dir, 'platform.gen.ts');
  if (!fs.existsSync(file)) return '';
  let want;
  try { want = await localPreview(apiUrl, dir, manifestText); } catch (e) { return `The platform could not check platform.gen.ts: ${e instanceof Error ? e.message : String(e)}`; }
  const text = fs.readFileSync(file, 'utf8');
  return text === want.typescript ? '' : /^\/\/ contract: ([0-9a-f]{16})$/m.exec(text)?.[1] === want.fingerprint ? 'platform.gen.ts was edited by hand. Run "platform types --local" to restore it, or deploy with --skip-types-check.' : 'platform.gen.ts is older than your manifest or migrations, so the code was written against types that no longer match. Run "platform types --local", fix any errors it shows in your code, then deploy again (or deploy with --skip-types-check).';
}

export async function handleTypes(args: string[], apiUrl: string) {
  const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--local')) {
    const dir = path.resolve(flag('--dir') ?? '.');
    try {
      const want = await localPreview(apiUrl, dir);
      if (args.includes('--check')) { const msg = await staleTypesMessage(apiUrl, dir); if (msg) { console.error(msg); process.exit(1); } console.log('platform.gen.ts is up to date.'); return; }
      const out = path.resolve(flag('--out') ?? dir);
      fs.mkdirSync(out, { recursive: true });
      const py = flag('--lang') === 'python';
      fs.writeFileSync(path.join(out, py ? 'platform_gen.py' : 'platform.gen.ts'), py ? want.python : want.typescript); fs.writeFileSync(path.join(out, 'platform.contract.md'), want.summary);
      console.log(want.declared.length ? `Wrote ${py ? 'platform_gen.py' : 'platform.gen.ts'} and platform.contract.md for: ${want.declared.join(', ')} (from this folder's manifest and migrations).` : 'Wrote the generated file. No bindings are declared in manifest.json yet.');
    } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); }
    return;
  }
  const project = flag('--project');
  if (!project) { console.error('Usage: platform types --project <name> [--check] [--out <dir>]   (or: platform types --local [--dir <folder>] to work it out from the manifest and migrations before deploying)'); process.exit(1); }
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(project)}/dev-tokens`;
  const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: `${os.hostname()} (types)` }) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) { console.error(j.error ?? `Could not read the project's contract (HTTP ${r.status}).`); process.exit(1); }
  try {
    const lang = flag('--lang');
    if (lang && lang !== 'typescript' && lang !== 'python') { console.error('--lang can be typescript or python. Other languages can use the OpenAPI documents the gateway serves, at <address>/openapi.json.'); process.exitCode = 1; return; }
    const out = await runTypes({ env: j.env, check: args.includes('--check'), out: flag('--out'), lang: lang as 'typescript' | 'python' | undefined });
    (out.code ? console.error : console.log)(out.message);
    process.exitCode = out.code;
  } finally {
    await fetch(`${base}/${j.id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}
