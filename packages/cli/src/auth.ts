import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const file = () => path.join(process.env.PLATFORM_CONFIG_DIR || path.join(os.homedir(), '.config', 'cohostly'), 'credentials.json');

function readAll(): Record<string, { api_key: string }> {
  try { return JSON.parse(fs.readFileSync(file(), 'utf-8')); } catch { return {}; }
}

/** The key to send to this API: PLATFORM_API_KEY if set, else the one `platform login` saved. */
export function savedKey(apiUrl: string): string | undefined {
  return process.env.PLATFORM_API_KEY || readAll()[apiUrl]?.api_key;
}

function save(apiUrl: string, api_key: string) {
  const all = readAll(); all[apiUrl] = { api_key };
  fs.mkdirSync(path.dirname(file()), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file(), JSON.stringify(all, null, 2), { mode: 0o600 });
}

/** Every call to the API carries the saved key; a 401 says how to sign in. Call once at start-up. */
export function installAuth(apiUrl: string) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!u.startsWith(apiUrl)) return real(input, init);
    const headers = new Headers(init.headers || {});
    const key = savedKey(apiUrl);
    if (key && !headers.has('authorization')) headers.set('authorization', `Bearer ${key}`);
    const res = await real(input, { ...init, headers });
    if (res.status === 401 && !u.includes('/v1/auth/')) console.error(key ? 'Your key was not accepted (revoked or expired). Run "platform login" again.' : 'You are not signed in. Run "platform login".');
    return res;
  }) as typeof fetch;
}

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* the URL is printed anyway */ }
}

export async function handleLogin(args: string[], apiUrl: string) {
  const ti = args.indexOf('--token');
  if (ti >= 0) { // paste a key made in the dashboard
    const key = args[ti + 1];
    if (!key?.startsWith('plk_')) { console.error('That is not an API key. Keys start with "plk_".'); process.exit(1); }
    const r = await fetch(`${apiUrl}/v1/me`, { headers: { authorization: `Bearer ${key}` } });
    if (!r.ok) { console.error('The API did not accept that key.'); process.exit(1); }
    save(apiUrl, key); console.log('Signed in with the key you pasted.'); return;
  }
  const r = await fetch(`${apiUrl}/v1/auth/device`, { method: 'POST' });
  if (!r.ok) { console.error(`Could not start sign-in: ${((await r.json().catch(() => ({}))) as any).error ?? r.statusText}`); process.exit(1); }
  const d = (await r.json()) as any;
  console.log(`\nOpen ${d.verification_uri} and enter the code:\n\n    ${d.user_code}\n`);
  if (!args.includes('--no-browser')) openBrowser(d.verification_uri_complete);
  const deadline = Date.now() + d.expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, (d.interval ?? 2) * 1000));
    const t = await fetch(`${apiUrl}/v1/auth/device/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device_code: d.device_code }) });
    if (t.status === 202) continue;
    const j = (await t.json().catch(() => ({}))) as any;
    if (!t.ok) { console.error(j.error ?? 'Sign-in failed.'); process.exit(1); }
    save(apiUrl, j.api_key);
    console.log('Signed in. Your key is saved on this computer.');
    return;
  }
  console.error('The code expired before it was approved. Run "platform login" again.'); process.exit(1);
}

export async function handleWhoami(apiUrl: string) {
  const r = await fetch(`${apiUrl}/v1/me`);
  if (!r.ok) process.exit(1);
  const m = (await r.json()) as any;
  console.log(`${m.email ?? m.kind} (${m.kind})`);
  for (const a of m.accounts ?? []) console.log(`  account ${a.name ?? a.id}${a.role ? ` (${a.role})` : ''}`);
}

export function handleLogout(apiUrl: string) {
  const all = readAll(); delete all[apiUrl];
  fs.mkdirSync(path.dirname(file()), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file(), JSON.stringify(all, null, 2), { mode: 0o600 });
  console.log('Signed out. The key on this computer was removed (revoke it in the dashboard to disable it everywhere).');
}
