import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import * as readline from 'node:readline/promises';
import { takeSetFlags, printSettings } from './manifest.js';

const MAX_UPLOAD = 50 * 1024 * 1024; // the API's upload limit

/** Packs the folder into a .tar.gz (without node_modules, .git and similar) so the API can be on another machine. */
function packFolder(dir: string): Buffer {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-deploy-'));
  const file = path.join(tmp, 'source.tar.gz');
  try {
    execFileSync('tar', ['-czf', file, '--exclude=node_modules', '--exclude=.git', '--exclude=.vercel', '--exclude=.next', '--exclude=__pycache__', '--exclude=.DS_Store', '-C', dir, '.'], { stdio: 'pipe' });
    return fs.readFileSync(file);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

interface DraftField { path: string; value: unknown; reason: string; confidence: string; in_manifest: boolean }

/** One line per stage as it happens; returns the final outcome line. */
async function postDeploy(apiUrl: string, fields: Record<string, string>, archive: Buffer, quiet: boolean): Promise<{ http: number; last: any }> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  // The folder is uploaded: the API runs on another machine and cannot read this disk.
  form.set('tarball', new Blob([new Uint8Array(archive)]), 'source.tar.gz');
  const res = await fetch(`${apiUrl}/v1/deploy`, { method: 'POST', body: form, headers: { accept: 'application/x-ndjson' } });
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('ndjson')) { const data = (await res.json().catch(() => ({}))) as any; return { http: res.status, last: res.ok ? { stage: 'live', ...data } : { stage: 'failed', status: res.status, ...data } }; }
  let last: any; let buf = ''; let lastStage = ''; let lastLog = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body as any) {
    buf += decoder.decode(chunk, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const e = JSON.parse(line); last = e;
      if (quiet || ['live', 'failed', 'needs_confirmation'].includes(e.stage)) continue;
      if (e.log) { lastLog = e.log; if (process.env.PLATFORM_VERBOSE) console.log(`    ${e.log}`); continue; }
      if (e.stage !== lastStage || e.message) { console.log(`${label(e.stage)}${e.message ? '  ' + e.message : ''}`); lastStage = e.stage; }
    }
  }
  void lastLog;
  return { http: res.status, last };
}
const label = (s: string) => ({ uploading: '[1/4] Uploading', building: '[2/4] Building', starting: '[3/4] Starting', live: '[4/4] Live' } as Record<string, string>)[s] ?? s;

function printChanges(c: any) {
  if (!c) return;
  console.log(`\nSince version v${c.previous_version}: ${c.diff.summary}`);
  for (const f of [...c.diff.added.map((x: string) => `+ ${x}`), ...c.diff.removed.map((x: string) => `- ${x}`), ...c.diff.modified.map((x: string) => `~ ${x}`)].slice(0, 12)) console.log(`    ${f}`);
  for (const i of c.impacts ?? []) console.log(`  ${i.kind === 'info' ? 'note' : 'may affect'} ${i.field}: ${i.reason}`);
}

function printDraft(d: { fields: DraftField[]; warnings: string[]; detection: any; model: any; changes?: any }, message?: string) {
  const det = d.detection;
  console.log(message ? `\n${message}\n` : `\nThis looks like a ${det.framework ? det.framework + ' ' : ''}${det.language} app. There is no manifest, so here are the settings worked out from your code:\n`);
  printChanges(d.changes);
  console.log('');
  for (const f of d.fields) {
    const v = typeof f.value === 'string' ? f.value : JSON.stringify(f.value);
    console.log(`  ${f.path.padEnd(22)} ${v.padEnd(34)} ${f.in_manifest ? '' : '(standard) '}[${f.confidence}]`);
    console.log(`  ${''.padEnd(22)} ${f.reason}`);
  }
  if (d.model?.fallback) console.log(`\nNote: ${d.model.fallback}`);
  for (const w of d.warnings ?? []) console.warn(`Warning: ${w}`);
}

async function ask(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(q)).trim().toLowerCase(); } finally { rl.close(); }
}

/** Lets the person change the draft in their editor. Returns the edited text, or null when it is not valid JSON. */
function editManifest(text: string): string | null {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'platform-edit-')), 'manifest.json');
  fs.writeFileSync(tmp, text);
  const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
  spawnSync(editor, [tmp], { stdio: 'inherit', shell: true });
  const out = fs.readFileSync(tmp, 'utf-8');
  try { JSON.parse(out); return out; } catch { console.error('That is not valid JSON, so the edit was ignored.'); return null; }
}

export async function handleDeploy(rawArgs: string[], apiUrl: string) {
  const { rest: args, overrides } = takeSetFlags(rawArgs);
  const showSettings = args.includes('--show-settings');
  const yes = args.includes('--yes') || args.includes('-y');
  let dir = '.';
  let engine = 'auto';
  let project = '';
  let manifestPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine' && args[i + 1]) {
      engine = args[i + 1];
      i++;
    } else if (args[i] === '--project' && args[i + 1]) {
      project = args[i + 1];
      i++;
    } else if (args[i] === '--manifest' && args[i + 1]) {
      manifestPath = args[i + 1];
      i++;
    } else if (args[i] === '--show-settings' || args[i] === '--yes' || args[i] === '-y' || args[i] === '--draft') {
      // handled above
    } else if (!args[i].startsWith('--')) {
      dir = args[i];
    }
  }

  const srcDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: directory not found: ${srcDir}`);
    process.exit(1);
  }

  if (!project) {
    project = path.basename(srcDir);
  }

  let manifestContent = '';
  if (manifestPath) {
    const full = path.resolve(process.cwd(), manifestPath);
    if (!fs.existsSync(full)) {
      console.error(`Error: manifest file not found: ${full}`);
      process.exit(1);
    }
    manifestContent = fs.readFileSync(full, 'utf-8');
  }

  let archive: Buffer;
  try { archive = packFolder(srcDir); } catch (e: any) { console.error(`Could not pack ${srcDir}: ${e.message}`); process.exit(1); }
  if (archive.length > MAX_UPLOAD) {
    console.error(`The folder is ${(archive.length / 1048576).toFixed(1)} MB after packing; the limit is 50 MB. Remove build output and large files (node_modules and .git are already left out).`);
    process.exit(1);
  }

  const base: Record<string, string> = { project, engine };
  if (manifestContent) base.manifest = manifestContent;
  if (Object.keys(overrides).length) base.overrides = JSON.stringify(overrides);
  try {
    console.log(`Deploying ${project} ...`);
    // With no manifest the server answers with a draft instead of deploying, unless --yes says to go ahead. Only a person at a terminal is asked:
    // a script cannot answer, so it keeps the standard settings (as before) unless it passes --yes (use the settings worked out from the code) or --draft (show them and stop).
    const ask_first = !yes && (process.stdin.isTTY || args.includes('--draft'));
    let r = await postDeploy(apiUrl, { ...base, ...(yes ? { skip_confirmation: 'true' } : ask_first ? { draft: 'true' } : {}) }, archive, false);

    if (r.last?.stage === 'needs_confirmation') {
      const d = r.last;
      printDraft(d.draft, d.draft.changes ? d.message : undefined);
      if (!process.stdin.isTTY) {
        console.error('\nNothing was deployed. Run again with --yes to accept these settings, or save them as manifest.json and pass --manifest.');
        process.exit(2);
      }
      let edited: string | undefined;
      for (;;) {
        const a = await ask('\nDeploy with these settings? [Y]es / [e]dit / [n]o: ');
        if (a === 'n' || a === 'no') { console.log('Cancelled. Nothing was deployed.'); return; }
        if (a === 'e' || a === 'edit') { const t = editManifest(edited ?? JSON.stringify(d.draft.manifest, null, 2)); if (t) { edited = t; console.log('Edited settings will be used.'); } continue; }
        if (a === '' || a === 'y' || a === 'yes') break;
      }
      r = await postDeploy(apiUrl, { ...base, confirm_token: d.confirm_token, ...(edited ? { manifest: edited } : {}) }, archive, false);
    }

    const data = r.last;
    if (!data || data.stage === 'failed' || r.http >= 400 || data.stage !== 'live') {
      const f = data ?? {};
      console.error(`\nDeployment failed${f.failed_stage ? ` while ${f.failed_stage}` : ''}.`);
      if (f.cause) { console.error(`  What went wrong: ${f.cause}`); console.error(`  What to do:      ${f.fix}`); for (const l of f.log_tail ?? []) console.error(`    ${l}`); }
      else console.error(`  ${f.details || f.error || 'The server did not answer with a result.'}`);
      if (f.retry_after) console.error(`  Try again in ${f.retry_after} seconds.`);
      process.exit(1);
    }

    console.log(`\nDeployed project: ${data.project} (version v${data.version})`);
    console.log(`URL:    ${data.url}`);
    if (data.deduped) console.log(`Notice: ${data.notice}`);
    printChanges(data.changes);
    for (const n of data.notices ?? []) console.log(`Notice: ${n}`);
    if ((data.no_manifest || showSettings) && data.settings) printSettings(data.settings, data.no_manifest ? 'Settings used (no manifest, so these are the defaults):' : 'Settings used:');
    if (data.warnings && data.warnings.length > 0) {
      for (const w of data.warnings) {
        console.warn(`Warning: ${w}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to connect to API at ${apiUrl}: ${err.message}`);
    process.exit(1);
  }
}
