import * as path from 'node:path';
import * as fs from 'node:fs';

export interface Setting { path: string; value: unknown; source: 'flag' | 'file' | 'default'; note?: string }

/** `--set compute.memory=1024` (repeatable): a CLI flag for any manifest setting. It beats the manifest file. Values are read as JSON when they are JSON, else as text. */
export function takeSetFlags(args: string[]): { rest: string[]; overrides: Record<string, unknown> } {
  const rest: string[] = [];
  const overrides: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--set') {
      const kv = args[++i];
      const eq = kv ? kv.indexOf('=') : -1;
      if (eq < 1) { console.error('Error: --set needs a setting and a value, for example --set compute.memory=1024'); process.exit(1); }
      const raw = kv.slice(eq + 1);
      let value: unknown = raw;
      try { value = JSON.parse(raw); } catch { /* plain text */ }
      overrides[kv.slice(0, eq)] = value;
    } else rest.push(args[i]);
  }
  return { rest, overrides };
}

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/** Every effective setting and where it came from. */
export function printSettings(settings: Setting[], title = 'Settings that will apply (value, then where it came from):') {
  const w1 = Math.max(...settings.map((s) => s.path.length), 0);
  const w2 = Math.max(...settings.map((s) => show(s.value).length), 0);
  console.log(title);
  for (const s of settings) console.log(`  ${s.path.padEnd(w1)}  ${show(s.value).padEnd(w2)}  ${s.source}${s.note ? `  (${s.note})` : ''}`);
}

export async function handleManifest(args: string[], apiUrl: string) {
  if (args[0] !== 'check') { console.error('Usage: platform manifest check [dir] [--manifest file] [--project name] [--set setting=value]...'); process.exit(1); }
  const { rest, overrides } = takeSetFlags(args.slice(1));
  let dir = '.';
  let manifestPath = '';
  let project: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--manifest' && rest[i + 1]) manifestPath = rest[++i];
    else if (rest[i] === '--project' && rest[i + 1]) project = rest[++i];
    else if (!rest[i].startsWith('--')) dir = rest[i];
  }
  const srcDir = path.resolve(process.cwd(), dir);
  const file = manifestPath ? path.resolve(process.cwd(), manifestPath) : path.join(srcDir, 'manifest.json');
  if (manifestPath && !fs.existsSync(file)) { console.error(`Error: manifest file not found: ${file}`); process.exit(1); }
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';

  let data: any;
  try {
    const res = await fetch(`${apiUrl}/v1/manifest/check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, manifest_content: content || undefined, overrides: Object.keys(overrides).length ? overrides : undefined }),
    });
    data = await res.json();
    if (!res.ok) { console.error(`Check failed: ${data.error || res.statusText}`); process.exit(1); }
  } catch (err: any) {
    console.error(`Failed to connect to API at ${apiUrl}: ${err.message}`);
    process.exit(1);
  }

  console.log(content ? `Manifest: ${file} (version ${data.manifest_version}${data.upgraded ? ', upgraded to 2 in memory; the file is not changed' : ''})` : `Manifest: none found in ${srcDir}`);
  if (data.errors.length) {
    console.log('Errors (a deploy would stop):');
    for (const e of data.errors) console.log(`  - ${e}`);
  }
  if (data.warnings.length) {
    console.log('Warnings:');
    for (const w of data.warnings) console.log(`  - ${w}`);
  }
  if (data.notices.length) {
    console.log('Notices:');
    for (const n of data.notices) console.log(`  - ${n}`);
  }
  if (data.errors.length) process.exit(1);
  if (data.who_can_ship) {
    console.log(`Who can ship in ${project}: ${data.who_can_ship.label}`);
    if (data.who_can_ship.would_wait_for_approval !== undefined) console.log(data.who_can_ship.would_wait_for_approval ? `  A deploy of this manifest would wait for an admin: ${data.who_can_ship.because.join('; ')}` : '  A deploy of this manifest would go live directly.');
  }
  printSettings(data.settings);
  const env = Object.entries(data.binding_env as Record<string, string>);
  if (env.length) {
    console.log('Environment a bound app will see (set by the platform, never by you):');
    for (const [k, v] of env) console.log(`  ${k}=${v}`);
  }
}
