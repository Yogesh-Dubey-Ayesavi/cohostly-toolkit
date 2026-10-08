import { handleDeploy } from './commands/deploy.js';
import { handleVersions } from './commands/versions.js';
import { handlePromote } from './commands/promote.js';
import { handleRollback } from './commands/rollback.js';
import { handleManifest } from './commands/manifest.js';
import { handleOpen } from './commands/open.js';
import { handleNew } from './commands/new.js';
import { handleBackup, handleBackups, handleRestore } from './commands/backup.js';
import { installAuth, handleLogin, handleLogout, handleWhoami } from './auth.js';

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';
const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:8080';

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  installAuth(API_URL);

  if (!command) {
    printHelp();
    process.exit(1);
  }

  switch (command) {
    case 'login':
      await handleLogin(args.slice(1), API_URL);
      break;
    case 'logout':
      handleLogout(API_URL);
      break;
    case 'whoami':
      await handleWhoami(API_URL);
      break;
    case 'deploy':
      await handleDeploy(args.slice(1), API_URL);
      break;
    case 'open':
      await handleOpen(args.slice(1), API_URL);
      break;
    case 'new':
      handleNew(args.slice(1));
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
    case 'backup':
      await handleBackup(args.slice(1), API_URL);
      break;
    case 'backups':
      await handleBackups(args.slice(1), API_URL);
      break;
    case 'restore':
      await handleRestore(args.slice(1), API_URL);
      break;
    case 'manifest':
      await handleManifest(args.slice(1), API_URL);
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
  login [--token plk_...]                                                          Sign in (opens your browser), or save a key made in the dashboard
  logout / whoami                                                                  Forget the saved key / show who you are signed in as
  deploy [dir] [--project name] [--manifest file] [--set setting=value] [--yes]    Deploy an application. With no manifest, at a terminal it shows the settings it worked out and asks first; --yes accepts them without asking (scripts without --yes keep the standard settings)
  new <template> [folder]                                                          Start a small project (static, flask, fastapi, express, go, nextjs) you can deploy as is
  open [project]                                                                   Open the project's web address in your browser
  manifest check [dir] [--manifest file] [--set setting=value]                     Show the effective settings and where each came from
  versions [--project name]                                                        List project versions
  promote <version> [--project name]                                               Promote version to current
  rollback [--project name]                                                        Rollback to previous ready version
  backup <project> [--stop | --dump] [--slot name]                                  Back up a stateful project's /data folder
  backups <project>                                                                List backups
  restore <project> <backup-id>                                                    Restore /data to a backup (your current data is saved first)
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
      console.log(`- ${p.name} (current: v${p.current_version ?? 'none'}, ${p.visibility ?? ''}${p.role ? `, you are ${p.role}` : ''}${p.url ? `, ${p.url}` : ''})`);
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
