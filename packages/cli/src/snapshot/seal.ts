import { constants, createCipheriv, createHash, publicEncrypt, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

// Phase 25g part 3: sealing a project into a `.cohostly` file. Node's built-in crypto only.
// The app's files and the secret values are encrypted with a random AES-256-GCM key; that key is wrapped with Cohostly's public key (RSA-OAEP, SHA-256) and only the
// platform can open it. The settings stay readable on purpose, so a person or an agent can see what will be built. Sealing protects the file wherever it travels or sits
// outside the platform; Cohostly and its hosting infrastructure still see the code while building it. This is not end-to-end encryption.

export const SNAPSHOT_FORMAT = 'cohostly-snapshot/1';
const ENTRIES = ['snapshot.json', 'cohostly.json', 'source.enc', 'secrets.enc'];

export interface SnapshotKey { key_id: string; public_key_pem: string }
export interface SealInput {
  key: SnapshotKey; accountId: string; createdBy: string; expiresAt: Date; now?: Date;
  /** The resolved settings, exactly as they will be written (readable). */
  settings: Record<string, any>;
  sources?: Record<string, string>;
  tools?: Record<string, string>;
  /** The app's files as an inner .tar.gz. */
  source: Buffer;
  /** Secret name to value; left out entirely when absent or empty. */
  secrets?: Record<string, string>;
}

/** The additional authenticated data of one sealed part: it binds the part to the readable settings, the account and the expiry. The server builds the same text. */
export const aadFor = (m: { format: string; key_id: string; account_id: string; created_at: string; expires_at: string; cohostly_json_sha256: string }, part: 'source' | 'secrets') =>
  Buffer.from(JSON.stringify([m.format, m.key_id, m.account_id, m.created_at, m.expires_at, m.cohostly_json_sha256, part]), 'utf8');

/** 1d to 30d, as a number of milliseconds. */
export function parseExpires(text: string | undefined): number {
  if (text === undefined) return 7 * 86_400_000;
  const m = /^(\d{1,2})d$/.exec(text.trim());
  const days = m ? Number(m[1]) : NaN;
  if (!(days >= 1 && days <= 30)) throw new Error('--expires needs a number of days from 1d to 30d, for example --expires 3d.');
  return days * 86_400_000;
}

/**
 * A plain ustar archive of regular files, written here rather than by the system tar: some tars (macOS) put an extended header before every file, and the format is
 * exactly these entries, in this order, nothing else.
 */
export function ustar(entries: { name: string; data: Buffer }[], mtime: number): Buffer {
  const blocks: Buffer[] = [];
  const octal = (n: number, width: number) => Buffer.from(n.toString(8).padStart(width - 1, '0') + '\0');
  for (const e of entries) {
    if (Buffer.byteLength(e.name) > 100) throw new Error('internal: entry name too long');
    const h = Buffer.alloc(512);
    h.write(e.name, 0, 'utf8'); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    octal(e.data.length, 12).copy(h, 124); octal(mtime, 12).copy(h, 136); h.fill(0x20, 148, 156); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
    let sum = 0; for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, e.data, Buffer.alloc((512 - (e.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

const seal = (key: Buffer, plain: Buffer, aad: Buffer): { iv: Buffer; sealed: Buffer } => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aad);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return { iv, sealed: Buffer.concat([body, c.getAuthTag()]) };
};

/** Refuses settings that hold a secret value, or a plain variable that is also a secret. The readable part must never carry one. */
export function checkReadable(settings: Record<string, any>, secrets: Record<string, string> | undefined) {
  const vars = settings.env?.vars && typeof settings.env.vars === 'object' ? settings.env.vars as Record<string, unknown> : {};
  for (const name of Object.keys(secrets ?? {})) if (name in vars) throw new Error(`${name} is both a plain variable (env.vars) and a secret. A plain variable is written readable in the file, so remove it from env.vars.`);
  for (const [name, value] of Object.entries(secrets ?? {})) if (value.length >= 6 && JSON.stringify(settings).includes(JSON.stringify(value).slice(1, -1))) throw new Error(`The value of ${name} is written in the settings. Remove it; secret values go only in the sealed part.`);
}

/** The `.cohostly` file as bytes (a gzip tar with exactly the entries of the format, in order). */
export function sealSnapshot(i: SealInput): Buffer {
  const secrets = i.secrets && Object.keys(i.secrets).length ? i.secrets : undefined;
  checkReadable(i.settings, secrets);
  const now = i.now ?? new Date();
  const settingsText = JSON.stringify(i.settings, null, 2) + '\n';
  const meta: Record<string, any> = {
    format: SNAPSHOT_FORMAT, key_id: i.key.key_id, wrapped_key: '', account_id: i.accountId, created_by: i.createdBy, created_at: now.toISOString(), expires_at: i.expiresAt.toISOString(),
    cohostly_json_sha256: createHash('sha256').update(settingsText).digest('hex'), parts: {}, tools: i.tools ?? {}, sources: i.sources ?? {},
  };
  const dataKey = randomBytes(32);
  try {
    meta.wrapped_key = publicEncrypt({ key: i.key.public_key_pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, dataKey).toString('base64');
    const src = seal(dataKey, i.source, aadFor(meta as any, 'source'));
    meta.parts.source = { iv: src.iv.toString('base64'), bytes: src.sealed.length };
    let sec: { iv: Buffer; sealed: Buffer } | undefined;
    if (secrets) { sec = seal(dataKey, Buffer.from(JSON.stringify(secrets), 'utf8'), aadFor(meta as any, 'secrets')); meta.parts.secrets = { iv: sec.iv.toString('base64') }; }

    const parts = [
      { name: 'snapshot.json', data: Buffer.from(JSON.stringify(meta, null, 2) + '\n') },
      { name: 'cohostly.json', data: Buffer.from(settingsText) },
      { name: 'source.enc', data: src.sealed },
      ...(sec ? [{ name: 'secrets.enc', data: sec.sealed }] : []),
    ];
    return gzipSync(ustar(parts, Math.floor(now.getTime() / 1000)));
  } finally { dataKey.fill(0); }
}

// ---- reading the readable parts (no key, no network)

/** The first entries of a tar, in order: regular files only, plain names. */
function entriesOf(tar: Buffer): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = [];
  let at = 0;
  const cstr = (b: Buffer) => { const z = b.indexOf(0); return b.subarray(0, z < 0 ? b.length : z).toString('utf8'); };
  while (at + 512 <= tar.length) {
    const h = tar.subarray(at, at + 512);
    if (h.every((x) => x === 0)) break;
    const size = parseInt(cstr(h.subarray(124, 136)).trim() || '0', 8);
    out.push({ name: cstr(h.subarray(0, 100)).replace(/^(\.\/)+/, ''), data: tar.subarray(at + 512, at + 512 + size) });
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

export interface Inspected {
  meta: Record<string, any>; settings: Record<string, any>; settingsText: string; hasSecrets: boolean; secretNames: string[]; expired: boolean; layoutOk: boolean;
}

/** What can be read without any key: the settings with their sources, the dates, the account, and the names of the secrets (never values). */
export function inspectSnapshot(file: Buffer, now = new Date()): Inspected {
  let entries: { name: string; data: Buffer }[];
  try { entries = entriesOf(gunzipSync(file)); } catch { throw new Error('That is not a Cohostly snapshot.'); }
  const names = entries.map((e) => e.name);
  const layoutOk = (names.length === 3 || names.length === 4) && names.every((n, k) => n === ENTRIES[k]);
  if (!layoutOk) throw new Error('That is not a Cohostly snapshot (its files are not the ones a snapshot holds).');
  let meta: Record<string, any>; let settings: Record<string, any>;
  try { meta = JSON.parse(entries[0]!.data.toString('utf8')); settings = JSON.parse(entries[1]!.data.toString('utf8')); } catch { throw new Error('That is not a Cohostly snapshot.'); }
  if (typeof meta.format !== 'string' || !meta.format.startsWith('cohostly-snapshot/')) throw new Error('That is not a Cohostly snapshot.');
  if (meta.format !== SNAPSHOT_FORMAT) throw new Error('Update Cohostly to open this file. It was made by a newer version.');
  const hasSecrets = names.length === 4;
  const secretNames = Array.isArray(settings.env?.secrets) ? settings.env.secrets.filter((n: unknown) => typeof n === 'string') : [];
  return { meta, settings, settingsText: entries[1]!.data.toString('utf8'), hasSecrets, secretNames, expired: Date.parse(meta.expires_at) < now.getTime(), layoutOk };
}

// ---- the platform's public key

function newestCached(dir: string): SnapshotKey | null {
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f } of files) { const k = JSON.parse(readFileSync(join(dir, f), 'utf8')) as SnapshotKey; if (typeof k.key_id === 'string' && typeof k.public_key_pem === 'string') return k; }
  } catch { /* no cache */ }
  return null;
}

const safe = (id: string) => id.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120);

/** Cohostly's public key, cached by key id under ~/.cohostly/keys so a second seal needs no round trip for it. */
export async function fetchSnapshotKey(apiUrl: string, o: { cacheDir?: string; fetchFn?: typeof fetch } = {}): Promise<SnapshotKey> {
  const dir = o.cacheDir ?? join(homedir(), '.cohostly', 'keys');
  let res: Response;
  try { res = await (o.fetchFn ?? fetch)(`${apiUrl}/v1/keys/snapshot`); }
  catch (e) {
    // Offline: the newest key seen before still opens on the server (older versions stay enabled for 31 days after a rotation).
    const cached = newestCached(dir);
    if (cached) return cached;
    throw e;
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `The server did not give its snapshot key (HTTP ${res.status}).`);
  }
  const key = (await res.json()) as SnapshotKey;
  if (typeof key.key_id !== 'string' || typeof key.public_key_pem !== 'string' || !key.public_key_pem.includes('BEGIN PUBLIC KEY')) throw new Error('The server sent a snapshot key this version cannot read.');
  try { mkdirSync(dir, { recursive: true, mode: 0o700 }); writeFileSync(join(dir, `${safe(key.key_id)}.json`), JSON.stringify(key)); } catch { /* the cache is only a convenience */ }
  return key;
}
