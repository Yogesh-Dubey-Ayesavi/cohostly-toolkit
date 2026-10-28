import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { packFolder } from './commands/deploy.js';

/** Where `cohostly snapshot` keeps the snapshot, next to the app. */
export const SNAPSHOT_DIR = '.cohostly';
const TODO = 'TODO(cohostly):';
const WARNING = 'WARNING(cohostly):';
const NOTE = 'NOTE(cohostly):';
const linesTagged = (text: string, tag: string) => text.split('\n').filter((l) => l.includes(tag)).map((l) => l.slice(l.indexOf(tag) + tag.length).trim());
const SKIP = new Set([SNAPSHOT_DIR, 'node_modules', '.git', '.next', '.venv', 'venv', '__pycache__']);

export interface Snapshot {
  settings: { name: string; health: { port?: number; path?: string }; env?: { secrets?: string[] }; [k: string]: unknown };
  /** The Dockerfile snapshot generated (.cohostly/Dockerfile). */
  generated: string;
  /** The developer's own Dockerfile in the project root, when there is one. */
  own: boolean;
  /** Captured values for the names the settings list. */
  values: Record<string, string>;
  /** What the tool could not decide, as it wrote it in the Dockerfile. */
  open: string[];
  /** A likely problem that does not stop a deploy (an app that listened on loopback only). */
  warnings: string[];
  /** Information that does not stop a deploy (a variable with no value here). */
  notes: string[];
  /** The text of .cohostly/env.enc, when the values were sealed and no plain env.json is left. */
  sealedEnv?: string;
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const hasSnapshot = (dir: string) => fs.existsSync(path.join(dir, SNAPSHOT_DIR, 'cohostly.json'));

/** Reads the snapshot folder. Throws, in words a person or an agent can act on, when there is nothing to deploy. */
export function readSnapshot(dir: string): Snapshot {
  const base = path.join(dir, SNAPSHOT_DIR);
  if (!hasSnapshot(dir)) throw new Error(`There is no snapshot in ${dir}. Make one with: cohostly snapshot -- <start command>`);
  const settings = readJson(path.join(base, 'cohostly.json'));
  const generated = fs.readFileSync(path.join(base, 'Dockerfile'), 'utf8');
  if (!settings.health?.port) throw new Error(`${SNAPSHOT_DIR}/cohostly.json has no health.port. The app never listened while it was observed; set the port there, or snapshot again with a longer --timeout.`);
  const envFile = path.join(base, 'env.json');
  const captured: Record<string, { value: string }> = fs.existsSync(envFile) ? readJson(envFile) : {};
  const values: Record<string, string> = {};
  for (const n of settings.env?.secrets ?? []) if (captured[n]?.value !== undefined) values[n] = captured[n].value;
  const sealedFile = path.join(base, 'env.enc');
  const sealedEnv = !Object.keys(values).length && fs.existsSync(sealedFile) ? fs.readFileSync(sealedFile, 'utf8') : undefined;
  return {
    settings, generated, own: fs.existsSync(path.join(dir, 'Dockerfile')), values, sealedEnv,
    open: linesTagged(generated, TODO), warnings: linesTagged(generated, WARNING), notes: linesTagged(generated, NOTE),
  };
}

/** The app's files for the upload. A Dockerfile in the project root is the developer's and is kept; without one the generated Dockerfile is added. `useGenerated` replaces the root one. Nothing from .cohostly goes up as a file. */
export function stageSource(dir: string, s: Snapshot, useGenerated = false): Buffer {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cohostly-snapshot-'));
  try {
    fs.cpSync(dir, tmp, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
    if (!s.own || useGenerated) fs.writeFileSync(path.join(tmp, 'Dockerfile'), s.generated);
    return packFolder(tmp);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/** The request fields for POST /v1/deploy. The settings are the file as the developer left it; values travel only in `secrets`, in the request body. */
export function deployFields(s: Snapshot, project: string): Record<string, string> {
  const names = Object.keys(s.values);
  return {
    project, engine: 'auto', manifest: JSON.stringify({ ...s.settings, name: project }),
    ...(names.length ? { secrets: JSON.stringify(s.values) } : {}), ...(s.sealedEnv ? { sealed_env: s.sealedEnv } : {}),
  };
}
