import * as fs from 'node:fs';

// `platform secrets ...`: names and facts only. A value is typed at a hidden prompt, piped in, or read from a file; it is never an argument (the shell would
// keep it in its history). Revealing a value is done in the dashboard, where a recent sign-in is required.

const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const flag = (a: string[], n: string) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
const enc = encodeURIComponent;

export async function readValue(name: string): Promise<string> {
  if (!process.stdin.isTTY) { let t = ''; for await (const c of process.stdin) t += c; return t.replace(/\r?\n$/, ''); }
  process.stderr.write(`Value for ${name} (hidden): `);
  return new Promise((resolve) => {
    let v = '';
    process.stdin.setRawMode?.(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    const on = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { process.stdin.setRawMode?.(false); process.stdin.pause(); process.stdin.off('data', on); process.stderr.write('\n'); return resolve(v); }
        if (c === '\u0003') { process.stdin.setRawMode?.(false); process.exit(130); }
        if (c === '\u007f') v = v.slice(0, -1); else v += c;
      }
    };
    process.stdin.on('data', on);
  });
}

export async function handleSecrets(args: string[], apiUrl: string) {
  const [sub, ...rest] = args;
  const project = flag(rest, '--project');
  const usage = 'Usage: platform secrets <list | set NAME | import --file .env | delete NAME | share NAME | request NAME> --project <name>';
  if (!sub || !project) fail(usage);
  const base = `${apiUrl}/v1/projects/${enc(project!)}/secrets`;
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const j = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) fail((j.error ?? `The platform answered HTTP ${r.status}.`) + (r.status === 403 && /signed-in person/.test(j.error ?? '') ? ' Run "platform login" to sign in as yourself, then try again.' : ''));
    return j;
  };
  const name = () => (rest.find((x) => !x.startsWith('--') && x !== project && x !== flag(rest, '--file')) ?? fail(usage)).toUpperCase();

  if (sub === 'list') {
    const j = await call('GET', '');
    if (!j.secrets.length) console.log('No secrets yet.');
    for (const s of j.secrets) console.log(`${s.name.padEnd(28)} ${s.scope === 'account' ? 'shared by the account' : 'this project'.padEnd(21)}  changed ${new Date(s.updated_at).toLocaleDateString()}  ${s.used_by.length ? 'used by ' + s.used_by.map((u: any) => `${u.project} v${u.version}`).join(', ') : 'not asked for by any version'}`);
    if (j.missing_message) console.log(`\n${j.missing_message}`);
    return;
  }
  if (sub === 'set') {
    const n = name(); const value = await readValue(n);
    if (!value) fail('No value was given, so nothing was changed.');
    const j = await call('PUT', `/${enc(n)}`, { value });
    console.log(`${n} ${j.created ? 'was added' : 'has a new value'}. A running app picks it up the next time it starts.`);
    return;
  }
  if (sub === 'import') {
    const file = flag(rest, '--file') ?? '.env';
    let text: string; try { text = fs.readFileSync(file, 'utf8'); } catch { return fail(`${file} was not found.`); }
    const j = await call('POST', '/import', { env: text });
    console.log(`Set ${j.set.length} secret${j.set.length === 1 ? '' : 's'}${j.set.length ? ` (${j.set.join(', ')})` : ''}.`);
    for (const s of j.skipped) console.log(`Skipped line ${s.line}: ${s.reason}.`);
    return;
  }
  if (sub === 'delete') { const n = name(); await call('DELETE', `/${enc(n)}`); console.log(`${n} was deleted.`); return; }
  if (sub === 'share') { const n = name(); await call('POST', `/${enc(n)}/share`); console.log(`${n} is now shared with every project in the account. A project's own secret with the same name still wins.`); return; }
  if (sub === 'request') {
    const n = name(); const j = await call('POST', `/${enc(n)}/request`);
    console.log(`Open this link signed in as yourself and type the value. It works once, for 15 minutes:\n\n  ${j.url}`);
    return;
  }
  fail(usage);
}
