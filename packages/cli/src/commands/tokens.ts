import * as os from 'node:os';

// `platform token create --dev`, `platform token list`, `platform token revoke <id>`. A dev token is shown once, here, to the person who made it.

function projectOf(args: string[]): string | undefined { const i = args.indexOf('--project'); return i >= 0 ? args[i + 1] : undefined; }
const fail = (msg: string): never => { console.error(msg); process.exit(1); };

export async function handleToken(args: string[], apiUrl: string) {
  const [sub, ...rest] = args;
  const project = projectOf(rest);
  if (!project) fail('Usage: platform token <create --dev | list | revoke <id>> --project <name>');
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(project!)}/dev-tokens`;
  if (sub === 'create') {
    if (!rest.includes('--dev')) fail('Only dev tokens can be made here. Use: platform token create --dev --project <name>');
    const di = rest.indexOf('--device');
    const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: di >= 0 ? rest[di + 1] : os.hostname() }) });
    const j = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) fail(j.error ?? `Could not make a dev token (HTTP ${r.status}).`);
    console.log(`Dev token for ${project} (shown once, valid until ${new Date(j.expires_at).toLocaleString()}). Keep it out of git.\n`);
    for (const [k, v] of Object.entries(j.env as Record<string, string>)) console.log(`export ${k}=${/^[\w:/.\-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`}`);
    console.log('\nOr skip all this and run: platform dev --project ' + project + ' -- <command>');
    return;
  }
  if (sub === 'list') {
    const r = await fetch(base); const j = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) fail(j.error ?? `Could not list dev tokens (HTTP ${r.status}).`);
    if (!j.tokens.length) { console.log('No dev tokens.'); return; }
    for (const t of j.tokens) console.log(`${t.id}  ${t.status.padEnd(7)}  ${(t.hint ?? '').padEnd(9)}  ${(t.email ?? t.person_id).padEnd(28)}  ${((t.created_via === 'agent' ? 'assistant: ' : '') + (t.device ?? '')).padEnd(26)}  until ${new Date(t.expires_at).toLocaleString()}${t.last_used_at ? `  last used ${new Date(t.last_used_at).toLocaleString()}` : ''}`);
    return;
  }
  if (sub === 'revoke') {
    const id = rest.find((x) => !x.startsWith('--') && x !== project);
    if (!id) fail('Usage: platform token revoke <id> --project <name>');
    const r = await fetch(`${base}/${encodeURIComponent(id!)}`, { method: 'DELETE' }); const j = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) fail(j.error ?? `Could not end that token (HTTP ${r.status}).`);
    console.log('That dev token no longer works.');
    return;
  }
  fail('Usage: platform token <create --dev | list | revoke <id>> --project <name>');
}
