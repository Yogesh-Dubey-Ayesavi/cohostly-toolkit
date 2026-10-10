import { readValue } from './secrets.js';

// `platform ai-keys ...`: the provider keys an account brings. The platform provides one family of models; every other model is called with the account's own key for its
// provider. A key is typed at a hidden prompt or piped in, never given as an argument (the shell would keep it in its history), and it is never shown again.

const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const flag = (a: string[], n: string) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
const enc = encodeURIComponent;

export async function handleAiKeys(args: string[], apiUrl: string) {
  const [sub = 'list', ...rest] = args;
  const usage = 'Usage: platform ai-keys [list | set <provider> | check <provider> | delete <provider>] [--account <id>]';
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(apiUrl + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const j = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) fail(j.error ?? `The platform answered HTTP ${r.status}.`);
    return j;
  };
  let account = flag(rest, '--account');
  if (!account) {
    const me = await call('GET', '/v1/me');
    const a = me.accounts?.find((x: any) => x.kind === 'personal') ?? me.accounts?.[0];
    if (!a) fail('No account was found for this login.');
    account = a.id as string;
  }
  const base = `/v1/accounts/${enc(account!)}/ai-keys`;
  const provider = () => (rest.find((x) => !x.startsWith('--') && x !== account) ?? fail(usage)).toLowerCase();

  if (sub === 'list') {
    const j = await call('GET', base);
    console.log('Models the platform provides (no key needed):');
    for (const m of j.models.filter((x: any) => x.paid_by === 'platform')) console.log(`  ${m.model.padEnd(26)} ${m.default ? '(default) ' : ''}$${m.price_per_million_tokens_usd.input}/${m.price_per_million_tokens_usd.output} per million tokens (in/out)${m.price_checked ? '' : ' - price not checked yet'}`);
    console.log('\nModels that use your own key:');
    for (const m of j.models.filter((x: any) => x.paid_by === 'your key')) console.log(`  ${m.model.padEnd(26)} ${m.provider.padEnd(18)} ${m.key === 'saved' ? 'key saved' : m.key === 'invalid' ? 'KEY REJECTED - replace it' : 'no key yet'}`);
    console.log('\nSaved keys:');
    if (!j.keys.length) console.log('  none');
    for (const k of j.keys) console.log(`  ${k.provider.padEnd(18)} ${k.hint}  ${k.status}${k.last_used_at ? `, last used ${new Date(k.last_used_at).toLocaleString()}` : ', not used yet'}`);
    console.log(`\nProviders you can bring: ${j.providers_you_can_bring.join(', ') || 'none yet'}. Add one with: platform ai-keys set <provider>`);
    return;
  }
  if (sub === 'set') {
    const p = provider(); const key = (await readValue(`${p} API key`)).trim();
    if (!key) fail('No key was given, so nothing was changed.');
    const j = await call('PUT', `${base}/${enc(p)}`, { key });
    console.log(j.note);
    return;
  }
  if (sub === 'check') {
    const j = await call('POST', `${base}/${enc(provider())}/check`);
    console.log(j.checked === 'ok' ? `The ${j.provider} key works.` : j.checked === 'rejected' ? j.note : `The provider answered: ${j.provider_message}`);
    return;
  }
  if (sub === 'delete') {
    const j = await call('DELETE', `${base}/${enc(provider())}`);
    console.log(j.note);
    return;
  }
  fail(usage);
}
