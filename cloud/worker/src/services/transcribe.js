/**
 * Transcription providers. Cloudflare Workers AI is the default and only
 * enabled path; Groq is opt-in and never required for imports to work.
 */
export const DEFAULT_CF_WHISPER = '@cf/openai/whisper-large-v3-turbo';
export const DEFAULT_GROQ_WHISPER = 'whisper-large-v3';
export const GROQ_FREE_LIMIT_BYTES = 25 * 1024 * 1024;

export class ProviderError extends Error {
  constructor(message, { retryable = false, status = 0, provider = 'unknown' } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = retryable;
    this.status = status;
    this.provider = provider;
  }
}

/** Normalizes both Whisper response shapes into { text, segments[], vtt }. */
export function normalizeTranscription(raw, provider) {
  if (!raw || typeof raw !== 'object') throw new ProviderError('malformed transcription response', { provider });
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const segments = Array.isArray(raw.segments)
    ? raw.segments
        .map((s, i) => ({
          id: `seg-${i}`,
          start: Number(s.start ?? 0),
          end: Number(s.end ?? 0),
          text: String(s.text ?? '').trim(),
          words: Array.isArray(s.words)
            ? s.words.map((w) => ({ word: String(w.word ?? ''), start: Number(w.start ?? 0), end: Number(w.end ?? 0) }))
            : undefined,
        }))
        .filter((s) => s.text && s.end >= s.start)
    : [];
  if (!text && !segments.length) throw new ProviderError('transcription returned no text', { provider });
  return { text, segments, vtt: typeof raw.vtt === 'string' ? raw.vtt : null, provider };
}

export function workersAiTranscriber(env, model = env.CF_WHISPER_MODEL || DEFAULT_CF_WHISPER) {
  return {
    id: 'cloudflare-workers-ai',
    model,
    async transcribe(audioBytes, { language } = {}) {
      if (!env.AI) throw new ProviderError('Workers AI binding AI is not configured', { provider: 'cloudflare' });
      const payload = {
        audio: [...new Uint8Array(audioBytes)],
        task: 'transcribe',
        ...(language ? { language } : {}),
      };
      let raw;
      try {
        raw = await env.AI.run(model, payload);
      } catch (err) {
        throw new ProviderError(`workers ai error: ${err.message}`, {
          provider: 'cloudflare',
          status: err.status || 0,
          retryable: !/invalid|unsupported|not found/i.test(err.message || ''),
        });
      }
      return normalizeTranscription(raw, 'cloudflare');
    },
  };
}

export function groqTranscriber(env) {
  return {
    id: 'groq',
    model: env.GROQ_WHISPER_MODEL || DEFAULT_GROQ_WHISPER,
    async transcribe(audioBytes, { language, filename = 'audio.mp3' } = {}) {
      if (!env.GROQ_API_KEY) throw new ProviderError('Groq is disabled (no API key)', { provider: 'groq' });
      if (audioBytes.byteLength > GROQ_FREE_LIMIT_BYTES) {
        throw new ProviderError('audio exceeds documented Groq 25 MB upload limit', { provider: 'groq' });
      }
      const form = new FormData();
      form.append('file', new Blob([audioBytes]), filename);
      form.append('model', env.GROQ_WHISPER_MODEL || DEFAULT_GROQ_WHISPER);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'segment');
      if (language) form.append('language', language);
      let res;
      try {
        res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
          body: form,
        });
      } catch (err) {
        throw new ProviderError(`groq network error: ${err.message}`, { provider: 'groq', retryable: true });
      }
      if (!res.ok) {
        const body = await res.text();
        // Never echo the request; cap and strip anything that looks like a key.
        throw new ProviderError(`groq HTTP ${res.status}: ${body.slice(0, 200)}`, {
          provider: 'groq',
          status: res.status,
          retryable: res.status === 429 || res.status >= 500,
        });
      }
      return normalizeTranscription(await res.json(), 'groq');
    },
  };
}

/**
 * Provider selection: Cloudflare first, Groq only when explicitly enabled.
 * A Groq failure must never block the Cloudflare path.
 */
export function pickTranscriber(env) {
  if (String(env.TRANSCRIPTION_PROVIDER || 'cloudflare') === 'groq' && env.GROQ_API_KEY) {
    return groqTranscriber(env);
  }
  return workersAiTranscriber(env);
}
