/**
 * Admin auth: PBKDF2 password hashing, server-side sessions, CSRF tokens.
 * Nothing secret ever reaches localStorage or the bundle.
 */
import { hashPassword, randomToken, sha256Hex, timingSafeEqual, PBKDF2_ITERATIONS } from './crypto.js';
import { nowIso } from './ids.js';
import { json, fail } from './http.js';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 10;

export const SESSION_COOKIE = 'sonora_session';
export const CSRF_COOKIE = 'sonora_csrf';

function cookie(name, value, { maxAge, secure = true, httpOnly = true } = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'SameSite=None'];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export async function bootstrapAdmin(db, env, { username, password }) {
  if (env.ADMIN_BOOTSTRAP_TOKEN && env.ADMIN_BOOTSTRAP_TOKEN.length < 24) {
    return { ok: false, error: 'ADMIN_BOOTSTRAP_TOKEN must be at least 24 characters' };
  }
  const existing = await db.prepare('SELECT COUNT(*) AS n FROM admins').first();
  if (existing?.n > 0) return { ok: false, error: 'admin_already_exists' };
  if (!username || !password || password.length < 12) {
    return { ok: false, error: 'username and a 12+ character password are required' };
  }
  const { hash, salt, iterations } = await hashPassword(password);
  await db
    .prepare('INSERT INTO admins (id, username, password_hash, salt, iterations, role) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), username, hash, salt, iterations, 'admin')
    .run();
  return { ok: true };
}

export async function verifyLogin(db, env, { username, password, ip }) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const attempts = await db
    .prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action='login_failed' AND detail=? AND created_at > ?`)
    .bind(String(ip || 'unknown'), since)
    .first();
  if ((attempts?.n || 0) >= LOGIN_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'too_many_attempts' };
  }

  const admin = await db.prepare('SELECT * FROM admins WHERE username = ?').bind(username).first();
  const genericFailure = async () => {
    await db
      .prepare('INSERT INTO audit_log (id, admin_id, action, detail) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), null, 'login_failed', String(ip || 'unknown'))
      .run();
    return { ok: false, status: 401, error: 'invalid_credentials' };
  };
  if (!admin || admin.disabled) return genericFailure();

  const { hash } = await hashPassword(password, admin.salt, admin.iterations || PBKDF2_ITERATIONS);
  if (!timingSafeEqual(hash, admin.password_hash)) return genericFailure();

  const sessionToken = randomToken(32);
  const csrfToken = randomToken(24);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db
    .prepare(
      `INSERT INTO sessions (id, admin_id, token_hash, csrf_hash, expires_at) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(sessionId, admin.id, await sha256Hex(sessionToken), await sha256Hex(csrfToken), expiresAt)
    .run();
  await db
    .prepare('INSERT INTO audit_log (id, admin_id, action, detail) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), admin.id, 'login_success', String(ip || 'unknown'))
    .run();

  return {
    ok: true,
    sessionToken,
    csrfToken,
    headers: [
      cookie(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_MS / 1000 }),
      // Double-submit CSRF token: readable by the admin SPA, never a credential by itself.
      cookie(CSRF_COOKIE, csrfToken, { maxAge: SESSION_TTL_MS / 1000, httpOnly: false }),
    ],
  };
}

export async function getSession(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const schema = await db
    .prepare(
      `SELECT s.id, s.csrf_hash, s.expires_at, s.revoked_at, a.id AS admin_id, a.username, a.role, a.disabled
       FROM sessions s JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?`
    )
    .bind(await sha256Hex(token))
    .first();
  if (!schema) return null;
  if (schema.revoked_at || schema.disabled) return null;
  if (Date.parse(schema.expires_at) <= Date.now()) return null;
  return schema;
}

export async function revokeSession(db, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
    .bind(nowIso(), await sha256Hex(token))
    .run();
}

export function clearCookieHeaders() {
  return [
    cookie(SESSION_COOKIE, '', { maxAge: 0 }),
    cookie(CSRF_COOKIE, '', { maxAge: 0, httpOnly: false }),
  ];
}

/**
 * Guards a state-changing request. Requires a live session plus a CSRF token
 * that hashes to the stored value. Never trusts client-supplied roles.
 */
export async function requireAdmin(db, request, { mutating = false } = {}) {
  const session = await getSession(db, request);
  if (!session) return { error: fail(401, 'unauthorized', 'authentication required') };
  if (mutating) {
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfCookie = readCookie(request, CSRF_COOKIE);
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return { error: fail(403, 'csrf_failed', 'missing or mismatched CSRF token') };
    }
    if (!timingSafeEqual(await sha256Hex(csrfHeader), session.csrf_hash)) {
      return { error: fail(403, 'csrf_failed', 'invalid CSRF token') };
    }
  }
  if (session.role !== 'admin') return { error: fail(403, 'forbidden', 'admin role required') };
  return { session };
}

export function sessionResponse(session) {
  return json({ admin: { username: session.username, role: session.role } });
}
