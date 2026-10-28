import { createCipheriv, publicEncrypt, randomBytes, constants } from 'node:crypto';
import type { SnapshotKey } from './seal.js';

// `.cohostly/env.enc`: the values a snapshot captured, sealed so only the account's deploys can read them. One readable JSON file.
// The data key is wrapped with the platform's public key (the same key `cohostly pack` uses). The readable fields are bound in as additional authenticated
// data: the account and the expiry cannot be edited. The settings are deliberately NOT bound, so cohostly.json stays editable by hand.

export const ENV_FORMAT = 'cohostly-env/1';

export interface SealedEnv {
  format: string; key_id: string; wrapped_key: string; account_id: string; created_at: string; expires_at: string; iv: string; ciphertext: string;
}

/** The additional authenticated data. The server builds the same text. */
export const envAad = (m: Pick<SealedEnv, 'format' | 'key_id' | 'account_id' | 'created_at' | 'expires_at'>) =>
  Buffer.from(JSON.stringify([m.format, m.key_id, m.account_id, m.created_at, m.expires_at]), 'utf8');

export interface SealEnvInput { key: SnapshotKey; accountId: string; expiresAt: Date; now?: Date; values: Record<string, string> }

/** The text of env.enc. */
export function sealEnv(i: SealEnvInput): string {
  const now = i.now ?? new Date();
  const dataKey = randomBytes(32);
  try {
    const meta = {
      format: ENV_FORMAT, key_id: i.key.key_id, account_id: i.accountId, created_at: now.toISOString(), expires_at: i.expiresAt.toISOString(),
      wrapped_key: publicEncrypt({ key: i.key.public_key_pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, dataKey).toString('base64'),
    };
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', dataKey, iv);
    c.setAAD(envAad(meta));
    const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(i.values), 'utf8')), c.final(), c.getAuthTag()]);
    const out: SealedEnv = { ...meta, iv: iv.toString('base64'), ciphertext: ct.toString('base64') };
    return JSON.stringify(out, null, 2) + '\n';
  } finally { dataKey.fill(0); }
}

/** What anyone can read without a key: whose it is and when it expires. */
export function describeEnv(text: string): { accountId: string; expiresAt: string } {
  const m = JSON.parse(text) as SealedEnv;
  if (m?.format !== ENV_FORMAT || typeof m.account_id !== 'string' || typeof m.expires_at !== 'string') throw new Error('That is not an env.enc file.');
  return { accountId: m.account_id, expiresAt: m.expires_at };
}
