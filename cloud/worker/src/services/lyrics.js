/**
 * Conservative transcript cleanup. Timing is immutable: the model only returns
 * corrected text per segment id, and we merge it back onto the original timing.
 */
import { DEFAULT_CLEANUP_MODEL } from './ai.js';

export const CLEANUP_MODEL = DEFAULT_CLEANUP_MODEL;

const SYSTEM_PROMPT = [
  'You clean raw speech-to-text lyrics. You are NOT a lyricist.',
  'Rules:',
  '1. Preserve the original language and script exactly (Persian stays Persian, no transliteration).',
  '2. Fix spelling, punctuation, spacing, and Persian zero-width non-joiner (نیم‌فاصله) where clearly appropriate.',
  '3. Keep repeated choruses, interjections, and meaningful repetitions.',
  '4. Correct obvious transcription errors only when context supports it.',
  '5. Never translate. Never add verses. Never drop verses. Never merge or split segments.',
  '6. Return ONLY JSON: {"segments":[{"id":"<original id>","text":"<corrected>"}]}. No timestamps.',
].join('\n');

function buildUserPrompt(segments) {
  const payload = segments.map((s) => ({ id: s.id, text: s.text }));
  return `Segments:\n${JSON.stringify(payload)}\n\nReturn the JSON object now.`;
}

function extractJson(content) {
  if (typeof content !== 'string') return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : content).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Merges corrected text onto immutable timing. Rejects unknown ids and
 * refuses to shrink the result to nothing (that would erase valid lyrics).
 */
export function mergeCleanup(segments, modelOutput) {
  const parsed = extractJson(modelOutput);
  if (!parsed || !Array.isArray(parsed.segments)) return { ok: false, reason: 'invalid_output' };

  const byId = new Map();
  for (const item of parsed.segments) {
    if (!item || typeof item.id !== 'string') continue;
    if (typeof item.text !== 'string') continue;
    const text = item.text.trim();
    if (!text) continue;
    byId.set(item.id, text);
  }
  if (!byId.size) return { ok: false, reason: 'empty_output' };

  let changed = 0;
  const merged = segments.map((s) => {
    const replacement = byId.get(s.id);
    if (replacement == null) return s;
    if (replacement !== s.text) changed++;
    return { ...s, text: replacement, cleaned: replacement !== s.text };
  });

  const usable = merged.filter((s) => s.text && String(s.text).trim());
  if (!usable.length) return { ok: false, reason: 'would_erase_lyrics' };
  // A model that drops most segments likely paraphrased or truncated: refuse.
  if (byId.size < Math.ceil(segments.length * 0.5)) return { ok: false, reason: 'too_many_segments_lost' };

  return { ok: true, segments: merged, changed };
}

export function lyricSegmentsToText(segments) {
  return segments.map((s) => s.text).join('\n');
}

export async function cleanupSegments(env, segments, { language = 'fa' } = {}) {
  if (!segments || segments.length === 0) return { ok: false, reason: 'no_segments' };
  if (!env.AI) return { ok: false, reason: 'ai_unavailable' };

  const model = env.CLEANUP_MODEL || CLEANUP_MODEL;
  let response;
  try {
    response = await env.AI.run(model, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${buildUserPrompt(segments)}\nLanguage: ${language}` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });
  } catch (err) {
    return { ok: false, reason: 'provider_error', error: String(err.message || err) };
  }

  const content =
    response?.choices?.[0]?.message?.content ??
    response?.response ??
    response?.result?.response ??
    '';
  return mergeCleanup(segments, content);
}
