/**
 * Telegram Bot API adapter. Runs in the Worker, never in the browser and never
 * as part of the build. Every call surfaces the real provider error.
 */
export class TelegramError extends Error {
  constructor(message, { status = 0, retryAfter = 0, code = 'telegram_error' } = {}) {
    super(message);
    this.name = 'TelegramError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

/** Bot API getFile download ceiling. Cloudflare does not lift this. */
export const TELEGRAM_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;

function api(env, method) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new TelegramError('TELEGRAM_BOT_TOKEN is not configured', { code: 'not_configured' });
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function call(env, method, body) {
  let res;
  try {
    res = await fetch(api(env, method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    throw new TelegramError(`telegram network error: ${err.message}`, { code: 'network' });
  }
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok || !payload?.ok) {
    const description = payload?.description || `HTTP ${res.status}`;
    throw new TelegramError(description, {
      status: res.status,
      retryAfter: payload?.parameters?.retry_after || 0,
      code: payload?.error_code ? String(payload.error_code) : 'api_error',
    });
  }
  return payload.result;
}

export const telegram = {
  getMe: (env) => call(env, 'getMe'),
  getChat: (env, chatId) => call(env, 'getChat', { chat_id: chatId }),
  getChatMember: (env, chatId, userId) => call(env, 'getChatMember', { chat_id: chatId, user_id: userId }),
  getWebhookInfo: (env) => call(env, 'getWebhookInfo'),
  setWebhook: (env, url, secret) =>
    call(env, 'setWebhook', {
      url,
      secret_token: secret,
      allowed_updates: ['message', 'channel_post'],
      drop_pending_updates: false,
    }),
  deleteWebhook: (env) => call(env, 'deleteWebhook', { drop_pending_updates: false }),
  async getFile(env, fileId) {
    const file = await call(env, 'getFile', { file_id: fileId });
    if (!file?.file_path) throw new TelegramError('getFile returned no file_path', { code: 'invalid_response' });
    if (typeof file.file_size === 'number' && file.file_size > TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
      throw new TelegramError(`file exceeds Telegram's 20 MB Bot API download limit (${file.file_size} bytes)`, {
        code: 'file_too_large',
      });
    }
    return file;
  },
  async downloadFile(env, filePath, maxBytes = TELEGRAM_DOWNLOAD_LIMIT_BYTES) {
    let res;
    try {
      res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`);
    } catch (err) {
      throw new TelegramError(`telegram download network error: ${err.message}`, { code: 'network' });
    }
    if (!res.ok) throw new TelegramError(`download failed: HTTP ${res.status}`, { status: res.status });
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new TelegramError('file exceeds download limit', { code: 'file_too_large' });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new TelegramError('download returned zero bytes', { code: 'incomplete_download' });
    if (declared && bytes.length < declared) {
      throw new TelegramError(`incomplete download (${bytes.length}/${declared} bytes)`, { code: 'incomplete_download' });
    }
    if (bytes.length > maxBytes) throw new TelegramError('file exceeds download limit', { code: 'file_too_large' });
    return bytes;
  },
};

/** Constant-time-ish comparison for the webhook secret header. */
export function verifyWebhookSecret(env, headerValue) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  if (!headerValue || headerValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= headerValue.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Extracts importable audio descriptors from an update. */
export function extractAudio(update) {
  const message = update?.message || update?.channel_post;
  if (!message) return null;
  const media = message.audio || message.document || message.voice;
  if (!media) return null;
  const isAudioDoc =
    message.document && /audio\/|application\/octet-stream/.test(message.document.mime_type || '');
  if (message.document && !isAudioDoc) return null;
  const filename = media.file_name || `track-${message.message_id}`;
  return {
    updateId: update.update_id,
    messageId: message.message_id,
    chatId: String(message.chat.id),
    chatTitle: message.chat.title || message.chat.username || String(message.chat.id),
    chatType: message.chat.type,
    fileId: media.file_id,
    fileUniqueId: media.file_unique_id,
    fileSize: media.file_size ?? null,
    durationSeconds: typeof media.duration === 'number' ? media.duration : null,
    mimeType: media.mime_type || 'audio/mpeg',
    filename,
    title: message.audio?.title || null,
    performer: message.audio?.performer || null,
    caption: message.caption || null,
  };
}
