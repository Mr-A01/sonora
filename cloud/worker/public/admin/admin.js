/**
 * Admin SPA. Talks only to the Worker API. No secrets are stored here:
 * the session lives in an HttpOnly cookie and the CSRF token is a cookie too.
 */
'use strict';
const API = (window.SONORA_API_BASE || '').replace(/\/$/, '');
const state = { csrf: null, tracks: [], editId: null };

function cookie(name) {
  const part = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return part ? decodeURIComponent(part.split('=').slice(1).join('=')) : null;
}

async function api(path, { method = 'GET', body, headers = {}, confirmDelete } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (method !== 'GET') {
    const csrf = cookie('sonora_csrf') || state.csrf;
    if (csrf) opts.headers['x-csrf-token'] = csrf;
  }
  if (confirmDelete) opts.headers['x-confirm-delete'] = confirmDelete;
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function show(view) {
  document.querySelectorAll('main section').forEach((s) => s.classList.toggle('active', s.id === view));
  document.querySelectorAll('nav button[data-view]').forEach((b) => {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (view === 'dashboard') loadDashboard();
  if (view === 'tracks') loadTracks();
  if (view === 'sources') loadSources();
  if (view === 'dropbox') loadDropbox();
  if (view === 'errors') loadErrors();
}

document.getElementById('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.id === 'logout') return logout();
  if (btn.dataset.view) show(btn.dataset.view);
});

async function boot() {
  try {
    await api('/api/admin/me');
    $('#loginView').classList.remove('active');
    $('#nav').hidden = false;
    show('dashboard');
  } catch {
    $('#loginView').classList.add('active');
  }
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginMsg').textContent = '';
  try {
    const res = await api('/api/admin/login', {
      method: 'POST',
      body: { username: $('#user').value, password: $('#pass').value },
    });
    state.csrf = res.csrfToken;
    $('#pass').value = '';
    $('#loginView').classList.remove('active');
    $('#nav').hidden = false;
    show('dashboard');
  } catch (err) {
    $('#loginMsg').textContent = err.status === 429 ? 'Too many attempts. Try again later.' : 'Invalid credentials.';
  }
});

async function logout() {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
  location.reload();
}

async function loadDashboard() {
  const data = await api('/api/admin/dashboard');
  $('#stats').innerHTML = Object.entries(data.tracks)
    .map(([k, v]) => `<div class="card stat"><span class="muted">${esc(k)}</span><b>${v}</b></div>`)
    .join('') || '<div class="card muted">No tracks yet.</div>';
  $('#recent').innerHTML =
    '<h2>Recent imports</h2>' +
    (data.recent.length
      ? `<table><tr><th>Title</th><th>Artist</th><th>Status</th><th>Created</th></tr>${data.recent
          .map((t) => `<tr><td>${esc(t.title || '—')}</td><td>${esc(t.artist || '—')}</td><td>${esc(t.status)}</td><td class="muted">${esc(t.created_at)}</td></tr>`)
          .join('')}</table>`
      : '<p class="muted">Empty catalog.</p>') +
    '<h2 style="margin-top:16px">Recent actions</h2>' +
    (data.audit.length
      ? `<table>${data.audit.map((a) => `<tr><td>${esc(a.action)}</td><td class="muted">${esc(a.target || '')}</td><td class="muted">${esc(a.created_at)}</td></tr>`).join('')}</table>`
      : '<p class="muted">No actions recorded.</p>');
}

async function loadTracks() {
  const q = encodeURIComponent($('#q').value || '');
  const data = await api(`/api/admin/tracks?q=${q}&limit=50`);
  state.tracks = data.tracks;
  $('#trackList').innerHTML = data.tracks.length
    ? `<table><tr><th>Title</th><th>Artist</th><th>Duration</th><th>Status</th><th></th></tr>${data.tracks
        .map(
          (t) => `<tr><td>${esc(t.title || t.id)}</td><td>${esc(t.artist || '—')}</td>
          <td>${t.duration_seconds != null ? esc(Math.floor(t.duration_seconds / 60) + ':' + String(t.duration_seconds % 60).padStart(2, '0')) : '—'}</td>
          <td>${esc(t.status)}${t.error ? ` <span class="err" title="${esc(t.error)}">!</span>` : ''}</td>
          <td class="row"><button class="act" data-edit="${esc(t.id)}">Edit</button><button class="act" data-retry="${esc(t.id)}">Retry</button><button class="act danger" data-del="${esc(t.id)}">Delete</button></td></tr>`
        )
        .join('')}</table>`
    : '<p class="muted">No tracks.</p>';
}

$('#search').addEventListener('click', loadTracks);
$('#trackList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.edit) return openEditor(btn.dataset.edit);
  if (btn.dataset.retry) {
    await api(`/api/admin/tracks/${btn.dataset.retry}/retry`, { method: 'POST' });
    return loadTracks();
  }
  if (btn.dataset.del) {
    const id = btn.dataset.del;
    const track = state.tracks.find((t) => t.id === id);
    if (!confirm(`Delete "${track?.title || id}"?\n\nIt leaves the public catalog immediately; files are removed in the background.`)) return;
    await api(`/api/admin/tracks/${id}`, { method: 'DELETE', confirmDelete: id });
    return loadTracks();
  }
});

async function openEditor(id) {
  const data = await api(`/api/admin/tracks/${id}`);
  state.editId = id;
  const t = data.track;
  const fields = [
    ['title', 'Title'], ['artist', 'Artist'], ['album', 'Album'], ['genre', 'Genre'],
    ['language', 'Language'], ['year', 'Year (blank = unknown)'], ['duration_seconds', 'Duration (seconds)'],
  ];
  $('#edFields').innerHTML = fields
    .map(([k, label]) => `<label for="f_${k}">${label}</label><input id="f_${k}" value="${esc(t[k] ?? '')}">`)
    .join('') + `<label for="f_lyrics" style="margin-top:10px">Lyrics (manual override)</label><textarea id="f_lyrics">${esc(data.lyrics?.text || '')}</textarea>`;
  $('#editor').showModal();
}

$('#edSave').addEventListener('click', async (e) => {
  e.preventDefault();
  const body = {};
  for (const k of ['title', 'artist', 'album', 'genre', 'language']) {
    const v = $(`#f_${k}`).value;
    if (v !== '') body[k] = v;
  }
  const year = $('#f_year').value.trim();
  body.year = year === '' ? null : Number(year);
  const dur = $('#f_duration_seconds').value.trim();
  body.duration_seconds = dur === '' ? null : Number(dur);
  try {
    await api(`/api/admin/tracks/${state.editId}`, { method: 'PATCH', body });
    const lyrics = $('#f_lyrics').value;
    if (lyrics.trim()) await api(`/api/admin/tracks/${state.editId}/lyrics`, { method: 'PUT', body: { text: lyrics } });
    $('#editor').close();
    loadTracks();
  } catch (err) {
    alert(err.message);
  }
});

async function loadSources() {
  const data = await api('/api/admin/sources');
  $('#sourceList').innerHTML = data.sources.length
    ? `<table><tr><th>Chat</th><th>Title</th><th>Enabled</th><th>Access</th><th></th></tr>${data.sources
        .map(
          (s) => `<tr><td class="muted">${esc(s.chat_id)}</td><td>${esc(s.title || '—')}</td>
      <td>${s.enabled ? 'yes' : 'no'}</td>
      <td>${esc(s.access_status)}${s.access_error ? `<div class="err">${esc(s.access_error)}</div>` : ''}</td>
      <td class="row"><button class="act" data-toggle="${esc(s.id)}" data-enabled="${s.enabled}">${s.enabled ? 'Disable' : 'Enable'}</button>
      <button class="act" data-check="${esc(s.id)}">Check access</button></td></tr>`
        )
        .join('')}</table>`
    : '<p class="muted">No sources yet. Register a chat id above; unknown chats are ignored by the webhook.</p>';
}

$('#registerSource').addEventListener('click', async () => {
  const chatId = $('#chatId').value.trim();
  const title = $('#chatTitle').value.trim();
  if (!chatId) return alert('Chat id is required');
  try {
    const result = await api('/api/admin/sources', { method: 'POST', body: { chat_id: chatId, title: title || null } });
    if (result.existing) alert('Source already registered and re-enabled.');
    $('#chatId').value = '';
    $('#chatTitle').value = '';
    loadSources();
  } catch (err) {
    alert(err.message);
  }
});

$('#sourceList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.toggle) {
    await api(`/api/admin/sources/${btn.dataset.toggle}`, { method: 'PATCH', body: { enabled: btn.dataset.enabled !== '1' } });
    return loadSources();
  }
  if (btn.dataset.check) {
    const result = await api(`/api/admin/sources/${btn.dataset.check}/check`, { method: 'POST' });
    if (!result.ok) alert(result.error);
    return loadSources();
  }
});

async function loadDropbox() {
  const data = await api('/api/admin/dropbox/accounts');
  $('#dbxList').innerHTML = data.accounts.length
    ? `<table><tr><th>Label</th><th>Health</th><th>Capacity</th><th>Enabled</th><th></th></tr>${data.accounts
        .map(
          (a) => `<tr><td>${esc(a.label)}</td><td class="${a.health === 'healthy' ? 'ok' : 'err'}">${esc(a.health)}</td>
        <td class="muted">${a.quota_total ? `${Math.round(a.quota_used / 1e9)} / ${Math.round(a.quota_total / 1e9)} GB` : '—'}</td>
        <td>${a.enabled ? 'yes' : 'no'}</td>
        <td class="row"><button class="act" data-check="${esc(a.id)}">Check</button>
        <button class="act" data-toggle="${esc(a.id)}" data-enabled="${a.enabled}">${a.enabled ? 'Disable' : 'Enable'}</button>
        <button class="act danger" data-disconnect="${esc(a.id)}">Disconnect</button></td></tr>`
        )
        .join('')}</table>`
    : '<p class="muted">No Dropbox accounts connected.</p>';
}

$('#connectDropbox').addEventListener('click', async () => {
  const { url } = await api('/api/admin/dropbox/connect', { method: 'POST' });
  window.open(url, '_blank', 'noopener');
});

$('#dbxList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.check) {
    const result = await api(`/api/admin/dropbox/accounts/${btn.dataset.check}/check`, { method: 'POST' });
    alert(result.ok ? `Healthy: ${result.email || ''}` : `Unhealthy: ${result.error}`);
    return loadDropbox();
  }
  if (btn.dataset.toggle) {
    await api(`/api/admin/dropbox/accounts/${btn.dataset.toggle}`, { method: 'PATCH', body: { enabled: btn.dataset.enabled !== '1' } });
    return loadDropbox();
  }
  if (btn.dataset.disconnect) {
    if (!confirm('Disconnect this account? Stored refresh tokens are invalidated.')) return;
    await api(`/api/admin/dropbox/accounts/${btn.dataset.disconnect}`, { method: 'DELETE' });
    return loadDropbox();
  }
});

async function loadErrors() {
  const data = await api('/api/admin/errors');
  const rows = data.errors.length
    ? data.errors.map((e) => `<tr><td>${esc(e.category)}</td><td class="muted">${esc(e.stage || '')}</td><td>${esc(e.message)}</td><td class="muted">${esc(e.created_at)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No errors recorded.</td></tr>';
  const dead = data.dead_letters.length
    ? data.dead_letters.map((j) => `<tr><td>${esc(j.type)}</td><td class="muted">${esc(j.track_id || '')}</td><td>${j.attempts}</td><td>${esc(j.last_error || '')}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No dead letters.</td></tr>';
  $('#errorList').innerHTML =
    `<table><tr><th>Category</th><th>Stage</th><th>Message</th><th>When</th></tr>${rows}</table>` +
    `<h2 style="margin-top:16px">Dead letters</h2><table><tr><th>Job</th><th>Track</th><th>Attempts</th><th>Error</th></tr>${dead}</table>`;
}

function renderHealth(title, data) {
  if (Array.isArray(data.checks)) {
    $('#healthOut').innerHTML =
      `<h2>${esc(title)}</h2><table><tr><th>Check</th><th>Result</th><th>Detail</th></tr>${data.checks
        .map((c) => `<tr><td>${esc(c.name)}</td><td class="${c.ok ? 'ok' : 'err'}">${c.ok ? 'ok' : 'failed'}</td><td class="muted">${esc(c.ok ? JSON.stringify(c.detail) : c.error)}</td></tr>`)
        .join('')}</table>`;
    return;
  }
  $('#healthOut').innerHTML = `<pre class="muted">${esc(JSON.stringify(data, null, 2))}</pre>`;
}

$('#runHealth').addEventListener('click', async () => renderHealth('Health', await api('/api/admin/health')));
$('#testTg').addEventListener('click', async () => renderHealth('Telegram', await api('/api/admin/telegram/test', { method: 'POST' })));
$('#setHook').addEventListener('click', async () => renderHealth('Webhook', await api('/api/admin/telegram/webhook', { method: 'POST' })));

boot();
