/**
 * SONORA — Deep linking via hash (#/page/param)
 * Works on GitHub Pages without server rewrite rules.
 * Integrates with existing nav() / S.page system.
 */
(function () {
  'use strict';

  var VALID = {
    home:1, discover:1, music:1, charts:1, album:1, artists:1, artist:1,
    playlists:1, playlist:1, history:1, about:1,
    library:1, stats:1
  };

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return { page: 'home', param: null };
    var parts = h.split('/').filter(Boolean);
    var page = parts[0] || 'home';
    var param = parts[1] || null;
    if (!VALID[page]) { page = 'home'; param = null; }
    return { page: page, param: param };
  }

  function toHash(page, param) {
    if (!page || page === 'home') return '#/';
    return '#/' + page + (param ? '/' + encodeURIComponent(param) : '');
  }

  /* Override nav so every navigation updates the URL */
  var origNav = window.nav;
  if (typeof origNav === 'function') {
    window.nav = function (p, param) {
      origNav(p, param);
      var next = toHash(p, param);
      if (location.hash !== next) {
        try {
          history.pushState({ page: p, param: param }, '', next);
        } catch (e) {
          location.hash = next;
        }
      }
    };
  }

  function applyFromUrl(replace) {
    var r = parseHash();
    if (typeof window.nav === 'function') {
      /* avoid double push */
      var prev = window.nav;
      window.nav = function (p, param) {
        if (typeof origNav === 'function') origNav(p, param);
      };
      window.nav(r.page, r.param);
      window.nav = prev;
      if (replace) {
        try {
          history.replaceState({ page: r.page, param: r.param }, '', toHash(r.page, r.param));
        } catch (e) {}
      }
    }
  }

  window.addEventListener('popstate', function () {
    applyFromUrl(false);
  });

  window.addEventListener('hashchange', function () {
    /* only if pushState was not used */
    if (!history.state) applyFromUrl(false);
  });

  /* Boot after app.js has defined nav + render */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { applyFromUrl(true); }, 0);
    });
  } else {
    setTimeout(function () { applyFromUrl(true); }, 0);
  }
})();
