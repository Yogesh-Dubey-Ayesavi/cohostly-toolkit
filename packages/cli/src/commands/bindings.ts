// `platform bindings check <project>`: each platform service the project declared, when it was last used, the app's token (a hint only) and any misuse signal.
const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const when = (t: string | null) => (t ? new Date(t).toLocaleString() : 'never');

export async function handleBindings(args: string[], apiUrl: string) {
  const [sub, project] = args;
  if (sub !== 'check' || !project) fail('Usage: platform bindings check <project>');
  const r = await fetch(`${apiUrl}/v1/projects/${encodeURIComponent(project)}/bindings`);
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) fail(j.error ?? `Could not read the project's bindings (HTTP ${r.status}).`);
  const declared = j.bindings.filter((b: any) => b.declared);
  if (!declared.length) console.log('This project declares no bindings. Add one under "bindings" in manifest.json and deploy.');
  for (const b of declared) console.log(`${b.name.padEnd(12)} ${j.live_version ? 'active' : 'declared'}  last used ${when(b.last_used_at)}  ${b.capability}`);
  const other = j.bindings.filter((b: any) => !b.declared).map((b: any) => b.name);
  if (other.length) console.log(`Available, not used: ${other.join(', ')}`);
  if (j.sandbox_token) console.log(`\nApp token ${j.sandbox_token.hint ?? ''} (${j.sandbox_token.slot}${j.sandbox_token.version ? ` v${j.sandbox_token.version}` : ''}), ${j.sandbox_token.running ? 'running' : 'not running'}, last used ${when(j.sandbox_token.last_used_at)}.`);
  for (const s of j.signals) console.log(`\nThe app's token was used from a different place: first ${s.first_seen_from}, then ${s.then_seen_from} (${when(s.at)}). Give it a new token in the dashboard if you do not recognise it.`);
}
