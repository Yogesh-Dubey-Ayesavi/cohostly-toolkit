import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BundledTool = 'cohostly-capture' | 'railpack';

export interface BundleOptions {
  platform?: string;
  arch?: string;
  /** Replaces <package>/vendor, for tests. */
  root?: string;
}

/** Tools ship inside the CLI package at vendor/<platform>-<arch>/<name> (see scripts/vendor-tools.sh). Returns null when this build of the CLI does not carry one. */
export function bundledTool(name: BundledTool, o: BundleOptions = {}): string | null {
  const root = o.root ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
  const file = join(root, `${o.platform ?? process.platform}-${o.arch ?? process.arch}`, name);
  return existsSync(file) ? file : null;
}

/** The capture binary: COHOSTLY_CAPTURE, else the one bundled with this CLI. */
export function captureBinary(env: NodeJS.ProcessEnv = process.env, o: BundleOptions = {}): string {
  const own = env.COHOSTLY_CAPTURE;
  if (own) {
    if (!existsSync(own)) throw new Error(`COHOSTLY_CAPTURE points at ${own}, which does not exist.`);
    return own;
  }
  const bundled = bundledTool('cohostly-capture', o);
  if (!bundled) throw new Error(`This install of the CLI has no capture tool for ${o.platform ?? process.platform}-${o.arch ?? process.arch}. Build it with "make capture-bin" and set COHOSTLY_CAPTURE to the file it prints.`);
  return bundled;
}
