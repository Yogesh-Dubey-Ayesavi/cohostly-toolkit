// platform approvals [needs-me|waiting|history] [--project p] [--json]   everything waiting on you (or what you asked for, or what was decided)
// platform approvals show <id>                                            one item: the sentence, who asked, what changes, who can decide
// platform approvals approve|deny <id> [--note text]                      decide one item (the CLI is its own channel in the audit trail)
// platform approvals bulk <id> <id> ... [--deny] [--note text]            decide several low-risk app actions at once
// platform approvals rules <project>                                      the Always allow rules of a project
// platform approvals allow <project> <action> --per-request N --per-day N [--days 30] [--unit emails]   make a rule
// platform approvals revoke-rule <project> <rule>                         end a rule now
// platform approvals away [<email> [--days 7]] | end <delegation>         hand your decisions to someone for a while, or take them back
// Phase 17. Every command goes through the routes the dashboard and the assistants use, so it is audited the same way.
const USAGE = 'Use: platform approvals [needs-me|waiting|history] | show <id> | approve <id> | deny <id> | bulk <id>... | rules <project> | allow <project> <action> --per-request N --per-day N | revoke-rule <project> <rule> | away [<email>] | end <delegation>';
const ACTIONS = ['list', 'show', 'approve', 'deny', 'bulk', 'rules', 'allow', 'revoke-rule', 'away', 'end'] as const;
const TABS = ['needs-me', 'waiting', 'history'];

export interface ApprovalsArgs {
  action: (typeof ACTIONS)[number]; json: boolean; tab: 'needs_me' | 'waiting' | 'history'; ids: string[]; project?: string; note?: string; deny?: boolean;
  rule?: { action: string; perRequest: number; perDay: number; days: number; unit?: string }; email?: string; days?: number; rest: string[];
}

export function parseApprovalsArgs(args: string[]): ApprovalsArgs | string {
  let json = false, note: string | undefined, deny = false, project: string | undefined; const num: Record<string, number> = {}; let unit: string | undefined; const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--json') json = true;
    else if (x === '--deny') deny = true;
    else if (x === '--note') { note = args[++i]; if (!note) return '--note needs some text'; }
    else if (x === '--project') { project = args[++i]; if (!project) return '--project needs a name'; }
    else if (x === '--unit') { unit = args[++i]; if (!unit) return '--unit needs a word'; }
    else if (x === '--per-request' || x === '--per-day' || x === '--days') { const v = Number(args[++i]); if (!Number.isFinite(v) || v <= 0) return `${x} needs a number above zero`; num[x] = v; }
    else if (x.startsWith('-')) return `I do not know "${x}". ${USAGE}`;
    else rest.push(x);
  }
  let first = rest[0];
  if (!first || TABS.includes(first)) {
    if (rest.length > 1) return `Too many words. ${USAGE}`;
    return { action: 'list', json, tab: ({ 'needs-me': 'needs_me', waiting: 'waiting', history: 'history' } as const)[(first ?? 'needs-me') as 'needs-me'], ids: [], project, rest: [] };
  }
  if (!(ACTIONS as readonly string[]).includes(first)) return `I do not know "${first}". ${USAGE}`;
  rest.shift();
  const a: ApprovalsArgs = { action: first as ApprovalsArgs['action'], json, tab: 'needs_me', ids: [], project, note, rest };
  switch (a.action) {
    case 'show': case 'approve': case 'deny': case 'end':
      if (rest.length !== 1) return `Which one? ${USAGE}`;
      a.ids = [rest[0]]; return a;
    case 'bulk':
      if (!rest.length) return `Give the ids. ${USAGE}`;
      a.ids = rest; a.deny = deny; return a;
    case 'rules':
      if (rest.length !== 1) return `Which project? ${USAGE}`;
      a.project = rest[0]; return a;
    case 'allow': {
      if (rest.length !== 2) return `Which project and action? ${USAGE}`;
      if (!num['--per-request'] || !num['--per-day']) return `A rule needs --per-request and --per-day, so it stays narrow. ${USAGE}`;
      a.project = rest[0]; a.rule = { action: rest[1], perRequest: num['--per-request'], perDay: num['--per-day'], days: num['--days'] ?? 30, ...(unit ? { unit } : {}) }; return a;
    }
    case 'revoke-rule':
      if (rest.length !== 2) return `Which project and rule? ${USAGE}`;
      a.project = rest[0]; a.ids = [rest[1]]; return a;
    case 'away':
      if (rest.length > 1) return `Too many words. ${USAGE}`;
      a.email = rest[0]; a.days = num['--days'] ?? 7; return a;
  }
  return USAGE;
}

const when = (iso: string) => String(iso).slice(0, 10);

export async function handleApprovals(args: string[], apiUrl: string, out: (s: string) => void = console.log) {
  const a = parseApprovalsArgs(args);
  if (typeof a === 'string') { console.error('Error: ' + a); process.exit(1); }
  const call = async (method: string, path: string, body?: unknown): Promise<any> => {
    const res = await fetch(apiUrl + path, { method, ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error(`Error: ${j.error || res.statusText}`); process.exit(1); }
    return j;
  };
  const show = (i: any) => {
    out(`${i.id}  [${i.risk}]  ${i.headline}`);
    if (i.app_says) out(`  The app wrote: ${i.app_says.text}`);
    if (i.why) out(`  Why: ${i.why}`);
    if (i.change) { out(`  Now: ${i.change.before}`); out(`  If approved: ${i.change.after}`); for (const l of i.change.list ?? []) out(`    - ${l}`); }
    out(`  ${i.status}${i.status === 'pending' ? `, open until ${when(i.expires_at)}` : ''}${i.decided_by ? `, decided by ${i.decided_by}${i.on_behalf_of ? ` for ${i.on_behalf_of}` : ''}${i.decision_channel ? ` (${i.decision_channel})` : ''}` : ''}`);
    if (i.deciders?.length) out(`  Can decide: ${i.deciders.join(', ')}`);
  };
  if (a.action === 'list') {
    const j = await call('GET', `/v1/inbox?tab=${a.tab}${a.project ? `&project=${encodeURIComponent(a.project)}` : ''}`);
    if (a.json) return out(JSON.stringify(j, null, 2));
    if (!j.items.length) return out(a.tab === 'needs_me' ? 'Nothing is waiting for you.' : a.tab === 'waiting' ? 'You are not waiting on anyone.' : 'No history yet.');
    for (const i of j.items) show(i);
    return;
  }
  if (a.action === 'show') { const j = await call('GET', `/v1/inbox/${encodeURIComponent(a.ids[0])}`); return out(a.json ? JSON.stringify(j, null, 2) : (show(j.item), '')); }
  if (a.action === 'approve' || a.action === 'deny') {
    const item = (await call('GET', `/v1/inbox/${encodeURIComponent(a.ids[0])}`)).item;
    if (!a.json) show(item);
    const j = await call('POST', `/v1/approvals/${encodeURIComponent(item.id)}/decision`, { decision: a.action, details_hash: item.details_hash, channel: 'cli', ...(a.note ? { note: a.note } : {}) });
    return out(a.json ? JSON.stringify(j, null, 2) : j.note ?? `Recorded: ${a.action}.`);
  }
  if (a.action === 'bulk') {
    const items = [];
    for (const id of a.ids) { const it = (await call('GET', `/v1/inbox/${encodeURIComponent(id)}`)).item; items.push({ id: it.id, details_hash: it.details_hash }); }
    const j = await call('POST', '/v1/approvals/bulk', { decision: a.deny ? 'deny' : 'approve', items, channel: 'cli', ...(a.note ? { note: a.note } : {}) });
    if (a.json) return out(JSON.stringify(j, null, 2));
    for (const r of j.results) out(`${r.id}  ${r.ok ? r.status : `not decided: ${r.error}`}`);
    return;
  }
  if (a.action === 'rules') {
    const j = await call('GET', `/v1/projects/${encodeURIComponent(a.project!)}/approval-rules`);
    if (a.json) return out(JSON.stringify(j, null, 2));
    if (!j.rules.length) return out('No Always allow rules.');
    for (const r of j.rules) out(`${r.id}  ${r.active ? 'active' : 'ended'}  ${r.sentence}  (${r.used_today} used today)`);
    return;
  }
  if (a.action === 'allow') {
    const j = await call('POST', `/v1/projects/${encodeURIComponent(a.project!)}/approval-rules`, { action: a.rule!.action, max_per_request: a.rule!.perRequest, max_per_day: a.rule!.perDay, days: a.rule!.days, ...(a.rule!.unit ? { unit: a.rule!.unit } : {}) });
    return out(a.json ? JSON.stringify(j, null, 2) : j.rule.sentence);
  }
  if (a.action === 'revoke-rule') { const j = await call('DELETE', `/v1/projects/${encodeURIComponent(a.project!)}/approval-rules/${encodeURIComponent(a.ids[0])}`); return out(a.json ? JSON.stringify(j, null, 2) : 'The rule has ended.'); }
  if (a.action === 'away') {
    if (a.email) { const j = await call('POST', '/v1/approval-delegations', { to_email: a.email, days: a.days }); return out(a.json ? JSON.stringify(j, null, 2) : j.message); }
    const j = await call('GET', '/v1/approval-delegations');
    if (a.json) return out(JSON.stringify(j, null, 2));
    if (!j.given.length && !j.received.length) return out('No delegations.');
    for (const g of j.given) out(`${g.id}  you → ${g.to}, until ${when(g.ends_at)}`);
    for (const g of j.received) out(`${g.id}  ${g.from} → you, until ${when(g.ends_at)}`);
    return;
  }
  const j = await call('DELETE', `/v1/approval-delegations/${encodeURIComponent(a.ids[0])}`);
  out(a.json ? JSON.stringify(j, null, 2) : 'Your decisions are yours again.');
}
