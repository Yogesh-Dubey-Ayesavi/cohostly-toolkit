import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { findManifestFile } from '../manifest-file.js';
import { parseEnvFile } from '../env-files.js';
import { RAILPACK } from '../tools.js';
import { fetchSnapshotKey, inspectSnapshot, parseExpires, sealSnapshot } from '../snapshot/seal.js';
import { packFolder, postDeploy, printBuildSettings, reportOutcome } from './deploy.js';

// `cohostly pack`, `cohostly inspect`, `cohostly deploy app.cohostly`, and the sealing step `cohostly capture --out` uses (Phase 25g part 3).

const BUILD = ['runtime.language', 'runtime.version', 'runtime.root', 'runtime.package_manager', 'runtime.install_command', 'runtime.build', 'runtime.entrypoint', 'runtime.system_packages', 'health.port'];
const get = (o: any, p: string) => p.split('.').reduce((x, k) => (x && typeof x === 'object' ? x[k] : undefined), o);

function toolVersions(): Record<string, string> {
  const out: Record<string, string> = { railpack: RAILPACK.version };
  try { out.cli = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version; } catch { /* unknown */ }
  try { out.capture = JSON.parse(fs.readFileSync(path.join(path.dirname(createRequire(import.meta.url).resolve('@cohostly/capture')), '..', 'package.json'), 'utf8')).version; } catch { /* unknown */ }
  return out;
}

/** Who is signed in and which account the file is made for: the one named with --account, else the person's only or first one. */
export async function whoAmI(apiUrl: string, account?: string): Promise<{ userId: string; accountId: string }> {
  const res = await fetch(`${apiUrl}/v1/me`);
  if (!res.ok) throw new Error(res.status === 401 ? 'You are not signed in. Run "cohostly login", then try again.' : `The server did not say who you are (HTTP ${res.status}).`);
  const me = (await res.json()) as { id: string; accounts?: { id: string }[] };
  const accounts = me.accounts ?? [];
  const accountId = account ?? accounts[0]?.id;
  if (!accountId) throw new Error('This sign-in has no account to make the file for.');
  if (account && !accounts.some((a) => a.id === account)) throw new Error('You are not a member of that account.');
  return { userId: me.id, accountId };
}

export interface WriteOptions { dir: string; out: string; settings: Record<string, any>; sources: Record<string, string>; secrets?: Record<string, string>; expires?: string; account?: string; apiUrl: string }

/** Packs the folder (no .env files, no node_modules, no .git), seals it and writes the file. Returns what was written, for the summary line. */
export async function writeSnapshotFile(o: WriteOptions): Promise<{ bytes: number; secretNames: string[]; expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + parseExpires(o.expires));
  const key = await fetchSnapshotKey(o.apiUrl);
  const me = await whoAmI(o.apiUrl, o.account);
  const source = packFolder(o.dir, { skipEnvLike: true });
  const file = sealSnapshot({ key, accountId: me.accountId, createdBy: me.userId, expiresAt, now, settings: o.settings, sources: o.sources, tools: toolVersions(), source, secrets: o.secrets });
  fs.writeFileSync(o.out, file, { mode: 0o600 });
  return { bytes: file.length, secretNames: Object.keys(o.secrets ?? {}).sort(), expiresAt };
}

const take = (args: string[], flag: string): string | undefined => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

/** cohostly pack [dir] --out app.cohostly [--no-secrets] [--env-file <path>] [--expires 3d] [--account id] */
export async function handlePack(args: string[], apiUrl: string): Promise<void> {
  const out = take(args, '--out');
  if (!out) { console.error('Say where to write the file, for example: cohostly pack --out app.cohostly'); process.exit(1); }
  const value = new Set(['--out', '--env-file', '--expires', '--account']);
  const dirArg = args.find((a, i) => !a.startsWith('--') && !value.has(args[i - 1] ?? ''));
  const dir = path.resolve(process.cwd(), dirArg ?? '.');
  if (!fs.existsSync(dir)) { console.error(`Error: directory not found: ${dir}`); process.exit(1); }
  try {
    const found = findManifestFile(dir);
    let settings: Record<string, any> = {};
    if (found) { try { settings = JSON.parse(found.text || '{}'); } catch { throw new Error(`${found.file} is not valid JSON.`); } if (found.notice) console.log(found.notice); }
    const sources = (settings._sources && typeof settings._sources === 'object' ? settings._sources : {}) as Record<string, string>;
    delete settings._sources;
    let secrets: Record<string, string> | undefined;
    const envFile = take(args, '--env-file');
    if (envFile && !args.includes('--no-secrets')) {
      const values = parseEnvFile(fs.readFileSync(path.resolve(process.cwd(), envFile), 'utf8'));
      const declared: string[] = Array.isArray(settings.env?.secrets) ? settings.env.secrets : [];
      secrets = Object.fromEntries(declared.filter((n) => values[n] !== undefined && values[n] !== '').map((n) => [n, values[n]!]));
      const missing = declared.filter((n) => !(n in secrets!));
      if (missing.length) console.log(`Not in ${envFile}, so not in the file: ${missing.join(', ')}.`);
    }
    const r = await writeSnapshotFile({ dir, out, settings, sources, secrets: args.includes('--no-secrets') ? undefined : secrets, expires: take(args, '--expires'), account: take(args, '--account'), apiUrl });
    console.log(`Wrote ${out} (${(r.bytes / 1024).toFixed(0)} KB). It expires ${r.expiresAt.toISOString().slice(0, 10)}. ${r.secretNames.length ? `Sealed secrets: ${r.secretNames.join(', ')}.` : 'No secrets inside.'}`);
  } catch (e: any) { console.error(e.message); process.exit(1); }
}

/** cohostly inspect app.cohostly: the readable parts only. Nothing is decrypted and no network call is made. */
export function handleInspect(args: string[]): void {
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('Say which file, for example: cohostly inspect app.cohostly'); process.exit(1); }
  try {
    const i = inspectSnapshot(fs.readFileSync(path.resolve(process.cwd(), file)));
    const m = i.meta;
    console.log(`${file}`);
    console.log(`  made      ${m.created_at}`);
    console.log(`  expires   ${m.expires_at}${i.expired ? '  (EXPIRED: make a new one with cohostly capture --out)' : ''}`);
    console.log(`  account   ${m.account_id}  (only people in this account can deploy it)`);
    console.log(`  secrets   ${i.hasSecrets ? `sealed inside: ${i.secretNames.join(', ') || '(none declared)'}` : `not included${i.secretNames.length ? `; the settings name ${i.secretNames.join(', ')}, to be set under Secrets` : ''}`}`);
    console.log(`  tools     ${Object.entries(m.tools ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'unknown'}`);
    printBuildSettings(BUILD.map((p) => { const v = get(i.settings, p); return { path: p, value: v ?? null, source: v === undefined ? 'default' : (m.sources?.[p] ?? 'you') }; }));
    console.log('\nThe code and the secret values are sealed; this command did not open them.');
  } catch (e: any) { console.error(e.message); process.exit(1); }
}

const MAX_DIRECT = 25 * 1024 * 1024; // a request through the hosted API is limited to about 30 MB

/** cohostly deploy app.cohostly [--project name] */
export async function deploySnapshotFile(file: string, args: string[], apiUrl: string): Promise<void> {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) { console.error(`Error: file not found: ${full}`); process.exit(1); }
  const project = take(args, '--project') ?? path.basename(full).replace(/\.cohostly$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const bytes = fs.readFileSync(full);
  try {
    console.log(`Deploying ${project} from ${path.basename(full)} ...`);
    let r;
    if (bytes.length <= MAX_DIRECT) r = await postDeploy(apiUrl, { project, engine: 'auto' }, bytes, false);
    else {
      const u = await fetch(`${apiUrl}/v1/uploads`, { method: 'POST' });
      if (!u.ok) throw new Error(`The server would not take a large upload (HTTP ${u.status}).`);
      const { upload_id, upload_url } = (await u.json()) as { upload_id: string; upload_url: string };
      const put = await fetch(upload_url, { method: 'PUT', body: new Uint8Array(bytes), headers: { 'content-type': 'application/gzip' } });
      if (!put.ok) throw new Error(`The upload did not finish (HTTP ${put.status}).`);
      r = await postDeploy(apiUrl, { project, engine: 'auto', upload_id }, null, false);
    }
    if (reportOutcome(r, false) && r.last?.url) console.log(`\nLive: ${r.last.url}`);
  } catch (e: any) { console.error(`Failed to deploy: ${e.message}`); process.exit(1); }
}
