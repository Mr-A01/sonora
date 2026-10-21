/** Public media delivery with HTTP Range support for seeking. */
import { getR2Object } from '../services/storage.js';
import { fail } from '../lib/http.js';

export async function serveMedia(request, env, key) {
  if (!key || key.includes('..')) return fail(400, 'bad_request', 'invalid media key');
  if (!env.MEDIA) return fail(503, 'unavailable', 'media storage is not configured');

  const result = await getR2Object(env, key, request.headers.get('range'));
  if (!result) return fail(404, 'not_found', 'object not found');
  return new Response(result.body ?? null, { status: result.status, headers: result.headers });
}
