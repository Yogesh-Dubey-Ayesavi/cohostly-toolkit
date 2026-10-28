// platform domains [list] --project p [--json]              the project's own domains and where each stands
// platform domains add <hostname> --project p                attach a domain; prints the DNS records to add
// platform domains show <hostname> --project p               one domain: status, the records, and any problem in words
// platform domains remove <hostname> --project p             detach it (the hostname is released and its certificate deleted)
// Phase 14a. Every change goes through the same API routes the dashboard and the assistants use, so it is audited the same way.
export interface DomainsArgs { action: 'list' | 'add' | 'show' | 'remove'; project: string; hostname?: string; json: boolean }

const USAGE = 'Use: platform domains [list | add <hostname> | show <hostname> | remove <hostname>] --project <project> [--json]';

export function parseDomainsArgs(args: string[]): DomainsArgs | string {
  let project = '', json = false; const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--json') json = true;
    else if (x === '--project') { project = args[++i] ?? ''; if (!project) return '--project needs a project name'; }
    else if (x.startsWith('-')) return `I do not know "${x}". ${USAGE}`;
    else rest.push(x);
  }
  let action: DomainsArgs['action'] = 'list';
  if (rest[0] && ['list', 'add', 'show', 'remove'].includes(rest[0])) action = rest.shift() as DomainsArgs['action'];
  else if (rest.length === 1 && !project) project = rest.shift()!; // platform domains <project>
  if (rest.length > 1) return `Too many words. ${USAGE}`;
  const hostname = rest[0]?.toLowerCase();
  if (action !== 'list' && !hostname) return `Which domain? ${USAGE}`;
  if (action === 'list' && hostname) return `Too many words. ${USAGE}`;
  return project ? { action, project, ...(hostname ? { hostname } : {}), json } : 'project name required: platform domains --project <project>';
}

const STATUS_WORDS: Record<string, string> = {
  pending: 'waiting for your DNS records', verified: 'verified', cert_pending: 'verified, certificate being issued', active: 'live over HTTPS', failed: 'failed', removed: 'removed',
};
const when = (iso: string | null | undefined) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : 'never');

export function formatDomain(d: any): string[] {
  const lines = [`${d.hostname}  ${STATUS_WORDS[d.status] ?? d.status}`];
  if (d.error) lines.push(`  ${d.error}`);
  if (d.status !== 'active' && d.last_checked) lines.push(`  Last checked ${when(d.last_checked)}.`);
  return lines;
}
export function formatInstructions(i: any): string[] {
  if (!i?.steps) return [];
  const lines = ['', i.summary];
  for (const s of i.steps) lines.push(`  ${s.type}  ${s.name}  ->  ${s.value}`, `      ${s.what}`);
  for (const n of i.notes ?? []) lines.push('', n);
  return lines;
}

export async function handleDomains(args: string[], apiUrl: string, out: (s: string) => void = console.log) {
  const a = parseDomainsArgs(args);
  if (typeof a === 'string') { console.error('Error: ' + a); process.exit(1); }
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(a.project)}/domains`;
  const call = async (method: string, path: string, body?: unknown): Promise<any> => {
    const res = await fetch(base + path, { method, ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error(`Error: ${j.error || res.statusText}`); process.exit(1); }
    return j;
  };
  const find = async (hostname: string) => {
    const d = (await call('GET', '')).domains.find((x: any) => x.hostname === hostname);
    if (!d) { console.error(`Error: ${a.project} has no domain called ${hostname}. Run: platform domains --project ${a.project}`); process.exit(1); }
    return d;
  };
  switch (a.action) {
    case 'list': {
      const b = await call('GET', '');
      if (a.json) return out(JSON.stringify(b, null, 2));
      if (!b.domains.length) return out(`${a.project} has no custom domains. Add one with: platform domains add <hostname> --project ${a.project}`);
      for (const d of b.domains) for (const l of formatDomain(d)) out(l);
      return;
    }
    case 'add': {
      const b = await call('POST', '', { hostname: a.hostname });
      if (a.json) return out(JSON.stringify(b, null, 2));
      // A name someone else holds without having proved it: not an error. Put this TXT record in DNS and the name is switched to this project by itself.
      if (b.challenge) {
        for (const l of [b.message, '', 'Add this record at the DNS for ' + b.challenge.hostname + ':', `  ${b.challenge.record.type}  ${b.challenge.record.name}  ->  ${b.challenge.record.value}`, '', `It is checked every few minutes until ${new Date(b.challenge.expires_at).toLocaleDateString()}.`]) out(l);
        return;
      }
      for (const l of formatDomain(b.domain)) out(l);
      for (const l of formatInstructions(b.instructions)) out(l);
      out('');
      out(`Check progress with: platform domains show ${b.domain.hostname} --project ${a.project}`);
      return;
    }
    case 'show': {
      const d = await find(a.hostname!);
      const b = await call('GET', `/${encodeURIComponent(d.id)}`);
      if (a.json) return out(JSON.stringify(b, null, 2));
      for (const l of formatDomain(b.domain)) out(l);
      for (const l of formatInstructions(b.domain.instructions)) out(l);
      return;
    }
    case 'remove': {
      const d = await find(a.hostname!);
      const b = await call('DELETE', `/${encodeURIComponent(d.id)}`);
      return out(a.json ? JSON.stringify(b, null, 2) : b.message);
    }
  }
}
