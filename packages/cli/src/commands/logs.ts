// platform logs <project> [-f] [--version N] [--since ID] [--lines N] [--json]
// Phase 13. Prints an app's recent output. With -f it keeps listening (server-sent events) and prints each new line as it arrives. Only owners and editors can read logs.
export interface LogLine { id: number; at: string; stream: string; version: number | null; text: string; request_id: string | null }
export interface LogsArgs { project: string; follow: boolean; version?: number; since?: number; lines?: number; json: boolean }

export function parseLogsArgs(args: string[]): LogsArgs | string {
  const a: LogsArgs = { project: '', follow: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const x = args[i], next = () => args[++i];
    if (x === '-f' || x === '--follow') a.follow = true;
    else if (x === '--json') a.json = true;
    else if (x === '--version') { const n = Number(next()); if (!Number.isInteger(n) || n < 1) return '--version needs a version number, for example --version 3'; a.version = n; }
    else if (x === '--since') { const n = Number(next()); if (!Number.isInteger(n) || n < 0) return '--since needs a line id (the last id printed)'; a.since = n; }
    else if (x === '--lines' || x === '-n') { const n = Number(next()); if (!Number.isInteger(n) || n < 1 || n > 1000) return '--lines needs a number from 1 to 1000'; a.lines = n; }
    else if (x === '--project') a.project = next() ?? '';
    else if (!x.startsWith('-') && !a.project) a.project = x;
    else return `I do not know "${x}". Use: platform logs <project> [-f] [--version N] [--since ID] [--lines N] [--json]`;
  }
  return a.project ? a : 'project name required (platform logs <project> -f)';
}

export const formatLine = (l: LogLine): string => `${l.at.slice(11, 23)}${l.stream === 'stderr' ? ' !' : l.stream === 'platform' ? ' #' : '  '} ${l.request_id ? `[${l.request_id}] ` : ''}${l.text}`;

export async function handleLogs(args: string[], apiUrl: string, out: (s: string) => void = console.log) {
  const a = parseLogsArgs(args);
  if (typeof a === 'string') { console.error('Error: ' + a); process.exit(1); }
  const qs = new URLSearchParams();
  if (a.version) qs.set('version', String(a.version));
  if (a.since !== undefined) qs.set('since', String(a.since));
  if (a.lines) qs.set('limit', String(a.lines));
  if (a.follow) qs.set('follow', 'true');
  const url = `${apiUrl}/v1/projects/${encodeURIComponent(a.project)}/logs?${qs}`;
  const show = (l: LogLine) => out(a.json ? JSON.stringify(l) : formatLine(l));
  try {
    const res = await fetch(url, { headers: a.follow ? { accept: 'text/event-stream' } : {} });
    if (!res.ok) { const e: any = await res.json().catch(() => ({})); console.error(`Could not read logs: ${e.error || res.statusText}`); process.exit(1); }
    if (!a.follow) {
      const data = (await res.json()) as { lines: LogLine[] };
      for (const l of data.lines) show(l);
      if (!data.lines.length) {
        // Nothing stored: ask the running sandbox why (and what the app itself last printed), instead of leaving a blank screen.
        const d = await fetch(`${apiUrl}/v1/projects/${encodeURIComponent(a.project)}/logs/diagnose`).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { reason?: string; app_output_tail?: string[] } | null;
        out(`(no log lines yet) ${d?.reason ?? 'If the app should be running, open it once; logs appear a second after it writes them.'}`);
        for (const l of d?.app_output_tail ?? []) out(`  | ${l}`);
      }
      return;
    }
    // Server-sent events: blocks of "id:/event:/data:" lines separated by a blank line.
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += dec.decode(value, { stream: true });
      let at: number;
      while ((at = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, at); buf = buf.slice(at + 2);
        const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
        if (!data || !/^event: log$/m.test(block)) continue;
        show(JSON.parse(data) as LogLine);
      }
    }
  } catch (err: any) { console.error(`Failed to connect to API: ${err.message}`); process.exit(1); }
}
