import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundledTool } from './vendor.js';

// Keep the version equal to RAILPACK_VERSION in packages/image-builder/src/railpack.ts and the planner's Dockerfile.
// URLs and SHA-256 digests are the ones the v0.43.0 release page lists (https://github.com/railwayapp/railpack/releases/tag/v0.43.0).
const BASE = 'https://github.com/railwayapp/railpack/releases/download/v0.43.0';
export const RAILPACK = {
  version: '0.43.0',
  assets: {
    'darwin-arm64': { url: `${BASE}/railpack-v0.43.0-arm64-apple-darwin.tar.gz`, sha256: '385026934127726fd0f9b5a1431c5ae441062ea9958a5f9dbb0e98a29142d6de' },
    'darwin-x64': { url: `${BASE}/railpack-v0.43.0-x86_64-apple-darwin.tar.gz`, sha256: 'd71e906eaf61789d6e71cc118cf814698e7b82ba99f796cc6548b270ba33dffd' },
    'linux-arm64': { url: `${BASE}/railpack-v0.43.0-arm64-unknown-linux-musl.tar.gz`, sha256: '732ece14eb4f4676a43ebba19431f954edf7b130acb76159ef0f2ff86ac42ac9' },
    'linux-x64': { url: `${BASE}/railpack-v0.43.0-x86_64-unknown-linux-musl.tar.gz`, sha256: '248a8f60f36854aabed6124113631078a802de3461660855fc4de9c26065c1fb' },
  } as Record<string, { url: string; sha256: string }>,
}

export interface EnsureOptions {
  /** Replaces the pinned table, for tests. */
  table?: typeof RAILPACK
  platform?: string
  arch?: string
  /** Where tools are cached; default ~/.cohostly/tools. */
  toolsDir?: string
  env?: NodeJS.ProcessEnv
  log?: (line: string) => void
}

function versionOf(bin: string): string | null {
  try {
    const out = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] })
    return out.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null
  } catch { return null }
}

export async function ensureRailpack(opts: EnsureOptions = {}): Promise<string> {
  const table = opts.table ?? RAILPACK
  const env = opts.env ?? process.env
  const log = opts.log ?? ((l: string) => console.log(l))
  const platform = opts.platform ?? process.platform
  if (platform === 'win32') throw new Error('Capture runs on macOS and Linux. On Windows, use WSL2.')

  const own = env.COHOSTLY_RAILPACK
  if (own) {
    const v = versionOf(own)
    if (v !== table.version) throw new Error(`COHOSTLY_RAILPACK (${own}) must print version ${table.version}${v ? `, but it printed ${v}` : ' when run with --version'}.`)
    log('using your own Railpack build')
    return own
  }

  const bundled = bundledTool('railpack', { platform, arch: opts.arch });
  if (bundled) return bundled

  const dest = join(opts.toolsDir ?? join(homedir(), '.cohostly', 'tools'), `railpack-${table.version}`, 'railpack')
  if (existsSync(dest)) return dest

  const key = `${platform}-${opts.arch ?? process.arch}`
  const asset = table.assets[key]
  if (!asset) throw new Error(`There is no Railpack download for ${key}. Capture runs on macOS and Linux (arm64 or x64).`)

  log(`Downloading Railpack ${table.version} (once) ...`)
  const res = await fetch(asset.url)
  if (!res.ok) throw new Error(`Could not download Railpack (${res.status}). Check your connection and try again.`)
  const data = Buffer.from(await res.arrayBuffer())
  if (createHash('sha256').update(data).digest('hex') !== asset.sha256) {
    throw new Error('The downloaded Railpack did not match its checksum. Nothing was run.')
  }

  const tmp = mkdtempSync(join(tmpdir(), 'cohostly-railpack-'))
  try {
    const archive = join(tmp, 'railpack.tar.gz')
    writeFileSync(archive, data)
    execFileSync('tar', ['-xzf', archive, '-C', tmp, 'railpack'], { stdio: 'ignore' })
    const bin = join(tmp, 'railpack')
    chmodSync(bin, 0o755)
    if (platform === 'darwin') { try { execFileSync('xattr', ['-d', 'com.apple.quarantine', bin], { stdio: 'ignore' }) } catch { /* not quarantined */ } }
    mkdirSync(join(dest, '..'), { recursive: true })
    // Copy then rename inside the cache folder so a half-written file is never at the final path (tmp may be another filesystem).
    const staged = `${dest}.${process.pid}.part`
    writeFileSync(staged, readFileSync(bin), { mode: 0o755 })
    renameSync(staged, dest)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return dest
}
