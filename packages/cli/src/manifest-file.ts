import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A copy of findManifestFile and isPlatformManifest in packages/image-builder/src/manifest.ts (the CLI cannot import image-builder).
// manifest-file.test.ts runs the same cases through both copies.

// The settings the schema knows at the top level, from packages/shared/manifest-schema (a file is ours when it sets one besides name and manifest_version).
const KNOWN = new Set(['kind', 'runtime', 'compute', 'lifetime', 'env', 'health', 'visibility', 'network', 'storage', 'session_affinity', 'bindings', 'context', 'listing']);

export function isPlatformManifest(text: string): boolean {
  let m: unknown;
  try { m = JSON.parse(text); } catch { return false; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
  return Object.keys(m).some((k) => k !== 'name' && k !== 'manifest_version' && KNOWN.has(k));
}

export function findManifestFile(dir: string): { file: 'cohostly.json' | 'manifest.json'; text: string; notice?: string } | null {
  const read = (name: string): string | null => { try { const p = join(dir, name); return statSync(p).isFile() ? readFileSync(p, 'utf8') : null; } catch { return null; } };
  const ours = read('cohostly.json');
  if (ours !== null) { const old = read('manifest.json'); return { file: 'cohostly.json', text: ours, ...(old !== null && isPlatformManifest(old) ? { notice: 'Both cohostly.json and manifest.json are here; cohostly.json was used.' } : {}) }; }
  const old = read('manifest.json');
  return old !== null && isPlatformManifest(old) ? { file: 'manifest.json', text: old } : null;
}
