/**
 * Multi-account Dropbox archival storage.
 * Refresh tokens are AES-GCM encrypted at rest; access tokens are cached in D1 only.
 */
import { decrypt, encrypt } from '../lib/crypto.js';
import { nowIso as ts } from '../lib/ids.js';

export class DropboxError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = 'DropboxError';
    this.status = status;
    this.retryable = retryable;
  }
}

const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2';

function secret(env) {
  if (!env.TOKEN_ENCRYPTION_KEY) throw new DropboxError('TOKEN_ENCRYPTION_KEY is not configured');
  return env.TOKEN_ENCRYPTION_KEY;
}

export async function refreshAccessToken(env, account) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: await decrypt(account.refresh_token_enc, account.refresh_token_iv, secret(env)),
    client_id: env.DROPBOX_APP_KEY,
    client_secret: env.DROPBOX_APP_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new DropboxError(`token refresh failed: HTTP ${res.status} ${text.slice(0, 200)}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const json = await res.json();
  const expiresAt = new Date(Date.now() + (json.expires_in || 14400) * 1000).toISOString();
  return { accessToken: json.access_token, expiresAt };
}

export async function getAccessToken(db, env, account) {
  const expires = account.access_expires_at ? Date.parse(account.access_expires_at) : 0;
  if (account.access_token && expires - Date.now() > 60_000) return account.access_token;
  const { accessToken, expiresAt } = await refreshAccessToken(env, account);
  await db
    .prepare('UPDATE dropbox_accounts SET access_token = ?, access_expires_at = ?, updated_at = ? WHERE id = ?')
    .bind(accessToken, expiresAt, ts(), account.id)
    .run();
  return accessToken;
}

export async function exchangeCode(env, code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env.DROPBOX_APP_KEY,
    client_secret: env.DROPBOX_APP_SECRET,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new DropboxError(`code exchange failed: HTTP ${res.status}`, { status: res.status });
  return res.json();
}

export function authorizeUrl(env, { state, redirectUri }) {
  const params = new URLSearchParams({
    client_id: env.DROPBOX_APP_KEY,
    response_type: 'code',
    token_access_type: 'offline',
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export async function storeAccount(db, env, { label, refreshToken, folder = '/sonora' }) {
  const { ciphertext, iv } = await encrypt(refreshToken, secret(env));
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO dropbox_accounts (id, label, refresh_token_enc, refresh_token_iv, folder, health)
       VALUES (?, ?, ?, ?, ?, 'unverified')`
    )
    .bind(id, label, ciphertext, iv, folder)
    .run();
  return id;
}

async function rpc(env, token, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new DropboxError(`${endpoint} failed: HTTP ${res.status} ${text.slice(0, 200)}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function checkAccount(db, env, account) {
  try {
    const token = await getAccessToken(db, env, account);
    const account_info = await rpc(env, token, '/users/get_current_account', null);
    const usage = await rpc(env, token, '/users/get_space_usage', null);
    const total = usage?.allocation?.allocated ?? null;
    const used = usage?.used ?? null;
    await db
      .prepare(
        `UPDATE dropbox_accounts SET health='healthy', health_error=NULL, quota_used=?, quota_total=?, updated_at=? WHERE id=?`
      )
      .bind(used, total, ts(), account.id)
      .run();
    return { ok: true, email: account_info?.email ?? null, used, total };
  } catch (err) {
    await db
      .prepare(`UPDATE dropbox_accounts SET health='error', health_error=?, updated_at=? WHERE id=?`)
      .bind(String(err.message).slice(0, 300), ts(), account.id)
      .run();
    return { ok: false, error: err.message };
  }
}

/** Capacity-aware selection: smallest healthy account with room, else first healthy. */
export async function pickAccount(db, env, sizeBytes) {
  const { results } = await db
    .prepare(`SELECT * FROM dropbox_accounts WHERE enabled = 1 AND health IN ('healthy','unverified') ORDER BY quota_used ASC`)
    .all();
  const accounts = results || [];
  if (!accounts.length) return null;
  for (const account of accounts) {
    if (account.quota_total == null || account.quota_used == null) return account;
    if (account.quota_total - account.quota_used > sizeBytes + 1024 * 1024) return account;
  }
  return null;
}

export async function uploadFile(db, env, account, path, bytes) {
  const token = await getAccessToken(db, env, account);
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/octet-stream',
      'dropbox-api-arg': JSON.stringify({
        path,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new DropboxError(`upload failed: HTTP ${res.status} ${text.slice(0, 200)}`, {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  return res.json();
}

export async function deleteFile(db, env, account, path) {
  const token = await getAccessToken(db, env, account);
  try {
    return await rpc(env, token, '/files/delete_v2', { path });
  } catch (err) {
    if (err.status === 409) return { already_gone: true };
    throw err;
  }
}

