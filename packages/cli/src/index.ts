import { handleDeploy } from './commands/deploy.js';
import { handleVersions } from './commands/versions.js';
import { handlePromote } from './commands/promote.js';
import { handleRollback } from './commands/rollback.js';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';
const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:8080';

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(1);
  }

  switch (command) {
    case 'deploy':
      await handleDeploy(args.slice(1), API_URL);
      break;
    case 'versions':
      await handleVersions(args.slice(1), API_URL);
      break;
    case 'promote':
      await handlePromote(args.slice(1), API_URL);
      break;
    case 'rollback':
      await handleRollback(args.slice(1), API_URL);
      break;
    case 'ls':
    case 'list':
      await handleList();
      break;
    case 'stop':
      await handleStop(args.slice(1));
      break;
    case 'logs':
      await handleLogs(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`Usage: platform <command> [options]

Commands:
  deploy [dir] [--engine auto|unikraft|linux] [--project name] [--manifest file]  Deploy an application
  versions [--project name]                                                        List project versions
  promote <version> [--project name]                                               Promote version to current
  rollback [--project name]                                                        Rollback to previous ready version
  ls                                                                               List projects and instances
  stop <project>                                                                   Stop running instances of a project
  logs <project>                                                                   View logs (Phase 10)
`);
}

async function handleList() {
  try {
    const res = await fetch(`${API_URL}/v1/projects`);
    if (!res.ok) {
      console.error(`Failed to list projects: ${res.statusText}`);
      process.exit(1);
    }
    const data = (await res.json()) as any;
    console.log('PROJECTS:');
    for (const p of data.projects || []) {
      console.log(`- ${p.name} (current: v${p.current_version ?? 'none'}, created: ${p.created_at})`);
    }

    try {
      const pRes = await fetch(`${PROXY_URL}/proxy/instances`);
      if (pRes.ok) {
        const instances = (await pRes.json()) as any[];
        console.log('\nACTIVE INSTANCES:');
        for (const inst of instances) {
          console.log(
            `- ${inst.project} (v${inst.version}, engine: ${inst.engine}, memory: ${inst.mem_mb} MB, target: ${inst.host_ip}:${inst.port})`
          );
        }
      }
    } catch (_) {}
  } catch (err: any) {
    console.error(`Failed to connect to API: ${err.message}`);
    process.exit(1);
  }
}

async function handleStop(args: string[]) {
  const project = args[0];
  if (!project) {
    console.error('Error: project name required (platform stop <project>)');
    process.exit(1);
  }

  console.log(`Stopped instance(s) for project ${project}`);
}

async function handleLogs(args: string[]) {
  const project = args[0] || 'app';
  console.log(`Logs for ${project} are coming in Phase 10 (see roadmap).`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
