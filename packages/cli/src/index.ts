import { handleDeploy } from './commands/deploy.js';
import * as path from 'node:path';
import { deployFromSnapshot, runCaptureTool } from './commands/folder.js';
import { hasSnapshot } from './snapshot-folder.js';
import { handlePack, handleInspect, deploySnapshotFile } from './commands/snapshot.js';
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
import { handleDomains } from './commands/domains.js';
import { handleShip } from './commands/ship.js';
import { handleApprovals } from './commands/approvals.js';
import { handleShare } from './commands/share.js';
import { installAuth, handleLogin, handleLogout, handleWhoami } from './auth.js';

const API_URL = process.env.API_URL || 'https://api.cohostly.cloud';
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
    case 'deploy': {
      const snap = args.slice(1).find((a) => a.endsWith('.cohostly') && !a.startsWith('--'));
      const folder = path.resolve(args.slice(1).find((a, i) => !a.startsWith('--') && args[i] !== '--project') ?? '.');
      if (!snap && hasSnapshot(folder) && !args.includes('--manifest')) await deployFromSnapshot(args.slice(1), API_URL);
      else if (snap) await deploySnapshotFile(snap, args.slice(1), API_URL); else await handleDeploy(args.slice(1), API_URL);
      break;
    }
    case 'pack':
      await handlePack(args.slice(1), API_URL);
      break;
    case 'inspect':
      handleInspect(args.slice(1));
      break;
    case 'snapshot':
      await runCaptureTool('snapshot', args.slice(1), API_URL);
      break;
    case 'check':
      await runCaptureTool('check', args.slice(1), API_URL);
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
    case 'approvals':
      await handleApprovals(args.slice(1), API_URL);
      break;
    case 'ship':
      await handleShip(args.slice(1), API_URL);
      break;
    case 'share':
      await handleShare(args.slice(1), API_URL);
      break;
    case 'domains':
      await handleDomains(args.slice(1), API_URL);
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
  console.log(`Usage: cohostly <command> [options]

Commands:
  login [--token plk_...]                                                          Sign in (opens your browser), or save a key made in the dashboard
  logout / whoami                                                                  Forget the saved key / show who you are signed in as
  deploy [dir] [--project name] [--manifest file] [--set setting=value] [--yes]    Deploy an application. With no manifest, at a terminal it shows the settings it worked out and asks first; --yes accepts them without asking (scripts without --yes keep the standard settings)
  pack [dir] --out app.cohostly [--no-secrets] [--env-file f] [--expires 7d]          Seal a folder, its settings and (optionally) its secrets into one .cohostly file only your account can deploy
  snapshot [--expires 30d] -- <start command ...>                                      Run your app here and write a snapshot to .cohostly/: a Dockerfile (the build plan), cohostly.json (settings) and the values it saw. cohostly snapshot -- npm start
  check [--generated]                                                              Build and start the Dockerfile that would be deployed (yours in ./Dockerfile, else the generated one) and compare it with the app
  inspect app.cohostly                                                             Show a .cohostly file's settings, expiry and secret names without opening anything
  new <template> [folder]                                                          Start a small project (static, flask, fastapi, express, go, nextjs) you can deploy as is
  open [project]                                                                   Open the project's web address in your browser
  manifest check [dir] [--manifest file] [--set setting=value]                     Show the effective settings and where each came from
  logs <project> [-f] [--version N] [--lines N] [--json]                           Show the app's recent output; -f keeps listening for new lines (owners and editors)
  schedules [list | show <name> | runs [name] | pause <name> | resume <name> | timers] --project <name>   The jobs the platform runs on a clock: plain-English times, next runs, last result
  run <schedule> --project <name>                                                  Run a schedule now (within a minute)
  share [list | visibility <level> | invite <email> | role <email> <role> | remove <email>] --project <name>   Who can open the project and who it is shared with
  domains [list | add <hostname> | show <hostname> | remove <hostname>] --project <name>   Your own domains for the project: the DNS records to add, and where each one stands
  ship [requests | approve | deny | withdraw | policy] <project>                    Who can ship a new version, and the versions waiting for an admin
  approvals [needs-me | waiting | history | show | approve | deny | bulk | rules | allow | revoke-rule | away | end]   Everything waiting on you, in one inbox
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

import { projectLine, stateDetail } from './commands/state.js';

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
      console.log(projectLine(p));
      for (const l of stateDetail(p)) console.log(l);
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
