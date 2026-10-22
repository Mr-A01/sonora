import { nowIso } from './ids.js';

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  });
}

export function fail(status, code, message, extra = {}) {
  return json({ error: { code, message, ...extra } }, { status });
}

/** Origin allowlist. An empty allowlist denies nothing locally but never widens CORS. */
export function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, x-csrf-token',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    vary: 'origin',
  };
}

export function isAllowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin / non-browser clients still need auth + CSRF
  // The admin SPA is served by this Worker, so its own origin is always allowed.
  if (origin === new URL(request.url).origin) return true;
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export async function readJson(request, maxBytes = 64 * 1024) {
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error('payload too large'), { status: 413 });
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('invalid JSON'), { status: 400 });
  }
}

export function logError(env, category, message, extra = {}) {
  // Structured, secret-free diagnostics. Never pass tokens here.
  console.error(JSON.stringify({ at: nowIso(), category, message: String(message).slice(0, 500), ...extra }));
}
