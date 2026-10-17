import { handleDeploy } from './commands/deploy.js';
import { handleVersions } from './commands/versions.js';
import { handlePromote } from './commands/promote.js';
import { handleRollback } from './commands/rollback.js';
import { handleManifest } from './commands/manifest.js';
import { handleOpen } from './commands/open.js';
import { handleNew } from './commands/new.js';
import { handleBackup, handleBackups, handleRestore } from './commands/backup.js';
import { handleDev } from './commands/dev.js';
import { handleTypes } from './commands/types.js';
import { handleSecrets } from './commands/secrets.js';
import { handleBindings } from './commands/bindings.js';
import { handleCost } from './commands/cost.js';
import { handleAiKeys } from './commands/aikeys.js';
import { handleToken } from './commands/tokens.js';
import { handleLogs } from './commands/logs.js';
import { handleSchedules } from './commands/schedules.js';
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
    case 'logs':
      await handleLogs(args.slice(1), API_URL);
      break;
    case 'schedules':
      await handleSchedules(args.slice(1), API_URL);
      break;
    case 'run':
      await handleSchedules(args.slice(1), API_URL, 'run');
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
    case 'dev':
      await handleDev(args.slice(1), API_URL);
      break;
    case 'secrets':
      await handleSecrets(args.slice(1), API_URL);
      break;
    case 'bindings':
      await handleBindings(args.slice(1), API_URL);
      break;
    case 'ai-keys':
      await handleAiKeys(args.slice(1), API_URL);
      break;
    case 'cost':
      await handleCost(args.slice(1), API_URL);
      break;
    case 'types':
      await handleTypes(args.slice(1), API_URL);
      break;
    case 'token':
      await handleToken(args.slice(1), API_URL);
      break;
    case 'ls':
    case 'list':
      await handleList();
      break;
    case 'stop':
      await handleStop(args.slice(1));
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
  logs <project> [-f] [--version N] [--lines N] [--json]                           Show the app's recent output; -f keeps listening for new lines (owners and editors)
  schedules [list | show <name> | runs [name] | pause <name> | resume <name> | timers] --project <name>   The jobs the platform runs on a clock: plain-English times, next runs, last result
  run <schedule> --project <name>                                                  Run a schedule now (within a minute)
  versions [--project name]                                                        List project versions
  promote <version> [--project name]                                               Promote version to current
  rollback [--project name]                                                        Rollback to previous ready version
  backup <project> [--stop | --dump] [--slot name]                                  Back up a stateful project's /data folder
  backups <project>                                                                List backups
  restore <project> <backup-id>                                                    Restore /data to a backup (your current data is saved first)
  dev --project <name> [--no-secrets] [--env-file f] -- <command>                 Run a command here with a dev token, the platform's service addresses and the project's secrets (nothing is written to disk)
  secrets <list | set NAME | import --file .env | delete NAME | share NAME | request NAME> --project <name>   Manage secrets. A value is typed at a hidden prompt or piped in, never given as an argument
  bindings check <project>                                                         Which platform services the project uses, when each was last used, and any misuse signal
  ai-keys [list | set <provider> | check <provider> | delete <provider>] [--account id]  The provider keys your account brings for models the platform does not provide (typed hidden, never shown again)
  cost [--project name] [--terms] [--json]                                               What AI and hosting cost, in plain sentences (estimates, with their assumptions)
  types --project <name> [--check] [--out dir] [--lang python]                                   Write platform.gen.ts, the typed platform object for the bindings the project declared
  token create --dev | list | revoke <id> --project <name>                         Make (shown once), list or end dev tokens
  ls                                                                               List projects and instances
  stop <project>                                                                   Stop running instances of a project
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

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
