// platform ship [requests] <project>                      deploy requests waiting for an admin (and recent ones)
// platform ship approve <project> <request> [--note text]  approve a request: the version goes live
// platform ship deny <project> <request> [--note text]     deny a request: the version stays Not released
// platform ship withdraw <project> <request>               take back your own request
// platform ship policy <project> [direct|approve_all|approve_risky]   show or change who can ship
// Phase 16. Every change goes through the same routes the dashboard and the assistants use, so it is audited the same way.
export const MODES = ['direct', 'approve_all', 'approve_risky'];
export interface ShipArgs { action: 'requests' | 'approve' | 'deny' | 'withdraw' | 'policy'; project: string; json: boolean; id?: string; note?: string; mode?: string }

const USAGE = 'Use: platform ship [requests] <project> | approve <project> <request> [--note text] | deny <project> <request> [--note text] | withdraw <project> <request> | policy <project> [direct|approve_all|approve_risky] [--json]';

export function parseShipArgs(args: string[]): ShipArgs | string {
  let json = false, note: string | undefined; const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--json') json = true;
    else if (x === '--note') { note = args[++i]; if (!note) return '--note needs some text'; }
    else if (x.startsWith('-')) return `I do not know "${x}". ${USAGE}`;
    else rest.push(x);
  }
  let action: ShipArgs['action'] = 'requests';
  if (rest[0] && ['requests', 'approve', 'deny', 'withdraw', 'policy'].includes(rest[0])) action = rest.shift() as ShipArgs['action'];
  const project = rest.shift();
  if (!project) return `project name required. ${USAGE}`;
  const out: ShipArgs = { action, project, json };
  if (action === 'requests') return rest.length ? `Too many words. ${USAGE}` : out;
  if (action === 'policy') {
    if (rest.length > 1 || (rest[0] && !MODES.includes(rest[0]))) return `Choose one of: ${MODES.join(', ')}. ${USAGE}`;
    return { ...out, mode: rest[0] };
  }
  if (rest.length !== 1) return `Which request? ${USAGE}`;
  return { ...out, id: rest[0], ...(note ? { note } : {}) };
}

export async function handleShip(args: string[], apiUrl: string, out: (s: string) => void = console.log) {
  const a = parseShipArgs(args);
  if (typeof a === 'string') { console.error('Error: ' + a); process.exit(1); }
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(a.project)}`;
  const call = async (method: string, path: string, body?: unknown): Promise<any> => {
    const res = await fetch(base + path, { method, ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error(`Error: ${j.error || res.statusText}`); process.exit(1); }
    return j;
  };
  if (a.action === 'requests') {
    const j = await call('GET', '/deploy-requests');
    if (a.json) return out(JSON.stringify(j, null, 2));
    if (!j.requests.length) return out('Nothing is waiting for approval.');
    for (const r of j.requests) out(`${r.id}  version ${r.version}  ${r.status}${r.status === 'pending' ? ` (until ${String(r.expires_at).slice(0, 10)})` : ''}  ${r.summary}${r.mine ? '  (yours)' : ''}`);
    return;
  }
  if (a.action === 'policy') {
    if (a.mode) { const j = await call('PUT', '/deploy-policy', { mode: a.mode }); return out(a.json ? JSON.stringify(j, null, 2) : j.message); }
    const j = await call('GET', '/deploy-policy');
    if (a.json) return out(JSON.stringify(j, null, 2));
    return out(`${j.options.find((o: any) => o.id === j.mode)?.label ?? j.mode}${j.can_change ? '' : ' (only an admin can change this)'}`);
  }
  if (a.action === 'withdraw') { const j = await call('POST', `/deploy-requests/${encodeURIComponent(a.id!)}/withdraw`); return out(a.json ? JSON.stringify(j, null, 2) : j.message); }
  const j = await call('POST', `/deploy-requests/${encodeURIComponent(a.id!)}/decision`, { decision: a.action, ...(a.note ? { note: a.note } : {}) });
  out(a.json ? JSON.stringify(j, null, 2) : j.message);
}
