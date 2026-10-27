import * as fs from 'node:fs';
import * as path from 'node:path';
import { capture, type CaptureResult, type Manifest, type Source } from '@cohostly/capture';
import { takeSetFlags } from './manifest.js';
import { packFolder, postDeploy, reportOutcome } from './deploy.js';
import { ensureRailpack } from '../tools.js';
import { writeSnapshotFile } from './snapshot.js';

const USAGE = 'Tell Cohostly how you start your app, for example: cohostly capture -- npm start';

export interface CaptureArgs {
  argv?: string[]; command?: string; project?: string; dir: string; probePath: string; timeoutSec: number;
  out?: string; noSecrets: boolean; expires?: string; account?: string; save: boolean; force: boolean; noDeploy: boolean; allowLocalUrls: boolean; json: boolean; overrides: Record<string, unknown>; error?: string;
}

/** Everything after `--` is the app's own command; the flags before it are ours. */
export function parseCaptureArgs(rawArgs: string[]): CaptureArgs {
  const dash = rawArgs.indexOf('--');
  const ours = dash < 0 ? rawArgs : rawArgs.slice(0, dash);
  const { rest, overrides } = takeSetFlags(ours);
  const a: CaptureArgs = { dir: '.', probePath: '/', timeoutSec: 30, noSecrets: false, save: false, force: false, noDeploy: false, allowLocalUrls: false, json: false, overrides };
  if (dash >= 0 && rawArgs.length > dash + 1) a.argv = rawArgs.slice(dash + 1);
  for (let i = 0; i < rest.length; i++) {
    const v = () => rest[++i];
    switch (rest[i]) {
      case '--project': a.project = v(); break;
      case '--dir': a.dir = v() ?? '.'; break;
      case '--probe-path': a.probePath = v() ?? '/'; break;
      case '--timeout': { const n = Number(v()); if (!Number.isFinite(n) || n < 1) a.error = '--timeout needs a number of seconds.'; else a.timeoutSec = Math.min(n, 300); break; }
      case '--command': a.command = v(); break;
      case '--out': a.out = v(); break;
      case '--no-secrets': a.noSecrets = true; break;
      case '--expires': a.expires = v(); break;
      case '--account': a.account = v(); break;
      case '--save': a.save = true; break;
      case '--force': a.force = true; break;
      case '--no-deploy': a.noDeploy = true; break;
      case '--allow-local-urls': a.allowLocalUrls = true; break;
      case '--json': a.json = true; break;
      default: a.error = `Unknown option ${rest[i]}.`;
    }
  }
  if (!a.error && !a.argv?.length && !a.command?.trim()) a.error = USAGE;
  if (!a.error && a.argv?.length && a.command) a.error = 'Give the start command after -- or with --command, not both.';
  return a;
}

const set = (o: any, dotted: string, value: unknown) => {
  const parts = dotted.split('.');
  for (const p of parts.slice(0, -1)) { if (typeof o[p] !== 'object' || o[p] === null) o[p] = {}; o = o[p]; }
  o[parts[parts.length - 1]!] = value;
};

/** The person's own setting flags win over what was seen (25g). Returns the paths they set. */
export function applyOverrides(manifest: Manifest, overrides: Record<string, unknown>): string[] {
  for (const [k, v] of Object.entries(overrides)) set(manifest, k, v);
  return Object.keys(overrides);
}

export interface Row { path: string; value: string; source: string }
const SOURCE_TEXT: Record<Source | 'you', string> = { capture: 'seen running', railpack: 'planned by Railpack', you: 'you set it' };

/** The settings table, in the order a person reads it. Secret values are never in it; names are. */
export function settingsRows(m: Manifest, sources: Record<string, Source>, you: string[]): Row[] {
  const src = (p: string) => SOURCE_TEXT[you.includes(p) ? 'you' : (sources[p] ?? 'capture')];
  const rows: Row[] = [];
  const r = m.runtime;
  rows.push({ path: 'runtime', value: `${r.language}${r.version ? ' ' + r.version : ''}`, source: src('runtime.language') });
  rows.push({ path: 'start', value: r.entrypoint, source: src('runtime.entrypoint') });
  rows.push({ path: 'port', value: String(m.health.port), source: you.includes('health.port') ? 'you set it' : 'seen listening' });
  if (r.build) rows.push({ path: 'build', value: r.build, source: src('runtime.build') });
  if (r.package_manager) rows.push({ path: 'packages', value: r.package_manager, source: src('runtime.package_manager') });
  if (r.system_packages?.length) rows.push({ path: 'system', value: r.system_packages.join(', '), source: src('runtime.system_packages') });
  if (r.install?.length) rows.push({ path: 'install', value: r.install.join(', '), source: src('runtime.install') });
  if (m.env.secrets?.length) rows.push({ path: 'secrets', value: m.env.secrets.join(', '), source: 'values sent privately, never stored in files' });
  if (m.env.vars && Object.keys(m.env.vars).length) rows.push({ path: 'variables', value: Object.keys(m.env.vars).join(', '), source: 'public build settings' });
  return rows;
}

const STAGE: Record<string, string> = { uploading: 'upload', analyzing: 'upload', building: 'build', starting: 'start', live: 'live' };

export async function handleCapture(rawArgs: string[], apiUrl: string): Promise<void> {
  const a = parseCaptureArgs(rawArgs);
  const out = (o: unknown) => console.log(JSON.stringify(o, null, 2));
  if (a.error) { if (a.json) out({ ok: false, stage: 'checks', problems: [{ code: 'bad_arguments', blocking: true, message: a.error, fix: USAGE }], settings: {} }); else console.error(a.error); process.exit(1); }

  const dir = path.resolve(process.cwd(), a.dir);
  if (!fs.existsSync(dir)) { console.error(`Error: directory not found: ${dir}`); process.exit(1); }
  const say = a.json ? () => {} : (l: string) => console.log(l);

  let railpackBin: string;
  try { railpackBin = await ensureRailpack({ log: say }); } catch (e: any) { console.error(e.message); process.exit(1); }

  let result: CaptureResult;
  try { result = await capture({ dir, argv: a.argv, command: a.command, railpackBin, probePath: a.probePath, timeoutSec: a.timeoutSec, allowLocalUrls: a.allowLocalUrls, overrides: a.overrides, onStage: say }); }
  catch (e: any) { console.error(`Capture could not run: ${e.message}`); process.exit(1); }

  const you = applyOverrides(result.manifest, a.overrides);
  if (a.project) result.manifest.name = a.project;
  const rows = settingsRows(result.manifest, result.sources, you);
  const settings = Object.fromEntries(rows.map((r) => [r.path, { value: r.value, source: r.source }]));
  const blocking = result.problems.some((p) => p.blocking);

  if (!a.json) {
    if (!blocking || rows.some((r) => r.path !== 'runtime' || r.value)) {
      const w = Math.max(...rows.map((r) => r.path.length));
      const w2 = Math.max(...rows.map((r) => r.value.length));
      if (result.manifest.runtime.language) for (const r of rows) console.log(`  ${r.path.padEnd(w)}  ${r.value.padEnd(w2)}  (${r.source})`);
    }
    for (const p of result.problems) {
      console.log(`${p.blocking ? '✗' : '!'} ${p.code.padEnd(18)} ${p.message}\n${''.padEnd(21)}${p.fix}`);
    }
  }
  if (blocking) {
    if (a.json) out({ ok: false, stage: 'checks', problems: result.problems, settings });
    else console.log('Nothing was uploaded.');
    process.exit(1);
  }

  if (a.save) {
    const file = path.join(dir, 'cohostly.json');
    if (fs.existsSync(file) && !a.force) { console.error('cohostly.json is already here. Run with --force to replace it.'); process.exit(1); }
    fs.writeFileSync(file, JSON.stringify(result.manifest, null, 2) + '\n');
    say('Saved cohostly.json (names only; the values are not in it).');
  }
  if (a.out) {
    // A sealed file instead of a deploy: the settings stay readable, the code and the secret values are sealed for this account.
    try {
      const sources = Object.fromEntries(Object.entries(result.sources).filter(([p]) => !you.includes(p)));
      const w = await writeSnapshotFile({ dir, out: path.resolve(process.cwd(), a.out), settings: result.manifest as any, sources, secrets: a.noSecrets ? undefined : result.secrets, expires: a.expires, account: a.account, apiUrl });
      if (a.json) out({ ok: true, stage: 'checks', file: a.out, expires_at: w.expiresAt.toISOString(), secrets: w.secretNames, problems: result.problems, settings });
      else console.log(`Wrote ${a.out} (${(w.bytes / 1024).toFixed(0)} KB). It expires ${w.expiresAt.toISOString().slice(0, 10)}. ${w.secretNames.length ? `Sealed secrets: ${w.secretNames.join(', ')}.` : 'No secrets inside.'}\nNothing was uploaded. Deploy it with: cohostly deploy ${a.out}`);
    } catch (e: any) { console.error(e.message); process.exit(1); }
    return;
  }
  if (a.noDeploy) {
    if (a.json) out({ ok: true, stage: 'checks', problems: result.problems, settings });
    else console.log('Nothing was deployed (--no-deploy).');
    return;
  }

  let archive: Buffer;
  try { archive = packFolder(dir); } catch (e: any) { console.error(`Could not pack ${dir}: ${e.message}`); process.exit(1); }
  const fields: Record<string, string> = { project: result.manifest.name, engine: 'auto', manifest: JSON.stringify({ ...result.manifest, _sources: Object.fromEntries(Object.entries(result.sources).filter(([p]) => !you.includes(p))) }) }; // _sources tells the server which settings capture and Railpack found (the file written by --save does not carry it)
  if (Object.keys(result.secrets).length) fields.secrets = JSON.stringify(result.secrets); // the only place values travel: this request's body
  try {
    say(`Uploading ${result.manifest.name} ...`);
    const r = await postDeploy(apiUrl, fields, archive, a.json);
    if (a.json) {
      const d = r.last ?? {};
      const live = r.http < 400 && d.stage === 'live';
      const problems = live ? result.problems : [...result.problems, { code: d.code ?? 'deploy_failed', blocking: true, message: d.cause ?? d.details ?? d.error ?? 'The deploy did not finish.', fix: d.fix ?? '' }];
      out({ ok: live, stage: live ? 'live' : STAGE[d.failed_stage] ?? 'upload', ...(live ? { url: d.url } : {}), problems, settings });
      if (!live) process.exit(1);
      return;
    }
    if (reportOutcome(r, false) && r.last?.url) console.log(`\nLive: ${r.last.url}`);
  } catch (e: any) {
    console.error(`Failed to connect to API at ${apiUrl}: ${e.message}`);
    process.exit(1);
  }
}
