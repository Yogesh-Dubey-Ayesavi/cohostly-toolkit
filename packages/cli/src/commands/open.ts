import * as path from 'node:path';
import { spawn } from 'node:child_process';

/** `platform open [project]`: opens the project's web address in the browser. With no name, the folder's name is used (the default deploy name). */
export async function handleOpen(args: string[], apiUrl: string) {
  const flag = args.indexOf('--project');
  const project = (flag >= 0 ? args[flag + 1] : args.find((a) => !a.startsWith('--'))) || path.basename(process.cwd());
  const res = await fetch(`${apiUrl}/v1/projects/${encodeURIComponent(project)}`);
  if (res.status === 404) { console.error(`There is no project called "${project}" that you can see. Run "platform ls" to list yours.`); process.exit(1); }
  if (!res.ok) { console.error(`Could not look up ${project}: ${res.statusText}`); process.exit(1); }
  const p = (await res.json()) as any;
  if (!p.current_version) { console.error(`${project} has no live version yet. Run "platform deploy" first.`); process.exit(1); }
  console.log(p.url);
  if (args.includes('--print') || process.env.PLATFORM_NO_BROWSER) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  spawn(cmd, process.platform === 'win32' ? ['/c', 'start', '', p.url] : [p.url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}
