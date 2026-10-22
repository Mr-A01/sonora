/**
 * Metadata resolution. Deterministic sources first; the model only fills gaps.
 * The model can never overwrite tag-derived values and can never invent a year.
 */
import { DEFAULT_METADATA_MODEL } from './ai.js';

export const META_FIELDS = ['title', 'artist', 'album', 'year', 'genre', 'language'];

function clean(value, max = 300) {
  if (typeof value !== 'string') return null;
  const t = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

export function resolveMetadata({ tags = {}, telegram = {}, filename = {}, existing = {} }) {
  const out = {};
  const origin = {};
  for (const field of META_FIELDS) {
    const candidates = [
      ['manual', existing[field]],
      ['tag', tags[field]],
      ['telegram', telegram[field]],
      ['filename', filename[field]],
    ];
    for (const [source, value] of candidates) {
      if (field === 'year') {
        if (Number.isInteger(value) && value >= 1900 && value <= new Date().getUTCFullYear()) {
          out.year = value;
          origin.year = source;
          break;
        }
        continue;
      }
      const normalized = clean(value);
      if (normalized) {
        out[field] = normalized;
        origin[field] = source;
        break;
      }
    }
  }
  return { values: out, origin };
}

export function missingFields(values) {
  return META_FIELDS.filter((f) => values[f] == null);
}

/** Validates model output. Anything unverifiable is dropped, not guessed. */
export function validateAiMetadata(raw, { allowedFields }) {
  const parsed = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return {};
  const result = {};
  for (const field of allowedFields) {
    const value = parsed[field];
    if (field === 'year') {
      const n = Number(value);
      if (Number.isInteger(n) && n >= 1900 && n <= new Date().getUTCFullYear()) result.year = n;
      continue;
    }
    const normalized = clean(value);
    if (normalized) result[field] = normalized;
  }
  return result;
}

function safeParse(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function completeMetadataWithAi(env, values, context = {}) {
  const missing = missingFields(values);
  if (!missing.length) return { values, completed: [] };
  if (!env.AI) return { values, completed: [], skipped: 'ai_unavailable' };

  const model = env.METADATA_MODEL || DEFAULT_METADATA_MODEL;
  const prompt = [
    'Fill ONLY the missing music metadata fields. Reply with JSON: {"title"?:string,"artist"?:string,"album"?:string,"year"?:number,"genre"?:string,"language"?:string}.',
    'Never invent a release year. Omit a field when you are not confident. Preserve Persian script.',
    `Missing: ${missing.join(', ')}`,
    `Known: ${JSON.stringify(values)}`,
    `Telegram context: ${JSON.stringify({ ...context, audio: undefined })}`,
  ].join('\n');

  let response;
  try {
    response = await env.AI.run(model, {
      messages: [
        { role: 'system', content: 'You complete incomplete music metadata. Output JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 512,
    });
  } catch {
    return { values, completed: [], skipped: 'provider_error' };
  }

  const content = response?.choices?.[0]?.message?.content ?? response?.response ?? '';
  const validated = validateAiMetadata(content, { allowedFields: missing });
  const merged = { ...values };
  for (const [k, v] of Object.entries(validated)) if (merged[k] == null) merged[k] = v;
  return { values: merged, completed: Object.keys(validated) };
}
