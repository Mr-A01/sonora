/**
 * SONORA Share v2 — Now Playing · Library
 * Export/import likes, playlists and history as JSON or a share code.
 * Nothing leaves the device unless the user copies it.
 */
(function () {
  'use strict';

  var tab = 'now';

  function b64encode(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      return '';
    }
  }
  function b64decode(str) {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (e) {
      return null;
    }
  }

  function siteBase() {
    try {
      return new URL('./', document.baseURI || location.href).href.replace(/\/?$/, '/');
    } catch (e) {
      return location.href.split('#')[0].replace(/\/?$/, '/');
    }
  }

  function nowPlayingMeta() {
    if (!window.S || !S.playing || !S.playing.al) return null;
    try {
      var al = album(S.playing.al);
      var tr = al.tracks[S.playing.i] || {};
      var ar = artist(al.a);
      var deep = siteBase() + '#/album/' + al.id;
      return {
        title: tr.t || 'Track',
        artist: ar.name || '',
        album: al.t || '',
        cover: al.img || '',
        deep: deep,
        text: (tr.t || 'Track') + ' — ' + (ar.name || 'SONORA') + '\n' + deep
      };
    } catch (e) {
      return null;
    }
  }

  function collectSnapshot() {
    if (!window.S) return null;
    return {
      v: 1,
      type: 'sonora-share',
      at: new Date().toISOString(),
      likes: S.likes || {},
      savedPl: S.savedPl || {},
      savedAlb: S.savedAlb || {},
      hist: (S.hist || []).slice(0, 40),
      queue: (S.queue || []).slice(0, 50)
    };
  }

  function applySnapshot(data) {
    if (!data || data.type !== 'sonora-share' || !window.S) return false;
    try {
      if (data.likes) S.likes = data.likes;
      if (data.savedPl) S.savedPl = data.savedPl;
      if (data.savedAlb) S.savedAlb = data.savedAlb;
      if (data.hist) S.hist = data.hist;
      if (data.queue) S.queue = data.queue;
      if (typeof saveState === 'function') saveState();
      if (typeof render === 'function') render();
      if (typeof renderMini === 'function') renderMini();
      if (typeof toast === 'function') toast('Library imported');
      closeShareModal();
      return true;
    } catch (e) {
      return false;
    }
  }

  function downloadJSON() {
    var snap = collectSnapshot();
    if (!snap) return;
    var blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sonora-library-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 800);
    if (typeof toast === 'function') toast('Library downloaded');
  }

  function copyShareCode() {
    var snap = collectSnapshot();
    if (!snap) return;
    var code = 'SONORA1:' + b64encode(JSON.stringify(snap));
    copyText(code, 'Share code copied');
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          if (typeof toast === 'function') toast(okMsg || 'Copied');
        },
        function () {
          fallbackCopy(text);
        }
      );
    } else fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof toast === 'function') toast('Copied');
    } catch (e) {}
    ta.remove();
  }

  function importFromCode(code) {
    code = String(code || '').trim();
    if (code.indexOf('SONORA1:') === 0) code = code.slice(8);
    var raw = b64decode(code);
    if (!raw) {
      if (typeof toast === 'function') toast('Invalid code');
      return false;
    }
    try {
      return applySnapshot(JSON.parse(raw));
    } catch (e) {
      if (typeof toast === 'function') toast('Could not read code');
      return false;
    }
  }

  function importFromFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        applySnapshot(JSON.parse(reader.result));
      } catch (e) {
        if (typeof toast === 'function') toast('Invalid file');
      }
    };
    reader.readAsText(file);
  }

  function closeShareModal() {
    var modal = document.getElementById('modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = '';
    modal.innerHTML = '';
    document.body.style.overflow = '';
  }

  function panelNow() {
    var m = nowPlayingMeta();
    if (!m) {
      return '<div class="share-empty">Nothing playing. Start a track from your library, then share it.</div>';
    }
    return (
      '<div class="share-now">' +
      (m.cover ? '<img class="share-now-cover" src="' + m.cover + '" alt="">' : '') +
      '<div class="share-now-meta">' +
      '<div class="share-now-t">' +
      escapeHtml(m.title) +
      '</div>' +
      '<div class="share-now-a">' +
      escapeHtml(m.artist) +
      (m.album ? ' · ' + escapeHtml(m.album) : '') +
      '</div></div></div>' +
      '<div class="share-actions-col">' +
      '<button type="button" class="btn solid" data-share="copy-link">Copy link</button>' +
      '<button type="button" class="btn" data-share="copy-text">Copy title + link</button>' +
      '<a class="btn" data-share="tg-track" href="https://t.me/share/url?url=' +
      encodeURIComponent(m.deep) +
      '&text=' +
      encodeURIComponent(m.title + ' — ' + m.artist) +
      '" target="_blank" rel="noopener">Share on Telegram</a>' +
      '</div>'
    );
  }

  function panelLib() {
    return (
      '<p class="share-lead">Export likes, playlists and history as a small file or code. Import on any browser — no account.</p>' +
      '<div class="share-grid">' +
      '<button type="button" class="share-tile" data-share="export"><span class="share-tile-ico">↓</span><span class="share-tile-t">Download JSON</span><span class="share-tile-d">Full library file</span></button>' +
      '<button type="button" class="share-tile" data-share="copy"><span class="share-tile-ico">⎘</span><span class="share-tile-t">Copy code</span><span class="share-tile-d">Paste elsewhere</span></button>' +
      '<button type="button" class="share-tile" data-share="paste-toggle"><span class="share-tile-ico">↑</span><span class="share-tile-t">Import code</span><span class="share-tile-d">Paste a code</span></button>' +
      '<label class="share-tile share-tile-file"><span class="share-tile-ico">▣</span><span class="share-tile-t">Import file</span><span class="share-tile-d">Choose JSON</span><input type="file" accept="application/json,.json" data-share="file" hidden></label>' +
      '</div>' +
      '<div id="sharePasteBox" class="share-paste" hidden>' +
      '<label class="share-paste-label" for="shareCodeIn">Share code</label>' +
      '<textarea id="shareCodeIn" class="share-input" rows="3" placeholder="SONORA1:…" spellcheck="false"></textarea>' +
      '<div class="share-paste-actions">' +
      '<button type="button" class="btn" data-share="paste-cancel">Cancel</button>' +
      '<button type="button" class="btn solid" data-share="paste-apply">Import</button>' +
      '</div></div>'
    );
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/"/g, '"');
  }

  function renderBody() {
    var body = document.getElementById('shareBody');
    if (!body) return;
    if (tab === 'lib') body.innerHTML = panelLib();
    else body.innerHTML = panelNow();

    var tabs = document.querySelectorAll('[data-share-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].getAttribute('data-share-tab') === tab);
    }
  }

  function openShareModal(startTab) {
    tab = startTab || 'now';
    var modal = document.getElementById('modal');
    if (!modal) return;

    modal.innerHTML =
      '<div class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="shareTitle">' +
      '<header class="share-head">' +
      '<div><div class="share-kicker">SONORA</div><h2 id="shareTitle" class="share-title">Share</h2></div>' +
      '<button type="button" class="share-x" data-share="close" aria-label="Close">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<path d="M6 6l12 12M18 6L6 18"/></svg></button></header>' +
      '<nav class="share-tabs" aria-label="Share sections">' +
      '<button type="button" data-share-tab="now">Now playing</button>' +
      '<button type="button" data-share-tab="lib">Library</button>' +
      '</nav>' +
      '<div id="shareBody" class="share-body"></div>' +
      '<p class="share-note">Local-first · nothing ever leaves your device</p>' +
      '</div>';

    modal.classList.add('open');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderBody();
  }

  function onDocClick(e) {
    var modal = document.getElementById('modal');
    var t = e.target;
    if (modal && modal.classList.contains('open') && t === modal) {
      closeShareModal();
      return;
    }

    var tabBtn = t && t.closest && t.closest('[data-share-tab]');
    if (tabBtn) {
      e.preventDefault();
      tab = tabBtn.getAttribute('data-share-tab');
      renderBody();
      return;
    }

    var el = t && t.closest && t.closest('[data-share]');
    if (!el) return;
    var a = el.getAttribute('data-share');

    if (a === 'open') {
      e.preventDefault();
      openShareModal('now');
    } else if (a === 'close') {
      e.preventDefault();
      e.stopPropagation();
      closeShareModal();
    } else if (a === 'export') {
      e.preventDefault();
      downloadJSON();
    } else if (a === 'copy') {
      e.preventDefault();
      copyShareCode();
    } else if (a === 'paste-toggle') {
      e.preventDefault();
      var box = document.getElementById('sharePasteBox');
      if (box) box.hidden = !box.hidden;
    } else if (a === 'paste-cancel') {
      e.preventDefault();
      var b = document.getElementById('sharePasteBox');
      if (b) b.hidden = true;
    } else if (a === 'paste-apply') {
      e.preventDefault();
      var inp = document.getElementById('shareCodeIn');
      if (inp) importFromCode(inp.value);
    } else if (a === 'copy-link') {
      e.preventDefault();
      var m = nowPlayingMeta();
      if (m) copyText(m.deep, 'Link copied');
    } else if (a === 'copy-text') {
      e.preventDefault();
      var m2 = nowPlayingMeta();
      if (m2) copyText(m2.text, 'Copied');
    }
  }

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('modal');
      if (modal && modal.classList.contains('open')) closeShareModal();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-share') === 'file' && t.files && t.files[0]) {
      importFromFile(t.files[0]);
    }
  });

  window.SONORA_SHARE = {
    open: openShareModal,
    close: closeShareModal,
    export: downloadJSON,
    copy: copyShareCode
  };
})();
