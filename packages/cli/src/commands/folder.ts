import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fetchSnapshotKey, parseExpires } from '../snapshot/seal.js';
import { sealEnv } from '../snapshot/sealed-env.js';
import { whoAmI } from './snapshot.js';
import { captureBinary } from '../vendor.js';
import { ensureRailpack } from '../tools.js';
import { deployFields, readSnapshot, SNAPSHOT_DIR, stageSource } from '../snapshot-folder.js';
import { postDeploy, reportOutcome } from './deploy.js';

/** Takes a flag and its value out of an argument list. */
function takeOption(args: string[], flag: string): { value?: string; rest: string[] } {
  const i = args.indexOf(flag);
  return i < 0 ? { rest: args } : { value: args[i + 1], rest: [...args.slice(0, i), ...args.slice(i + 2)] };
}

/** Seals the values the snapshot captured into .cohostly/env.enc and removes the plain env.json. If that cannot be done (not signed in, offline) the plain file stays, git-ignored, and the person is told. */
export async function sealCapturedEnv(dir: string, apiUrl: string, o: { expires?: string; account?: string } = {}): Promise<void> {
  const plain = path.join(dir, SNAPSHOT_DIR, 'env.json');
  if (!fs.existsSync(plain)) return;
  const captured = JSON.parse(fs.readFileSync(plain, 'utf8')) as Record<string, { value: string }>;
  const values = Object.fromEntries(Object.entries(captured).map(([n, v]) => [n, v.value]));
  try {
    const expiresAt = new Date(Date.now() + parseExpires(o.expires ?? '30d'));
    const sealed = sealEnv({ key: await fetchSnapshotKey(apiUrl), accountId: (await whoAmI(apiUrl, o.account)).accountId, expiresAt, values });
    fs.writeFileSync(path.join(dir, SNAPSHOT_DIR, 'env.enc'), sealed, { mode: 0o600 });
    fs.rmSync(plain);
    console.error(`Sealed ${Object.keys(values).length} value(s) into ${SNAPSHOT_DIR}/env.enc (only your account can deploy them; expires ${expiresAt.toISOString().slice(0, 10)}). The file is safe to commit.`);
  } catch (e: any) {
    console.error(`Could not seal the values (${e.message}). They stay in ${SNAPSHOT_DIR}/env.json, which is git-ignored. Sign in and run cohostly snapshot again to seal them.`);
  }
}

/** Runs the capture tool in the current folder. `cohostly snapshot -- npm start` and `cohostly check [--generated]`. Its progress goes to the terminal. */
export async function runCaptureTool(command: 'snapshot' | 'check', args: string[], apiUrl: string): Promise<void> {
  const tool = captureBinary();
  const railpack = await ensureRailpack({ log: (l) => console.error(l) });
  let toolArgs = args;
  const seal: { expires?: string; account?: string } = {};
  if (command === 'snapshot') {
    // Only the part before -- is ours: after it is the app's own command line.
    const dd = args.indexOf('--');
    const before = dd < 0 ? args : args.slice(0, dd);
    const expires = takeOption(before, '--expires');
    const account = takeOption(expires.rest, '--account');
    seal.expires = expires.value;
    seal.account = account.value;
    toolArgs = [...account.rest, ...(dd < 0 ? [] : args.slice(dd))];
  }
  const r = spawnSync(tool, [command, ...toolArgs], { stdio: 'inherit', env: { ...process.env, COHOSTLY_RAILPACK: railpack } });
  if (r.error) throw r.error;
  if (command === 'snapshot' && r.status === 0) await sealCapturedEnv(process.cwd(), apiUrl, seal);
  process.exit(r.status ?? 1);
}

/** `cohostly deploy` in a folder that has a snapshot: `[dir] [--project name] [--generated] [--force]`. */
export async function deployFromSnapshot(args: string[], apiUrl: string): Promise<void> {
  const flag = (n: string) => args.includes(n);
  const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const dir = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--project') ?? '.');
  const s = readSnapshot(dir);
  if (s.open.length && !flag('--force')) {
    console.error(`The snapshot has ${s.open.length} open question(s) that were not decided (TODO lines in ${path.join('.cohostly', 'Dockerfile')}):`);
    for (const q of s.open) console.error(`  ${q}`);
    console.error('Settle them, or deploy anyway with --force.');
    process.exit(1);
  }
  for (const w of s.warnings) console.error(`Warning: ${w}`);
  for (const n of s.notes) console.error(`Note: ${n}`);
  const project = opt('--project') ?? s.settings.name;
  console.log(`Deploying ${project} with ${s.own && !flag('--generated') ? 'your Dockerfile' : 'the generated Dockerfile'} ...`);
  const r = await postDeploy(apiUrl, deployFields(s, project), stageSource(dir, s, flag('--generated')), false);
  if (!reportOutcome(r, true)) process.exit(1);
}
