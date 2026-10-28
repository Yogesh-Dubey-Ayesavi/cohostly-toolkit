import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';

// `platform dev [--project name] [--no-secrets] [--env-file file] -- <command>`: runs a command on this computer with a dev token and the addresses of the real
// platform services in its environment, and, unless told not to, the project's secrets. Nothing is written to disk. The token ends when the command does.

/** KEY=VALUE lines, `export` and quotes allowed. Lines that are not that are ignored. */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith('#')) continue;
    let v = m[2];
    if (v.length >= 2 && (v[0] === '"' && v.endsWith('"') || v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export interface Merged { env: NodeJS.ProcessEnv; loaded: string[]; replaced: string[] }

/**
 * The command's environment. The platform's own variables (the dev token and the service addresses) always win. For secrets, what the developer set
 * themselves wins: first the environment they ran this in, then their local file, so a test key can stand in for a live key without changing the platform.
 */
export function mergeEnv(base: NodeJS.ProcessEnv, platform: Record<string, string>, secrets: Record<string, string>, localFile: Record<string, string> = {}): Merged {
  const env: NodeJS.ProcessEnv = { ...localFile, ...base };
  const loaded: string[] = []; const replaced: string[] = [];
  for (const [k, v] of Object.entries(secrets)) {
    if (base[k] !== undefined || localFile[k] !== undefined) { replaced.push(k); continue; }
    env[k] = v; loaded.push(k);
  }
  for (const [k, v] of Object.entries(platform)) env[k] = v;
  return { env, loaded, replaced };
}

export interface DevArgs { project?: string; noSecrets: boolean; envFile?: string; command: string[] }

export function parseDevArgs(args: string[]): DevArgs {
  const cut = args.indexOf('--');
  const own = cut >= 0 ? args.slice(0, cut) : args;
  const out: DevArgs = { noSecrets: false, command: cut >= 0 ? args.slice(cut + 1) : [] };
  for (let i = 0; i < own.length; i++) {
    if (own[i] === '--project' && own[i + 1]) out.project = own[++i];
    else if (own[i] === '--no-secrets') out.noSecrets = true;
    else if (own[i] === '--env-file' && own[i + 1]) out.envFile = own[++i];
  }
  return out;
}

export async function handleDev(args: string[], apiUrl: string) {
  const a = parseDevArgs(args);
  if (!a.project || !a.command.length) {
    console.error('Usage: platform dev --project <name> [--no-secrets] [--env-file .env.local] -- <command>\nFor example: platform dev --project shop -- npm start');
    process.exit(1);
  }
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(a.project)}/dev-tokens`;
  const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: os.hostname(), include_secrets: !a.noSecrets }) });
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) { console.error(j.error ?? `Could not start a dev session (HTTP ${r.status}).`); process.exit(1); }

  let local: Record<string, string> = {};
  const file = a.envFile ?? '.env.local';
  try { local = parseDotenv(fs.readFileSync(file, 'utf-8')); } catch (e: any) { if (a.envFile && e.code === 'ENOENT') { console.error(`${file} was not found.`); process.exit(1); } }

  const m = mergeEnv(process.env, j.env ?? {}, j.secrets ?? {}, local);
  const until = new Date(j.expires_at).toLocaleTimeString();
  console.log(`Dev token ready for ${a.project}, valid until ${until}. It reaches only the dev environment.`);
  if (!a.noSecrets) {
    console.log(`Loaded ${m.loaded.length} secret${m.loaded.length === 1 ? '' : 's'} from the platform${m.replaced.length ? ` (${m.replaced.length} replaced by your own: ${m.replaced.join(', ')})` : ''}.`);
    if (j.missing_secrets?.length) console.log(`Not set on the platform yet: ${j.missing_secrets.join(', ')}.`);
  }
  console.log(`Running: ${a.command.join(' ')}\n`);

  const child = a.command.length === 1 ? spawn(a.command[0], { stdio: 'inherit', env: m.env, shell: true }) : spawn(a.command[0], a.command.slice(1), { stdio: 'inherit', env: m.env });
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => child.kill(sig));
  const code: number = await new Promise((res) => { child.on('error', (e) => { console.error(`Could not run "${a.command[0]}": ${e.message}`); res(127); }); child.on('exit', (c, s) => res(c ?? (s ? 128 : 1))); });
  // The session is over: end the token (best effort; it would stop by itself in about 12 hours anyway).
  await fetch(`${base}/${j.id}`, { method: 'DELETE' }).catch(() => undefined);
  process.exit(code);
}
