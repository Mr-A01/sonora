/**
 * SONORA SEO — works on static GitHub Pages (client-side updates)
 * - document.title per page
 * - meta description + OG/Twitter tags
 * - JSON-LD MusicWebPage / CollectionPage
 * Crawlers that execute JS (Google) see updates; first paint still has solid defaults in index.html
 */
(function () {
  'use strict';

  var DEFAULT_DESC =
    'SONORA is a self-hosted music player: your own library, artists, albums, playlists and listening stats.';
  var SITE = 'SONORA';

  function ensureMeta(attr, key, content) {
    var sel =
      attr === 'property'
        ? 'meta[property="' + key + '"]'
        : 'meta[name="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content || '');
  }

  function setCanonical(path) {
    var href = location.origin + location.pathname + (path || location.hash || '');
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  function setJsonLd(obj) {
    var id = 'sonora-jsonld';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(obj);
  }

  function pageInfo(page, param) {
    page = page || 'home';
    var title = SITE + ' — Listen deeper.';
    var desc = DEFAULT_DESC;
    var type = 'website';

    switch (page) {
      case 'home':
        title = SITE + ' — Listen deeper.';
        break;
      case 'discover':
        title = 'Discover & For You — ' + SITE;
        desc = 'Personalised discovery from your listening on this device. No account required.';
        break;
      case 'music':
        title = 'Music — ' + SITE;
        desc = 'Albums, releases and listening on SONORA.';
        break;
      case 'charts':
        title = 'Charts — ' + SITE;
        break;
      case 'artists':
        title = 'Artists — ' + SITE;
        desc = 'The voices in your library — artists, discographies and similar acts.';
        break;
      case 'artist':
        if (param && window.ARTISTS && ARTISTS[param]) {
          title = ARTISTS[param].name + ' — ' + SITE;
          desc = ARTISTS[param].bio || desc;
          type = 'profile';
        }
        break;
      case 'album':
        if (param && window.album) {
          var al = album(param);
          if (al) {
            title = al.t + ' — ' + SITE;
            desc = (al.t + ' by ' + (window.artist ? artist(al.a).name : '')) || desc;
            type = 'music.album';
          }
        }
        break;
      case 'library':
        title = 'Your library — ' + SITE;
        desc = 'Liked tracks, albums and history — stored only on this device.';
        break;
      case 'playlists':
        title = 'Playlists — ' + SITE;
        break;
      case 'history':
        title = 'History of sound — ' + SITE;
        desc = 'A short, factual timeline of how people have listened to music.';
        break;
      case 'about':
        title = 'About — ' + SITE;
        break;
      case 'stats':
        title = 'Your listening — ' + SITE;
        break;
      default:
        title = SITE + ' — ' + page;
    }
    return { title: title, desc: desc, type: type };
  }

  function apply(page, param) {
    var info = pageInfo(page, param);
    document.title = info.title;
    ensureMeta('name', 'description', info.desc);
    ensureMeta('property', 'og:title', info.title);
    ensureMeta('property', 'og:description', info.desc);
    ensureMeta('property', 'og:type', info.type === 'music.album' ? 'music.album' : 'website');
    ensureMeta('property', 'og:site_name', SITE);
    ensureMeta('name', 'twitter:card', 'summary_large_image');
    ensureMeta('name', 'twitter:title', info.title);
    ensureMeta('name', 'twitter:description', info.desc);
    setCanonical(location.hash || '#/');

    var ld = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE,
      description: DEFAULT_DESC,
      url: location.origin + location.pathname,
      potentialAction: {
        '@type': 'SearchAction',
        target: location.origin + location.pathname + '#/?q={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    };
    if (page === 'artist' && param && window.ARTISTS && ARTISTS[param]) {
      ld = {
        '@context': 'https://schema.org',
        '@type': 'MusicGroup',
        name: ARTISTS[param].name,
        description: ARTISTS[param].bio || '',
        genre: ARTISTS[param].g || ''
      };
    }
    if (page === 'album' && param && window.album) {
      var a = album(param);
      if (a) {
        ld = {
          '@context': 'https://schema.org',
          '@type': 'MusicAlbum',
          name: a.t,
          byArtist: window.artist ? artist(a.a).name : '',
          genre: a.g || '',
          datePublished: String(a.y || '')
        };
      }
    }
    setJsonLd(ld);
  }

  function hookNav() {
    if (typeof window.nav !== 'function') return;
    var orig = window.nav;
    window.nav = function (p, param) {
      orig(p, param);
      try {
        apply(p, param);
      } catch (e) {}
    };
    // initial
    try {
      apply((window.S && S.page) || 'home', (window.S && S.param) || null);
    } catch (e) {}
    /* deeplink.js handles popstate/hashchange with the raw nav function,
       so re-apply meta after it has settled */
    var refresh = function () {
      setTimeout(function () {
        try {
          apply((window.S && S.page) || 'home', (window.S && S.param) || null);
        } catch (e) {}
      }, 0);
    };
    window.addEventListener('popstate', refresh);
    window.addEventListener('hashchange', refresh);
  }

  function boot() {
    setTimeout(hookNav, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.SONORA_SEO = { apply: apply, pageInfo: pageInfo };
})();
