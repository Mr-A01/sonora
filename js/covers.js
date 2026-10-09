/**
 * SONORA covers — local data-URI SVG placeholder art.
 * Real artwork comes from the music files themselves (ID3 APIC),
 * extracted by `python .github/scripts/add_music.py` into audio/covers/.
 * Only IMG.ORB is exposed here, used whenever a track has no art.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function svgCover(opts) {
    opts = opts || {};
    var c1 = opts.c1 || '#1a1612';
    var c2 = opts.c2 || '#3d3428';
    var accent = opts.accent || '#D9A441';
    var label = opts.label || 'SONORA';
    var sub = opts.sub || '';
    var seed = opts.seed || 0;
    var x1 = 20 + (seed % 40);
    var y1 = 30 + ((seed * 7) % 50);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
      '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="' +
      c1 +
      '"/><stop offset="100%" stop-color="' +
      c2 +
      '"/></linearGradient>' +
      '<radialGradient id="r" cx="' +
      x1 +
      '%" cy="' +
      y1 +
      '%" r="70%">' +
      '<stop offset="0%" stop-color="' +
      accent +
      '" stop-opacity="0.35"/>' +
      '<stop offset="100%" stop-color="' +
      accent +
      '" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="400" height="400" fill="url(#g)"/>' +
      '<rect width="400" height="400" fill="url(#r)"/>' +
      '<circle cx="200" cy="175" r="54" fill="none" stroke="' +
      accent +
      '" stroke-width="1.5" opacity="0.85"/>' +
      '<circle cx="200" cy="175" r="18" fill="' +
      accent +
      '" opacity="0.9"/>' +
      '<text x="200" y="280" text-anchor="middle" fill="#F2EEE6" font-family="Georgia, serif" font-size="22" opacity="0.92">' +
      esc(label) +
      '</text>' +
      (sub
        ? '<text x="200" y="308" text-anchor="middle" fill="#F2EEE6" font-family="monospace" font-size="11" opacity="0.45" letter-spacing="2">' +
          esc(sub).toUpperCase() +
          '</text>'
        : '') +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* data.js declares `var IMG` at top level → same global object */
  window.IMG = window.IMG || {};
  window.IMG.ORB = svgCover({
    c1: '#0A0908',
    c2: '#1E1A15',
    accent: '#D9A441',
    label: 'SONORA',
    sub: 'Listen deeper',
    seed: 0
  });
  window.sonoraCover = svgCover;
})();

