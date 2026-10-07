import * as path from 'node:path';
import * as fs from 'node:fs';
import { takeSetFlags, printSettings } from './manifest.js';

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

  try {
    const res = await fetch(`${apiUrl}/v1/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project,
        src_dir: srcDir,
        engine,
        manifest_path: fullManifestPath || undefined,
        manifest_content: manifestContent || undefined,
        overrides: Object.keys(overrides).length ? overrides : undefined,
      }),
    });

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
