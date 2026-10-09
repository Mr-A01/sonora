/**
 * SONORA For You — rule-based recommendations (no ML, no server)
 * Uses likes, history, follows, recents, time-of-day from localStorage state.
 * Replaces the hard-coded Discover "For you" rail with real reasons.
 */
(function () {
  'use strict';

  function hourBucket() {
    var h = new Date().getHours();
    if (h < 6) return 'late';
    if (h < 12) return 'morning';
    if (h < 18) return 'day';
    if (h < 22) return 'evening';
    return 'late';
  }

  function greeting() {
    var b = hourBucket();
    if (b === 'morning') return 'Good morning.';
    if (b === 'day') return 'Good afternoon.';
    if (b === 'evening') return 'Good evening.';
    return 'Still up.';
  }

  function parseRef(ref) {
    if (!ref || ref.indexOf(':') < 0) return null;
    var p = ref.split(':');
    return { al: p[0], i: +p[1] || 0, ref: ref };
  }

  function albumGenre(al) {
    if (!al) return '';
    return String(al.g || '').toLowerCase();
  }

  function artistIdOf(al) {
    return al && al.a ? al.a : null;
  }

  /** Build preference profile from local behavior */
  function profile() {
    var genreScore = {};
    var artistScore = {};
    var seen = {};
    var likedRefs = [];
    var histRefs = (window.S && S.hist) || [];
    var likes = (window.S && S.likes) || {};
    var follows = (window.S && S.follows) || {};

    Object.keys(likes).forEach(function (ref) {
      if (!likes[ref]) return;
      likedRefs.push(ref);
      var p = parseRef(ref);
      if (!p || !window.album) return;
      var al = album(p.al);
      if (!al) return;
      var g = albumGenre(al);
      if (g) genreScore[g] = (genreScore[g] || 0) + 3;
      var aid = artistIdOf(al);
      if (aid) artistScore[aid] = (artistScore[aid] || 0) + 4;
      seen[ref] = true;
    });

    histRefs.forEach(function (ref, idx) {
      var w = Math.max(1, 3 - Math.floor(idx / 8));
      var p = parseRef(ref);
      if (!p || !window.album) return;
      var al = album(p.al);
      if (!al) return;
      var g = albumGenre(al);
      if (g) genreScore[g] = (genreScore[g] || 0) + w;
      var aid = artistIdOf(al);
      if (aid) artistScore[aid] = (artistScore[aid] || 0) + w;
      seen[ref] = true;
    });

    Object.keys(follows).forEach(function (aid) {
      if (follows[aid]) artistScore[aid] = (artistScore[aid] || 0) + 5;
    });

    var topGenres = Object.keys(genreScore).sort(function (a, b) {
      return genreScore[b] - genreScore[a];
    });
    var topArtists = Object.keys(artistScore).sort(function (a, b) {
      return artistScore[b] - artistScore[a];
    });

    return {
      genreScore: genreScore,
      artistScore: artistScore,
      topGenres: topGenres,
      topArtists: topArtists,
      seen: seen,
      likedRefs: likedRefs,
      cold: topGenres.length === 0 && topArtists.length === 0
    };
  }

  function allTrackRefs() {
    var out = [];
    if (!window.ALBUMS) return out;
    ALBUMS.forEach(function (al) {
      if (!al.tracks) return;
      for (var i = 0; i < al.tracks.length; i++) {
        out.push(al.id + ':' + i);
      }
    });
    return out;
  }

  function scoreTrack(ref, prof) {
    var p = parseRef(ref);
    if (!p || !window.album) return { score: 0, reason: '' };
    var al = album(p.al);
    if (!al) return { score: 0, reason: '' };
    if (prof.seen[ref] && prof.likedRefs.indexOf(ref) >= 0) {
      return { score: -1, reason: '' }; // already liked — deprioritize for discovery
    }
    var score = 0;
    var reasons = [];
    var g = albumGenre(al);
    var aid = artistIdOf(al);

    if (g && prof.genreScore[g]) {
      score += prof.genreScore[g] * 2;
      reasons.push('Matches your ' + g + ' listening');
    }
    if (aid && prof.artistScore[aid]) {
      score += prof.artistScore[aid] * 2;
      var an = window.artist ? artist(aid).name : aid;
      reasons.push('Because you play ' + an);
    }
    // Similar artists
    if (aid && window.ARTISTS && ARTISTS[aid] && ARTISTS[aid].sim) {
      ARTISTS[aid].sim.forEach(function (sid) {
        if (prof.artistScore[sid]) {
          score += 2;
          reasons.push('Similar to artists you like');
        }
      });
    }
    // Time-of-day bias
    var bucket = hourBucket();
    if (bucket === 'late' && /ambient|electronic|jazz|noir/i.test(g + ' ' + (al.t || ''))) {
      score += 2;
      reasons.push('Fits late night');
    }
    if (bucket === 'morning' && /folk|classical|indie|ambient/i.test(g)) {
      score += 1.5;
      reasons.push('Morning energy');
    }
    if (bucket === 'day' && /electronic|indie|pop/i.test(g)) {
      score += 1;
    }
    // Slight novelty boost for never-heard albums
    var heardAlbum = false;
    Object.keys(prof.seen).forEach(function (r) {
      if (r.split(':')[0] === al.id) heardAlbum = true;
    });
    if (!heardAlbum) {
      score += 1.2;
      if (!reasons.length) reasons.push('New to you');
    }
    // Cold start editorial
    if (prof.cold) {
      score += 1;
      reasons = ['Editor’s pick while we learn your taste'];
    }

    var reason = reasons[0] || 'Recommended for you';
    return { score: score, reason: reason, al: al, ref: ref };
  }

  function forYouList(limit) {
    limit = limit || 8;
    var prof = profile();
    var refs = allTrackRefs();
    var scored = [];
    for (var i = 0; i < refs.length; i++) {
      var s = scoreTrack(refs[i], prof);
      if (s.score > 0) scored.push(s);
    }
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    // diversity: max 2 per album
    var perAlbum = {};
    var out = [];
    for (var j = 0; j < scored.length && out.length < limit; j++) {
      var alid = scored[j].ref.split(':')[0];
      perAlbum[alid] = (perAlbum[alid] || 0) + 1;
      if (perAlbum[alid] > 2) continue;
      out.push(scored[j]);
    }
    // fallback editorial if empty
    if (!out.length) {
      var all = window.allRefs ? allRefs() : [];
      all.forEach(function (r) {
        if (out.length >= limit) return;
        var tr = window.trackRef ? trackRef(r) : null;
        if (tr)
          out.push({
            ref: r,
            score: 1,
            reason: 'From your library',
            al: tr.al
          });
      });
    }
    return out;
  }

  function similarArtists(limit) {
    limit = limit || 4;
    var prof = profile();
    var out = [];
    var used = {};
    prof.topArtists.forEach(function (aid) {
      if (!window.ARTISTS || !ARTISTS[aid] || !ARTISTS[aid].sim) return;
      ARTISTS[aid].sim.forEach(function (sid) {
        if (used[sid] || prof.artistScore[sid] > 3) return;
        if (!ARTISTS[sid]) return;
        used[sid] = true;
        out.push({
          id: sid,
          reason: 'Because you listen to ' + ARTISTS[aid].name
        });
      });
    });
    if (!out.length && window.ARTISTS) {
      Object.keys(ARTISTS)
        .slice(0, limit)
        .forEach(function (id) {
          out.push({ id: id, reason: 'Featured voice' });
        });
    }
    return out.slice(0, limit);
  }

  function buildDiscoverHTML() {
    if (!window.railHead || !window.ic || !window.esc) return null;
    var fy = forYouList(8);
    var sims = similarArtists(4);
    var h =
      '<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">DISCOVER</span></span>' +
      '<h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">' +
      greeting() +
      '</h1>' +
      '<p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Built from what you actually play — on this device only.</p></div>';

    h +=
      '<section class="sec" style="padding-top:30px"><div class="wrap">' +
      railHead('01', 'For you');
    h += '<div class="rail">';
    fy.forEach(function (item) {
      var tr = trackRef(item.ref);
      if (!tr) return;
      h +=
        '<div class="acard sm" data-rv><button data-a="play-ref" data-ref="' +
        item.ref +
        '" style="width:100%;text-align:left"><span class="im" style="display:block"><img src="' +
        (tr.al.img || '') +
        '" alt="" loading="lazy"><span class="pb" style="opacity:1;transform:none">' +
        ic('play', 16) +
        '</span></span><span class="t" style="font-size:13px">' +
        esc(tr.t) +
        '</span><span class="s">' +
        esc(artist(tr.al.a).name) +
        '</span></button><span class="why">' +
        esc(item.reason) +
        '</span></div>';
    });
    h += '</div></div></section>';

    h +=
      '<section class="sec" style="padding-top:0"><div class="wrap">' +
      railHead('02', 'Because you listen') +
      '<div class="mgrid">';
    sims.forEach(function (s, i) {
      var a = ARTISTS[s.id];
      if (!a) return;
      h +=
        '<div class="' +
        (i === 0 ? 'c3' : 'c2') +
        '" data-rv><button data-a="artist" data-id="' +
        a.id +
        '" style="width:100%;text-align:left"><span style="display:block;border-radius:10px;overflow:hidden"><img src="' +
        a.img +
        '" alt="" loading="lazy" style="aspect-ratio:1/1;object-fit:cover;width:100%"></span><span class="mn" style="display:block;margin-top:12px;color:var(--acc)">SIMILAR</span><span class="t" style="display:block;font-weight:600;margin-top:4px">' +
        esc(a.name) +
        '</span><span class="why">' +
        esc(s.reason) +
        '</span></button></div>';
    });
    h += '</div></div></section>';

    // Keep editorial rails from original style
    h +=
      '<section class="sec" style="padding-top:0"><div class="wrap">' +
      railHead('03', 'New releases') +
      '<div class="rail">' +
      (window.ALBUMS ? ALBUMS.slice(0, 4) : [])
        .map(function (al) {
          return typeof albumCard === 'function' ? albumCard(al) : '';
        })
        .join('') +
      '</div></div></section>';

    h +=
      '<section class="sec" style="padding-top:0"><div class="wrap">' +
      railHead('04', 'Deep cuts') +
      '<div class="rail">' +
      (window.ALBUMS ? ALBUMS.slice(-4) : [])
        .map(function (al) {
          return typeof albumCard === 'function' ? albumCard(al, 'sm') : '';
        })
        .join('') +
      '</div></div></section>';

    var hist = (window.S && S.hist) || [];
    h +=
      '<section class="sec" style="padding-top:0"><div class="wrap">' +
      railHead('05', 'Jump back in') +
      '<div class="rail">';
    if (hist.length) {
      hist.slice(0, 8).forEach(function (r) {
        var tr = trackRef(r);
        if (!tr) return;
        h +=
          '<button class="acard sm" data-a="play-ref" data-ref="' +
          r +
          '" data-rv><span class="im"><img src="' +
          tr.al.img +
          '" alt="" loading="lazy"></span><span class="t" style="font-size:13px">' +
          esc(tr.t) +
          '</span><span class="s">' +
          esc(artist(tr.al.a).name) +
          '</span></button>';
      });
    } else {
      h += '<p class="it" style="color:var(--mut)">Play something — your history will appear here.</p>';
    }
    h += '</div></div></section>';

    return h;
  }

  function install() {
    if (!window.PAGES) return;
    var original = PAGES.discover;
    PAGES.discover = function () {
      try {
        var html = buildDiscoverHTML();
        if (html) return html;
      } catch (e) {}
      return original ? original() : '';
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(install, 0);
    });
  } else {
    setTimeout(install, 0);
  }

  window.SONORA_FORYOU = {
    profile: profile,
    forYouList: forYouList,
    similarArtists: similarArtists,
    refresh: function () {
      install();
      if (window.S && S.page === 'discover' && typeof render === 'function') render();
    }
  };
})();
