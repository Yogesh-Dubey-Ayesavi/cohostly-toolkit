// `platform cost [--project name]`: what AI and hosting cost, in plain sentences. Every figure is an estimate and says what it assumes.
const fail = (msg: string): never => { console.error(msg); process.exit(1); };

export async function handleCost(args: string[], apiUrl: string, fallbackProject?: string) {
  let project = fallbackProject;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' || args[i] === '-p') project = args[++i];
    else if (args[i] === '--json' || args[i] === '--terms') { /* handled below */ }
    else if (!args[i].startsWith('-') && !project) project = args[i];
    else if (args[i] !== '--json' && args[i] !== '--terms') fail('Usage: platform cost [--project name] [--terms] [--json]');
  }
  const r = await fetch(`${apiUrl}${project ? `/v1/projects/${encodeURIComponent(project)}/cost` : '/v1/cost'}`);
  const j = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) fail(j.error ?? `Could not read the cost (HTTP ${r.status}).`);
  if (args.includes('--json')) return console.log(JSON.stringify(j, null, 2));
  console.log(project ? `Cost of ${project}\n` : 'Cost across your projects\n');
  for (const s of j.sentences) console.log(s + '\n');
  if (j.ai_budget) {
    const b = j.ai_budget;
    console.log(`AI budget this month: $${b.spent_usd.toFixed(2)} of $${b.cap_usd.toFixed(2)} (${b.percent}%)${b.state === 'stopped' ? ' - AI calls are stopped until next month. ' + b.how_to_raise : b.state === 'warning' ? ' - close to the limit. ' + b.how_to_raise : ''}`);
  }
  if (args.includes('--terms')) {
    if (j.prices?.length) { console.log('\nPrices used (per million tokens: input / output / cached input):'); for (const p of j.prices) console.log(`  ${p.model.padEnd(24)} ${p.paid_by === 'platform' ? 'platform pays' : 'your key'.padEnd(13)} $${p.input_usd_per_million} / $${p.output_usd_per_million} / $${p.cached_input_usd_per_million}  since ${p.in_force_since}${p.checked ? '' : ' (price not checked)'}${p.above_prompt_tokens ? `; above ${p.above_prompt_tokens} prompt tokens $${p.long_input_usd_per_million} / $${p.long_output_usd_per_million}` : ''}`); }
    console.log('\nWhat the words mean:'); for (const t of j.terms ?? []) console.log(`  ${t.term}: ${t.meaning}`);
  }
  for (const n of j.notices ?? []) console.log(`\n${n.severity === 'warning' ? 'Notice' : 'Note'} (${new Date(n.at).toLocaleDateString()}): ${n.message}`);
  if (j.by_caller?.length) {
    console.log('\nWho used the AI (last 7 days):');
    for (const c of j.by_caller.slice(0, 10)) console.log(`  ${(c.kind ?? 'unknown').padEnd(8)} ${String(c.id).slice(0, 36).padEnd(38)} ${String(c.calls).padStart(5)} calls  $${c.cost_usd.toFixed(4)}`);
  }
  if (j.projects?.length) {
    console.log('\nPer project (this month so far / monthly pace):');
    for (const p of j.projects) console.log(`  ${p.project.padEnd(28)} $${p.month_to_date_usd.toFixed(2).padStart(7)}  $${p.monthly_pace_usd.toFixed(2).padStart(7)}`);
  }
}
