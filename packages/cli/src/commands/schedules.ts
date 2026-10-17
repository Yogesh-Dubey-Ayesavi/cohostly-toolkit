// platform schedules [<project>] [--project p] [--json]            the project's schedules in plain English, with the next run times and the last result
// platform schedules show <schedule> --project p                   one schedule with its cost sentence and recent runs
// platform schedules runs [<schedule>] --project p [--json]        the latest runs
// platform schedules pause|resume <schedule> --project p           stop / restart a schedule
// platform schedules timers --project p  |  cancel-timer <id>      one-off timers an app made
// platform run <schedule> --project p                               run it now (within a minute)
// Phase 13B. Every change goes through the same API routes the dashboard and the assistants use, so it is audited the same way.
export interface SchedulesArgs { action: 'list' | 'show' | 'runs' | 'pause' | 'resume' | 'timers' | 'cancel-timer' | 'run'; project: string; name?: string; json: boolean }

const USAGE = 'Use: platform schedules [list | show <name> | runs [name] | pause <name> | resume <name> | timers | cancel-timer <id>] --project <project> [--json]   or   platform run <name> --project <project>';

export function parseSchedulesArgs(args: string[], verb: 'schedules' | 'run' = 'schedules'): SchedulesArgs | string {
  let project = '', json = false; const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === '--json') json = true;
    else if (x === '--project') { project = args[++i] ?? ''; if (!project) return '--project needs a project name'; }
    else if (x.startsWith('-')) return `I do not know "${x}". ${USAGE}`;
    else rest.push(x);
  }
  if (verb === 'run') {
    if (!rest[0]) return `Which schedule? ${USAGE}`;
    if (rest.length > 1) return `Too many words. ${USAGE}`;
    return project ? { action: 'run', project, name: rest[0], json } : 'project name required: platform run <schedule> --project <project>';
  }
  const verbs = ['list', 'show', 'runs', 'pause', 'resume', 'timers', 'cancel-timer'];
  let action: SchedulesArgs['action'] = 'list';
  if (rest[0] && verbs.includes(rest[0])) action = rest.shift() as SchedulesArgs['action'];
  else if (rest.length === 1 && !project) { project = rest.shift()!; } // platform schedules <project>
  if (!project && rest.length && action !== 'list' && rest.length > 1) { project = rest.pop()!; } // platform schedules runs <name> <project>
  const name = rest[0];
  if (rest.length > 1) return `Too many words. ${USAGE}`;
  if (['show', 'pause', 'resume', 'cancel-timer'].includes(action) && !name) return `Which ${action === 'cancel-timer' ? 'timer id' : 'schedule'}? ${USAGE}`;
  return project ? { action, project, ...(name ? { name } : {}), json } : 'project name required: platform schedules --project <project>';
}

const ago = (iso: string | null | undefined) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : 'never');
const dur = (ms: number | null | undefined) => (ms == null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`);

export function formatSchedule(s: any): string[] {
  const state = s.enabled ? '' : '  [PAUSED' + (s.disabled_reason ? `: ${s.disabled_reason}` : '') + ']';
  const last = s.last_run ? `${s.last_run.status}${s.last_run.exit_code != null ? ` (exit ${s.last_run.exit_code})` : s.last_run.http_status != null ? ` (HTTP ${s.last_run.http_status})` : ''} at ${ago(s.last_run.scheduled_for)}` : 'not run yet';
  const lines = [`${s.name}  ${s.plain}${state}`, `  ${s.defined_in}. Last: ${last}.`];
  if (s.next_runs?.length) lines.push(`  Next: ${s.next_runs.slice(0, 3).map(ago).join(', ')}`);
  return lines;
}
export const formatRun = (r: any): string => `${ago(r.scheduled_for)}  ${String(r.status).padEnd(10)} ${r.schedule}  try ${r.attempt}/${r.max_attempts}${r.exit_code != null ? `  exit ${r.exit_code}` : ''}${r.http_status != null ? `  HTTP ${r.http_status}` : ''}${r.duration_ms != null ? `  ${dur(r.duration_ms)}` : ''}${r.reason || r.error ? `  - ${r.error || r.reason}` : ''}`;

export async function handleSchedules(args: string[], apiUrl: string, verb: 'schedules' | 'run' = 'schedules', out: (s: string) => void = console.log) {
  const a = parseSchedulesArgs(args, verb);
  if (typeof a === 'string') { console.error('Error: ' + a); process.exit(1); }
  const base = `${apiUrl}/v1/projects/${encodeURIComponent(a.project)}`;
  const call = async (method: string, path: string): Promise<any> => {
    const res = await fetch(base + path, { method });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error(`Error: ${body.error || res.statusText}`); process.exit(1); }
    return body;
  };
  const enc = (s: string) => encodeURIComponent(s);
  switch (a.action) {
    case 'list': {
      const b = await call('GET', '/schedules');
      if (a.json) return out(JSON.stringify(b, null, 2));
      if (!b.schedules.length) return out(`${a.project} has no schedules. Add bindings.cron to the manifest, or use platform.cron in the code.`);
      for (const s of b.schedules) for (const l of formatSchedule(s)) out(l);
      return;
    }
    case 'show': {
      const s = await call('GET', `/schedules/${enc(a.name!)}`);
      if (a.json) return out(JSON.stringify(s, null, 2));
      for (const l of formatSchedule(s)) out(l);
      if (s.cost) out(`  Cost: ${s.cost.sentence}`);
      out('  Recent runs:'); for (const r of s.recent_runs.slice(0, 10)) out('    ' + formatRun(r));
      return;
    }
    case 'runs': {
      const b = await call('GET', a.name ? `/schedules/${enc(a.name)}/runs` : '/schedule-runs');
      if (a.json) return out(JSON.stringify(b, null, 2));
      if (!b.runs.length) return out('No runs yet.');
      for (const r of b.runs) out(formatRun(r));
      return;
    }
    case 'run': { const b = await call('POST', `/schedules/${enc(a.name!)}/run`); return out(a.json ? JSON.stringify(b, null, 2) : `${b.message} (run ${b.run.id})`); }
    case 'pause': case 'resume': { const b = await call('POST', `/schedules/${enc(a.name!)}/${a.action}`); return out(a.json ? JSON.stringify(b, null, 2) : b.message); }
    case 'timers': {
      const b = await call('GET', '/timers');
      if (a.json) return out(JSON.stringify(b, null, 2));
      if (!b.timers.length) return out('No timers are waiting.');
      for (const t of b.timers) out(`${t.id}  ${t.name}  ${ago(t.run_at)}`);
      return;
    }
    case 'cancel-timer': { await call('DELETE', `/timers/${enc(a.name!)}`); return out('Cancelled.'); }
  }
}
