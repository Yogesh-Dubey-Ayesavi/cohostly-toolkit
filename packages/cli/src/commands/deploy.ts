import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { takeSetFlags, printSettings } from './manifest.js';

const MAX_UPLOAD = 50 * 1024 * 1024; // the API's upload limit

/** Packs the folder into a .tar.gz (without node_modules, .git and similar) so the API can be on another machine. */
function packFolder(dir: string): Buffer {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-deploy-'));
  const file = path.join(tmp, 'source.tar.gz');
  try {
    execFileSync('tar', ['-czf', file, '--exclude=node_modules', '--exclude=.git', '--exclude=.vercel', '--exclude=.next', '--exclude=__pycache__', '--exclude=.DS_Store', '-C', dir, '.'], { stdio: 'pipe' });
    return fs.readFileSync(file);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

export async function handleDeploy(rawArgs: string[], apiUrl: string) {
  const { rest: args, overrides } = takeSetFlags(rawArgs);
  const showSettings = args.includes('--show-settings');
  let dir = '.';
  let engine = 'auto';
  let project = '';
  let manifestPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine' && args[i + 1]) {
      engine = args[i + 1];
      i++;
    } else if (args[i] === '--project' && args[i + 1]) {
      project = args[i + 1];
      i++;
    } else if (args[i] === '--manifest' && args[i + 1]) {
      manifestPath = args[i + 1];
      i++;
    } else if (args[i] === '--show-settings') {
      // handled above
    } else if (!args[i].startsWith('--')) {
      dir = args[i];
    }
  }

  const srcDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: directory not found: ${srcDir}`);
    process.exit(1);
  }

  if (!project) {
    project = path.basename(srcDir);
  }

  let fullManifestPath = '';
  let manifestContent = '';
  if (manifestPath) {
    fullManifestPath = path.resolve(process.cwd(), manifestPath);
    if (!fs.existsSync(fullManifestPath)) {
      console.error(`Error: manifest file not found: ${fullManifestPath}`);
      process.exit(1);
    }
    manifestContent = fs.readFileSync(fullManifestPath, 'utf-8');
  }

  let archive: Buffer;
  try { archive = packFolder(srcDir); } catch (e: any) { console.error(`Could not pack ${srcDir}: ${e.message}`); process.exit(1); }
  if (archive.length > MAX_UPLOAD) {
    console.error(`The folder is ${(archive.length / 1048576).toFixed(1)} MB after packing; the limit is 50 MB. Remove build output and large files (node_modules and .git are already left out).`);
    process.exit(1);
  }

  try {
    // The folder is uploaded: the API runs on another machine and cannot read this disk.
    const form = new FormData();
    form.set('project', project);
    form.set('engine', engine);
    if (manifestContent) form.set('manifest', manifestContent);
    if (Object.keys(overrides).length) form.set('overrides', JSON.stringify(overrides));
    form.set('tarball', new Blob([new Uint8Array(archive)]), 'source.tar.gz');
    const res = await fetch(`${apiUrl}/v1/deploy`, { method: 'POST', body: form });

    const data = (await res.json()) as any;
    if (!res.ok) {
      console.error(`Deployment failed: ${data.details || data.error || res.statusText}`);
      process.exit(1);
    }

    console.log(`Deployed project: ${data.project} (version v${data.version})`);
    console.log(`URL:    ${data.url}`);
    if (data.deduped) console.log(`Notice: ${data.notice}`);
    for (const n of data.notices ?? []) console.log(`Notice: ${n}`);
    if ((data.no_manifest || showSettings) && data.settings) printSettings(data.settings, data.no_manifest ? 'Settings used (no manifest, so these are the defaults):' : 'Settings used:');
    if (data.warnings && data.warnings.length > 0) {
      for (const w of data.warnings) {
        console.warn(`Warning: ${w}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to connect to API at ${apiUrl}: ${err.message}`);
    process.exit(1);
  }
}
