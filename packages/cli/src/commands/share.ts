// platform share [list] --project p                           who can open the project and who it is shared with
// platform share visibility <public|link|account|private> --project p   choose who can open it
// platform share invite <email> [--role viewer|editor|admin] --project p  invite someone (default role: viewer)
// platform share role <email> <viewer|editor|admin> --project p           change someone's role
// platform share remove <email> --project p                     take someone off
// Phase 15. Every change goes through the same API routes the dashboard and the assistants use, so it is audited the same way.
export const VISIBILITIES = ['public', 'link', 'account', 'private'];
export const ROLES = ['viewer', 'editor', 'admin'];
export interface ShareArgs { action: 'list' | 'visibility' | 'invite' | 'role' | 'remove'; project: string; json: boolean; level?: string; email?: string; role?: string }

const USAGE = 'Use: platform share [list | visibility <public|link|account|private> | invite <email> [--role viewer|editor|admin] | role <email> <role> | remove <email>] --project <project> [--json]';

export function parseShareArgs(args: string[]): ShareArgs | string {
  let project = '', json = false, role: string | undefined; const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--json') json = true;
    else if (x === '--project') { project = args[++i] ?? ''; if (!project) return '--project needs a project name'; }
    else if (x === '--role') { role = args[++i]; if (!role || !ROLES.includes(role)) return `--role must be one of: ${ROLES.join(', ')}.`; }
    else if (x.startsWith('-')) return `I do not know "${x}". ${USAGE}`;
    else rest.push(x);
  }
  let action: ShareArgs['action'] = 'list';
  if (rest[0] && ['list', 'visibility', 'invite', 'role', 'remove'].includes(rest[0])) action = rest.shift() as ShareArgs['action'];
  else if (rest.length === 1 && !project) project = rest.shift()!; // platform share <project>
  if (!project) return `project name required. ${USAGE}`;
  const out: ShareArgs = { action, project, json };
  if (action === 'list') { if (rest.length) return `Too many words. ${USAGE}`; return out; }
  if (action === 'visibility') {
    if (rest.length !== 1 || !VISIBILITIES.includes(rest[0])) return `Choose one of: ${VISIBILITIES.join(', ')}. ${USAGE}`;
    return { ...out, level: rest[0] };
  }
  if (action === 'invite') { if (rest.length !== 1) return `Whom do you want to invite? ${USAGE}`; return { ...out, email: rest[0].toLowerCase(), role: role ?? 'viewer' }; }
  if (action === 'role') {
    if (rest.length !== 2 || !ROLES.includes(rest[1])) return `Use: platform share role <email> <${ROLES.join('|')}> --project <project>`;
    return { ...out, email: rest[0].toLowerCase(), role: rest[1] };
  }
  if (rest.length !== 1) return `Whom do you want to remove? ${USAGE}`;
  return { ...out, email: rest[0].toLowerCase() };
}

export async function handleShare(args: string[], apiUrl: string, out: (s: string) => void = console.log) {
  const a = parseShareArgs(args);
  if (typeof a === 'string') { console.error('Error: ' + a); process.exit(1); }
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(a.project)}`;
  const call = async (method: string, path: string, body?: unknown): Promise<any> => {
    const res = await fetch(base + path, { method, ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error(`Error: ${j.error || res.statusText}`); process.exit(1); }
    return j;
  };
  const person = async (email: string) => {
    const c = (await call('GET', '/collaborators')).collaborators.find((x: any) => String(x.email).toLowerCase() === email);
    if (!c) { console.error(`Error: ${email} is not on ${a.project}'s share list. Run: platform share --project ${a.project}`); process.exit(1); }
    return c;
  };
  if (a.action === 'list') {
    const r = await call('GET', '/collaborators');
    if (a.json) return out(JSON.stringify(r, null, 2));
    if (r.description) out(r.description);
    for (const c of r.collaborators ?? []) out(`- ${c.email}  ${c.role}${c.status && c.status !== 'active' ? `  (${c.status})` : ''}`);
    if (!(r.collaborators ?? []).length) out('Not shared with anyone by name.');
  } else if (a.action === 'visibility') {
    const r = await call('PATCH', '', { visibility: a.level });
    out(a.json ? JSON.stringify(r, null, 2) : `${a.project}: ${r.description ?? r.visibility}`);
  } else if (a.action === 'invite') {
    const r = await call('POST', '/collaborators', { email: a.email, role: a.role });
    out(a.json ? JSON.stringify(r, null, 2) : `${a.email} is ${r.collaborator?.status === 'pending' ? 'invited' : 'on the list'} as ${r.collaborator?.role ?? a.role}.`);
  } else if (a.action === 'role') {
    const c = await person(a.email!);
    const r = await call('PATCH', `/collaborators/${encodeURIComponent(c.id)}`, { role: a.role });
    out(a.json ? JSON.stringify(r, null, 2) : `${a.email} is now ${r.collaborator?.role ?? a.role}.`);
  } else {
    const c = await person(a.email!);
    const r = await call('DELETE', `/collaborators/${encodeURIComponent(c.id)}`);
    out(a.json ? JSON.stringify(r, null, 2) : `${r.removed ?? a.email} was removed.`);
  }
}
