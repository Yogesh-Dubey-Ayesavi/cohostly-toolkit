import * as fs from 'node:fs';
import * as path from 'node:path';

// Phase 25b step 8: a .env file is read here for its values and never uploaded as source. The values travel in the deploy request's `secrets` field,
// the names are printed, the values never are. The file list, the order and the parser match packages/image-builder/src/env-detect.ts (the same test cases run in both).
// Which files are env files, and their order, is written once in the platform repo (packages/shared/env-files.json); env-files.generated.ts is that rule, copied by its `make schema`.
import { orderEnvFiles } from './env-files.generated.js';
export { envFileRank } from './env-files.generated.js';


const MAX_FILE_BYTES = 1024 * 1024;
const MAX_SECRETS = 100; // what one deploy can carry (the API's limit)

/** KEY=value lines: comments, `export`, quotes, escapes in double quotes, an inline ` #` comment on an unquoted value, quoted values over several lines. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const closing = (body: string, q: string) => { for (let i = 0; i < body.length; i++) { if (q === '"' && body[i] === '\\') { i++; continue; } if (body[i] === q) return i; } return -1; };
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(?:export\s+)?([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*=(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const rest = m[2]!.replace(/^\s+/, ''); const q = rest[0];
    if (q === '"' || q === "'") {
      let body = rest.slice(1); let close = closing(body, q);
      while (close < 0 && i + 1 < lines.length) { body += '\n' + lines[++i]!; close = closing(body, q); }
      if (close < 0) { out[m[1]!] = body; continue; }
      const inner = body.slice(0, close);
      out[m[1]!] = q === '"' ? inner.replace(/\\(["\\n])/g, (_, c) => (c === 'n' ? '\n' : c)) : inner;
    } else out[m[1]!] = rest.replace(/\s+#.*$/, '').trim();
  }
  return out;
}

/** The values in the env files at the root of `dir` and the files they came from. A link is never followed. */
export function readEnvFiles(dir: string): { values: Record<string, string>; files: string[] } {
  const values: Record<string, string> = {}; const files: string[] = [];
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { /* no such folder */ }
  for (const f of orderEnvFiles(names)) {
    try {
      const p = path.join(dir, f); const st = fs.lstatSync(p);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      Object.assign(values, parseEnvFile(fs.readFileSync(p, 'utf8'))); files.push(f);
    } catch { /* not there */ }
  }
  return { values, files };
}

// Names the platform sets itself or the system owns: the server leaves them out, so they are not sent.
const SYSTEM = new Set(['HOST', 'NODE_ENV', 'PATH', 'HOME', 'PWD', 'TZ', 'LANG', 'CI', 'DEBUG']);
const PLATFORM = new Set(['AI_API_KEY', 'AI_BASE_URL', 'APPROVALS_URL', 'DATA_URL', 'CRON_URL', 'PORT']);
const usable = (n: string) => /^[A-Z][A-Z0-9_]{0,63}$/.test(n) && !SYSTEM.has(n) && !PLATFORM.has(n) && !n.startsWith('PLATFORM_') && !n.startsWith('CONNECTION_');

export interface DeployEnv {
  /** JSON for the deploy request's `secrets` field, or undefined when there is nothing to send. */
  secrets?: string;
  /** The names being sent, sorted. Never values. */
  names: string[];
  /** What to tell the person; empty when there are no env files. */
  message: string;
}

/** What to send for the env files in `dir`. With `noEnvFile` nothing is sent, and the person is told the files were left out. */
export function envForDeploy(dir: string, noEnvFile: boolean): DeployEnv {
  const { values, files } = readEnvFiles(dir);
  if (!files.length) return { names: [], message: '' };
  if (noEnvFile) return { names: [], message: 'Your .env files were left out and no values were sent (--no-env-file).' };
  const send = Object.fromEntries(Object.entries(values).filter(([n, v]) => usable(n) && v !== ''));
  const names = Object.keys(send).sort();
  if (names.length > MAX_SECRETS) throw new Error(`Your .env files hold ${names.length} values. A deploy can carry at most ${MAX_SECRETS}. Remove the ones the app does not need, or pass --no-env-file and add them under Secrets.`);
  if (!names.length) return { names, message: 'Your .env files had no values to send.' };
  return { secrets: JSON.stringify(send), names, message: `Found ${names.length} value${names.length === 1 ? '' : 's'} in your .env files (${names.join(', ')}). They are sent securely and stored with your secrets, not with your code.` };
}
