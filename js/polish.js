/**
 * SONORA polish layer — real local stats, honest UX
 */
(function () {
  'use strict';

  function parseRef(ref) {
    if (!ref || ref.indexOf(':') < 0) return null;
    var p = ref.split(':');
    return { al: p[0], i: +p[1] || 0 };
  }

  function computeStats() {
    var hist = (window.S && S.hist) || [];
    var likes = (window.S && S.likes) || {};
    var byArtist = {};
    var byGenre = {};
    var byAlbum = {};
    var totalSec = 0;
    hist.forEach(function (ref) {
      var p = parseRef(ref);
      if (!p || !window.album) return;
      var al = album(p.al);
      if (!al) return;
      var tr = al.tracks[p.i] || {};
      var sec = typeof durS === 'function' ? durS(tr.d || '3:30') : 210;
      totalSec += sec;
      byAlbum[al.id] = (byAlbum[al.id] || 0) + 1;
      byArtist[al.a] = (byArtist[al.a] || 0) + 1;
      var g = (al.g || 'Other').split('/')[0].trim();
      byGenre[g] = (byGenre[g] || 0) + 1;
    });
    var liked = Object.keys(likes).filter(function (k) {
      return likes[k];
    }).length;
    function top(obj, n) {
      return Object.keys(obj)
        .map(function (k) {
          return { k: k, v: obj[k] };
        })
        .sort(function (a, b) {
          return b.v - a.v;
        })
        .slice(0, n || 5);
    }
    return {
      plays: hist.length,
      liked: liked,
      minutes: Math.round(totalSec / 60),
      topArtists: top(byArtist, 5),
      topGenres: top(byGenre, 5),
      topAlbums: top(byAlbum, 5)
    };
  }

  function fmtMin(m) {
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  function enhanceStatsPage() {
    if (!window.S || S.page !== 'stats') return;
    var view = document.getElementById('view');
    if (!view || view.querySelector('[data-real-stats]')) return;
    var st = computeStats();
    var box = document.createElement('div');
    box.setAttribute('data-real-stats', '1');
    box.className = 'wrap';
    box.style.cssText = 'padding:0 clamp(16px,3.4vw,44px) 40px';
    var artists = st.topArtists
      .map(function (x) {
        var a = window.ARTISTS && ARTISTS[x.k];
        return (
          '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line);font-size:14px"><span>' +
          (a ? a.name : x.k) +
          '</span><span class="mn">' +
          x.v +
          ' plays</span></div>'
        );
      })
      .join('');
    var genres = st.topGenres
      .map(function (x) {
        return (
          '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line);font-size:14px"><span>' +
          x.k +
          '</span><span class="mn">' +
          x.v +
          '</span></div>'
        );
      })
      .join('');
    box.innerHTML =
      '<div class="mn" style="color:var(--acc);margin-bottom:12px">ON THIS DEVICE</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">' +
      '<div style="border:1px solid var(--line);border-radius:12px;padding:16px"><div class="mn">PLAYS</div><div class="serif" style="font-size:28px;margin-top:6px">' +
      st.plays +
      '</div></div>' +
      '<div style="border:1px solid var(--line);border-radius:12px;padding:16px"><div class="mn">LIKED</div><div class="serif" style="font-size:28px;margin-top:6px">' +
      st.liked +
      '</div></div>' +
      '<div style="border:1px solid var(--line);border-radius:12px;padding:16px"><div class="mn">TIME</div><div class="serif" style="font-size:22px;margin-top:6px">' +
      fmtMin(st.minutes) +
      '</div></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px" class="statg">' +
      '<div><div class="mn" style="margin-bottom:8px">TOP ARTISTS</div>' +
      (artists || '<p class="it" style="color:var(--mut)">Play something to build stats.</p>') +
      '</div><div><div class="mn" style="margin-bottom:8px">TOP GENRES</div>' +
      (genres || '<p class="it" style="color:var(--mut)">—</p>') +
      '</div></div>' +
      '<p class="mn" style="margin-top:20px;color:var(--mut)">Local only · never uploaded</p>' +
      '<style>@media(max-width:700px){.statg{grid-template-columns:1fr!important}}</style>';
    var first = view.querySelector('.sec') || view;
    first.parentNode.insertBefore(box, first);
  }

  // Image error → local cover
  document.addEventListener(
    'error',
    function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'IMG') return;
      if (el.dataset.fallback) return;
      el.dataset.fallback = '1';
      if (window.IMG && IMG.ORB) el.src = IMG.ORB;
    },
    true
  );

  var obs = new MutationObserver(function () {
    enhanceStatsPage();
  });
  function boot() {
    var v = document.getElementById('view');
    if (v) obs.observe(v, { childList: true, subtree: true });
    setTimeout(enhanceStatsPage, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SONORA_POLISH = { computeStats: computeStats };
})();
