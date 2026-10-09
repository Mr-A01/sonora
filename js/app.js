/**
 * SONORA — Listen deeper.
 * Real HTMLAudioElement playback, scrubbable progress, localStorage library.
 */

'use strict';
/* DATA (IMG, ARTISTS, ALBUMS, PLAYLISTS, HISTORY, TECH) in js/data.js.
   Music library comes from audio/manifest.json — regenerate with: python .github/scripts/add_music.py */
/* STATE */
var S={page:'home',param:null,tab:null,
 playing:{al:null,i:0,t:0,on:false,ctx:null},queue:[],likes:{},follows:{},hist:[],savedPl:{},savedAlb:{},volume:0.85,muted:false,shuffle:false,repeat:'off',
 ambient:true,ptab:'queue',sleep:0,
 genre:'',decade:0,libTab:'liked',
 recents:[]};

/* ========== REAL AUDIO ENGINE ========== */
/* Track audio files: see trackAudioUrl() below (manifest → audio/{id}.mp3) */
var audioEl=new Audio();
audioEl.preload="metadata";
audioEl.volume=0.85;

function trackMeta(alId,idx){
  var al=album(alId);var tr=(al&&al.tracks&&al.tracks[idx])||null;
  return tr;
}
/** Audio file path = audio/{track.id}.mp3 — put your files there with the same id. */
function trackAudioUrl(alId,idx){
  var tr=trackMeta(alId,idx);
  if(tr&&tr.file)return tr.file; /* track from audio/manifest.json */
  if(tr&&tr.id)return 'audio/'+tr.id+'.mp3';
  return 'audio/'+alId+'-'+(idx+1)+'.mp3';
}
/* ============================================================
   PERSISTENCE — one key: sonora-state-v2 (see spec §5)
   saveState()   — debounced 300ms write of the whole object
   loadState()   — called at boot; migrates legacy sonora-state
                   and sonora-vol keys, then deletes them
   clearState()  — on window; wired to the footer "Reset app"
   ============================================================ */
var STATE_KEY='sonora-state-v2';
var saveT=null;
function hasAlbum(id){for(var i=0;i<ALBUMS.length;i++)if(ALBUMS[i].id===id)return true;return false;}
function stateObj(){
  var p=(S.playing.al&&hasAlbum(S.playing.al))?
    {al:S.playing.al,i:S.playing.i,t:Math.round((S.playing.t||0)*10)/10}:null;
  return {version:2,
    likes:S.likes||{},follows:S.follows||{},savedPl:S.savedPl||{},savedAlb:S.savedAlb||{},
    hist:(S.hist||[]).slice(0,50),recents:S.recents||[],
    player:p,volume:S.volume,muted:!!S.muted,shuffle:!!S.shuffle,
    repeat:S.repeat||'off',ambient:!!S.ambient,
    eq:(window.EQ&&EQ.serialize)?EQ.serialize():
       {enabled:true,preset:'Flat',bands:[0,0,0,0,0,0,0,0,0,0],preamp:0,custom:{}},
    ui:{ptab:S.ptab||'queue',libTab:S.libTab||'liked',genre:S.genre||'',
        decade:typeof S.decade==='number'?S.decade:0},
    id3Cache:S.id3Cache||{}};
}
function saveState(){
  if(saveT)return; /* debounced 300ms */
  saveT=setTimeout(function(){
    saveT=null;
    try{localStorage.setItem(STATE_KEY,JSON.stringify(stateObj()));}catch(e){}
  },300);
}
function trimId3Cache(){
  var c=S.id3Cache||{},k;
  try{
    k=Object.keys(c);
    while(k.length&&JSON.stringify(c).length>2097152){delete c[k.shift()];} /* ~2MB, oldest first */
  }catch(e){}
}
function loadState(){
  var d=null;
  try{d=JSON.parse(localStorage.getItem(STATE_KEY)||'null');}catch(e){d=null;}
  if(!d){ /* migrate legacy sonora-state / sonora-vol */
    try{
      var legacy=JSON.parse(localStorage.getItem('sonora-state')||'null');
      var ov=JSON.parse(localStorage.getItem('sonora-vol')||'null');
      if(legacy||ov){
        d={version:2,
          likes:(legacy&&legacy.likes)||{},follows:(legacy&&legacy.follows)||{},
          savedPl:(legacy&&legacy.savedPl)||{},savedAlb:(legacy&&legacy.savedAlb)||{},
          hist:(legacy&&legacy.hist)||[],recents:(legacy&&legacy.recents)||[]};
        if(ov){d.volume=ov.volume;d.muted=ov.muted;}
      }
    }catch(e){}
  }
  try{
    if(d){
      if(d.likes)S.likes=d.likes;
      if(d.follows)S.follows=d.follows;
      if(d.savedPl)S.savedPl=d.savedPl;
      if(d.savedAlb)S.savedAlb=d.savedAlb;
      if(d.hist&&d.hist.length)S.hist=d.hist;
      if(d.recents&&d.recents.length)S.recents=d.recents;
      if(typeof d.volume==='number')S.volume=d.volume;
      if(typeof d.muted==='boolean')S.muted=d.muted;
      if(typeof d.shuffle==='boolean')S.shuffle=d.shuffle;
      if(d.repeat)S.repeat=d.repeat;
      if(typeof d.ambient==='boolean')S.ambient=d.ambient;
      if(d.ui){
        if(d.ui.ptab)S.ptab=d.ui.ptab;
        if(d.ui.libTab)S.libTab=d.ui.libTab;
        if(d.ui.genre)S.genre=d.ui.genre;
        if(typeof d.ui.decade==='number')S.decade=d.ui.decade;
      }
      S.id3Cache=d.id3Cache||{};
      if(d.eq&&window.EQ&&EQ.restore)EQ.restore(d.eq);
      try{audioEl.volume=S.muted?0:S.volume;}catch(e){}
      if(d.player&&d.player.al&&hasAlbum(d.player.al)){
        /* restore last track PAUSED — no autoplay (browsers block it anyway) */
        S.playing={al:d.player.al,i:d.player.i||0,t:d.player.t||0,on:false,ctx:null};
        try{restorePlayer();}catch(e){}
      }
    }
  }catch(e){}
  /* migrated — drop the legacy keys */
  try{localStorage.removeItem('sonora-state');localStorage.removeItem('sonora-vol');}catch(e){}
}
function clearState(){
  try{
    clearTimeout(saveT);saveT=null;
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem('sonora-state');
    localStorage.removeItem('sonora-vol');
    localStorage.removeItem('sonora-eq-presets');
  }catch(e){}
}
window.saveState=saveState;window.loadState=loadState;window.clearState=clearState;
function savePersist(){saveState();} /* legacy alias — every old call site still works */
loadState();
/* ============================================================
   AUDIO MANIFEST — audio/manifest.json (generated by add_music.py)
   Missing file / 404 / invalid JSON → empty library, empty states shown.
   ============================================================ */
function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'track';}
function manTrack(t){
  return {id:String(t.id),t:String(t.title||t.id),d:String(t.duration||'0:00'),
    file:t.file||('audio/'+t.id+'.mp3'),cover:t.cover||null,
    year:t.year||null,genre:t.genre||null,fromManifest:true};
}
function mergeManifestTrack(t){
  if(!t||!t.id)return;
  var aName=t.artist||'Unknown Artist',alName=t.album||'Singles';
  var aKey=slug(aName),alKey=slug(alName)+'-'+aKey;
  var ar=ARTISTS[aKey];
  if(!ar){ /* auto-create the artist entry from the file's tags */
    ar={id:aKey,name:String(aName),g:t.genre||'',loc:'',ac:'#D9A441',
      img:t.cover||IMG.ORB,sim:[],
      bio:''};
    ARTISTS[aKey]=ar;
  }
  var alb=null;
  for(var i=0;i<ALBUMS.length;i++){if(ALBUMS[i].id===alKey){alb=ALBUMS[i];break;}}
  if(!alb){ /* auto-create the album entry */
    alb={id:alKey,t:String(alName),a:aKey,y:t.year||new Date().getFullYear(),g:t.genre||'Single',
      img:t.cover||IMG.ORB,credits:{},
      tracks:[],fromManifest:true};
    ALBUMS.push(alb);
  }
  alb.fromManifest=true;
  if(t.cover){
    alb.cover=t.cover;
    if(!alb.img||alb.img===IMG.ORB)alb.img=t.cover;
    /* cover file may not exist — probe it; ID3 art takes over on 404 */
    (function(alb,src){
      var im=new Image();
      im.onerror=function(){
        if(alb.cover===src)alb.cover=null;
        if(alb.img===src)alb.img=IMG.ORB;
      };
      im.src=src;
    })(alb,t.cover);
  }
  var tr=manTrack(t);
  var idx=-1;
  for(var j=0;j<alb.tracks.length;j++){if(alb.tracks[j].id===tr.id){alb.tracks[j]=tr;idx=j;break;}}
  if(idx<0){alb.tracks.push(tr);idx=alb.tracks.length-1;}
  /* no cover declared → extract ID3 tags + embedded art from the mp3 */
  if(!t.cover){try{ensureId3(alKey,idx);}catch(e){}}
}
function loadManifest(){
  if(!window.fetch)return;
  fetch('audio/manifest.json')
    .then(function(r){if(!r.ok)return null;return r.json();})
    .then(function(d){
      if(!d||!d.tracks||!d.tracks.length)return;
      for(var i=0;i<d.tracks.length;i++){
        try{
          var t=d.tracks[i];
          mergeManifestTrack(t);
          if(t&&t.cover)verifyCover(t.cover); /* dead cover → ID3 fallback */
        }catch(e){}
      }
      /* derive playlists from the real library */
      try{if(window.rebuildPlaylists)rebuildPlaylists();}catch(e){}
      try{render();}catch(e){}
    })
    .catch(function(){/* no manifest (404) — empty library */});
}
function verifyCover(url){
  /* HEAD the declared cover; if it 404s drop it so coverFor() falls back to ID3 art */
  if(!window.fetch)return;
  try{
    fetch(url,{method:'HEAD'}).then(function(r){
      if(!r.ok)throw new Error('cover missing');
    }).catch(function(){
      for(var i=0;i<ALBUMS.length;i++){
        if(ALBUMS[i].cover===url)ALBUMS[i].cover=null;
        if(ALBUMS[i].img===url)ALBUMS[i].img=IMG.ORB;
      }
      for(var k in ARTISTS){if(ARTISTS[k]&&ARTISTS[k].img===url)ARTISTS[k].img=IMG.ORB;}
      try{render();renderMini();renderPlayerIfOpen();}catch(e){}
    });
  }catch(e){}
}
/* ============================================================
   ID3 tags + embedded cover art (js/id3.js)
   Fallback chain: ID3 cover → manifest cover → album img → ORB
   ============================================================ */
var id3Mem={}; /* url → {title,artist,album,cover} for this session */
function id3Lookup(url){
  if(id3Mem[url])return id3Mem[url];
  var c=(S.id3Cache||{})[url];
  if(c){id3Mem[url]=c;return c;}
  return null;
}
function id3Store(url,memRec,persistRec){
  id3Mem[url]=memRec;
  try{S.id3Cache=S.id3Cache||{};S.id3Cache[url]=persistRec;trimId3Cache();saveState();}catch(e){}
}
function coverFor(al,tr){
  var u=tr?(tr.file||('audio/'+tr.id+'.mp3')):null;
  var rec=u?id3Lookup(u):null;
  var hasArt=rec&&rec.cover;
  var noImg=!al||!al.img||al.img===IMG.ORB;
  var manNoCover=al&&al.fromManifest&&!al.cover;
  if(hasArt&&(noImg||manNoCover))return rec.cover;     /* embedded art wins */
  if(al&&al.cover&&noImg)return al.cover;              /* manifest cover   */
  if(tr&&tr.cover&&noImg)return tr.cover;
  if(al&&al.img)return al.img;                         /* album image      */
  return IMG.ORB;                                      /* placeholder      */
}
function ensureId3(alId,idx){
  if(!window.ID3||!ID3.read)return;
  var tr=trackMeta(alId,idx);if(!tr)return;
  var url=trackAudioUrl(alId,idx);if(!url)return;
  if(id3Mem[url])return;    /* parsed this session */
  if(id3Lookup(url))return; /* cached (even tagless) */
  try{
    ID3.read(url).then(function(tags){
      if(!tags)return;
      var mem={title:tags.title||tr.t,artist:tags.artist||null,album:tags.album||null,
               cover:tags.cover||tags.coverData||null};
      var disk={title:mem.title,artist:mem.artist,album:mem.album,cover:tags.coverData||null};
      id3Store(url,mem,disk);
      try{
        if(S.playing.al===alId){renderMini();renderPlayerIfOpen();}
        /* swap album-card covers in place (no full re-render) */
        var ims=$$('img[data-alb="'+alId+'"]'),alb=album(alId),t0=trackMeta(alId,0);
        for(var q=0;q<ims.length;q++)ims[q].src=coverFor(alb,t0);
      }catch(e){}
    }).catch(function(){});
  }catch(e){}
}
function restorePlayer(){
  if(!S.playing.al)return;
  var url=trackAudioUrl(S.playing.al,S.playing.i),t=S.playing.t||0;
  try{
    audioEl.src=url;audioEl.pause();
    audioEl.addEventListener('loadedmetadata',function h(){
      try{audioEl.currentTime=t;}catch(e){}
      audioEl.removeEventListener('loadedmetadata',h);
    });
  }catch(e){}
  ensureId3(S.playing.al,S.playing.i);
  try{renderMini();}catch(e){}
}
function syncProgressUI(){
  var nt=nowTrack();if(!nt)return;
  var dur=audioEl.duration&&isFinite(audioEl.duration)?audioEl.duration:durS(nt.d);
  var t=audioEl.currentTime||0;
  S.playing.t=t;
  var pct=dur?Math.min(100,(t/dur)*100):0;
  var mp=document.getElementById("miniBar");if(mp)mp.style.width=pct+"%";
  var pp=document.getElementById("pBar");if(pp)pp.style.width=pct+"%";
  var c=document.getElementById("pCur");if(c)c.textContent=fmt(Math.floor(t));
  var tot=document.getElementById("pDur");if(tot&&audioEl.duration&&isFinite(audioEl.duration))tot.textContent=fmt(Math.floor(audioEl.duration));
}
var lastPosSave=0;
audioEl.addEventListener("timeupdate",function(){
  syncProgressUI();
  if(Date.now()-lastPosSave>5000){lastPosSave=Date.now();saveState();} /* position every 5s */
});
audioEl.addEventListener("ended",function(){nextTrack(true);});
audioEl.addEventListener("play",function(){S.playing.on=true;try{renderMini();renderPlayerIfOpen();syncPlayingRows();}catch(e){}});
audioEl.addEventListener("pause",function(){if(!audioEl.ended){S.playing.on=false;try{renderMini();renderPlayerIfOpen();syncPlayingRows();}catch(e){}}});

function bindVolTrack(){
  var el=document.getElementById('volTrack');if(!el||el._wired)return;
  el._wired=true;
  el.addEventListener('click',function(ev){
    var r=el.getBoundingClientRect();
    var p=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
    S.muted=false;setVolume(p);
  });
}

function bindSeekBars(){
  function wire(id){
    var el=document.getElementById(id);if(!el||el._wired)return;
    el._wired=true;
    el.style.cursor="pointer";
    el.addEventListener("click",function(ev){
      if(!S.playing.al)return;
      var r=el.getBoundingClientRect();
      var p=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
      var nt=nowTrack();if(!nt)return;
      var dur=audioEl.duration&&isFinite(audioEl.duration)?audioEl.duration:durS(nt.d);
      try{audioEl.currentTime=p*dur;}catch(e){}
      S.playing.t=p*dur;
      syncProgressUI();
    });
  }
  wire("miniProg");wire("pProg");
}

var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function $(s){return document.querySelector(s);}
function $$(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
var toastT=null;
function toast(m){$('#toastTx').textContent=m;$('#toast').classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){$('#toast').classList.remove('show');},2600);}
function setAccent(h){document.documentElement.style.setProperty('--acc',h);document.documentElement.style.setProperty('--acc-soft',h+'24');}
/* ICONS */
function ic(n,s){s=s||18;var P={
 play:'<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
 pause:'<path d="M8 5h3v14H8zM13.5 5h3v14h-3z" fill="currentColor" stroke="none"/>',
 next:'<path d="M6 6l8 6-8 6zM16 6h2v12h-2z" fill="currentColor" stroke="none"/>',
 prev:'<path d="M18 6l-8 6 8 6zM6 6h2v12H6z" fill="currentColor" stroke="none"/>',
 heart:'<path d="M12 20s-7-4.6-9.2-9C1.2 7.6 3 4.5 6.2 4.5c2 0 3.3 1 4.1 2.3.4.7 1 .7 1.4 0 .8-1.3 2.1-2.3 4.1-2.3 3.2 0 5 3.1 3.4 6.5C19 15.4 12 20 12 20z"/>',
 heartF:'<path d="M12 20s-7-4.6-9.2-9C1.2 7.6 3 4.5 6.2 4.5c2 0 3.3 1 4.1 2.3.4.7 1 .7 1.4 0 .8-1.3 2.1-2.3 4.1-2.3 3.2 0 5 3.1 3.4 6.5C19 15.4 12 20 12 20z" fill="currentColor" stroke="none"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 lib:'<path d="M4 4h3v16H4zM9 4h3v16H9zM14.5 5l4.5 1.5-4 13.5L10.5 18z"/>',
 user:'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
 up:'<path d="M12 19V5M6 11l6-6 6 6"/>',down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 queue:'<path d="M4 6h12M4 10h12M4 14h7"/><path d="M17 12v7"/><circle cx="15" cy="19" r="2.4"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 wave:'<path d="M3 12h2M7 9v6M11 6v12M15 9v6M19 11v2"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 share:'<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7h14v-7"/>',
 glow:'<circle cx="12" cy="12" r="3.4"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/>',
 home:'<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-8M21 20H3"/>',
 moon:'<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>',
 sliders:'<path d="M4 7h8M16 7h4M4 12h4M12 12h8M4 17h10M18 17h2"/><circle cx="14" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="17" r="2"/>'
}[n]||'';return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P+'</svg>';}
/* PLAYBACK */
function nowTrack(){if(!S.playing.al)return null;var al=album(S.playing.al);var tr=al.tracks[S.playing.i]||{id:'',t:'',d:'0:00'};return {al:al,i:S.playing.i,id:tr.id,t:tr.t,d:tr.d};}

function setVolume(v){
  v=Math.max(0,Math.min(1,v));
  S.volume=v;S.muted=v===0?true:S.muted&&v===0;
  if(!S.muted)audioEl.volume=v;
  else audioEl.volume=0;
  saveState(); /* volume + mute persist immediately (debounced 300ms) */
  renderMini();renderPlayerIfOpen();
}
function toggleMute(){
  S.muted=!S.muted;
  audioEl.volume=S.muted?0:S.volume;
  saveState(); /* volume + mute persist immediately (debounced 300ms) */
  toast(S.muted?'Muted':'Unmuted');
  renderMini();renderPlayerIfOpen();
}
function cycleRepeat(){
  S.repeat=S.repeat==='off'?'all':(S.repeat==='all'?'one':'off');
  toast('Repeat: '+(S.repeat==='off'?'Off':S.repeat==='one'?'One':'All'));
  saveState();
  renderMini();renderPlayerIfOpen();
}
function toggleShuffle(){
  S.shuffle=!S.shuffle;
  toast(S.shuffle?'Shuffle on':'Shuffle off');
  saveState();
  renderMini();renderPlayerIfOpen();
}
function likeCurrent(){
  if(!S.playing.al)return;
  var ref=S.playing.al+':'+S.playing.i;
  S.likes[ref]=!S.likes[ref];
  savePersist();
  toast(S.likes[ref]?'Saved to liked tracks':'Removed from liked tracks');
  renderMini();renderPlayerIfOpen();syncHearts(ref);
}
function seekToRatio(p){
  if(!S.playing.al)return;
  var nt=nowTrack();if(!nt)return;
  var dur=audioEl.duration&&isFinite(audioEl.duration)?audioEl.duration:durS(nt.d);
  var t=Math.max(0,Math.min(dur-0.25,p*dur));
  try{audioEl.currentTime=t;}catch(e){}
  S.playing.t=t;syncProgressUI();
}
function shortcutsHelp(){
  var rows=[
    ['Space','Play / Pause'],
    ['← / →','Seek −10s / +10s'],
    ['Shift + ← / →','Seek −30s / +30s'],
    ['↑ / ↓','Volume up / down'],
    ['M','Mute / Unmute'],
    ['N or Shift + N','Next track'],
    ['P or Shift + P','Previous track'],
    ['L','Like current track'],
    ['S','Toggle shuffle'],
    ['R','Cycle repeat (off → all → one)'],
    ['F','Open full player'],
    ['E','Toggle EQ panel'],
    ['Shift + E','EQ bypass / enable'],
    ['Esc','Close player / search / modal'],
    ['⌘ / Ctrl + K','Search'],
    ['?','This shortcuts guide'],
    ['0–9','Jump to 0% … 90% of track']
  ];
  openModal('<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px"><h3 class="serif" style="font-size:28px;font-weight:400">Keyboard shortcuts</h3><button class="ibtn" data-a="mclose" aria-label="Close">'+ic('x',16)+'</button></div>'
    +'<div style="display:grid;gap:0">'+rows.map(function(r){
      return '<div style="display:grid;grid-template-columns:1fr 1.2fr;gap:16px;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span class="mn" style="color:var(--acc);letter-spacing:.12em">'+r[0]+'</span><span>'+r[1]+'</span></div>';
    }).join('')+'</div>'
    +'<p class="mn" style="margin-top:18px;color:var(--mut)">Shortcuts are disabled while typing in search or forms.</p>');
}
/* volume + mute are restored by loadState() above (sonora-state-v2) */

function play(alId,idx,ctx){
  var sameTrack=(S.playing.al===alId&&S.playing.i===(idx||0));
  var resume=(sameTrack&&!S.playing.on&&S.playing.t>0)?S.playing.t:0;
  S.playing={al:alId,i:idx||0,t:resume||0,on:true,ctx:ctx||null};
  var al=album(alId);
  setAccent(artist(al.a).ac);
  S.hist.unshift(alId+":"+S.playing.i);if(S.hist.length>30)S.hist.pop();
  var q=artist(al.a).name+" "+al.t;
  if(S.recents.indexOf(q)<0){S.recents.unshift(q);if(S.recents.length>8)S.recents.pop();}
  var tr=trackMeta(alId,S.playing.i);
  var tid=tr&&tr.id?tr.id:(alId+'-'+(S.playing.i+1));
  var url=trackAudioUrl(alId,S.playing.i);
  try{url=new URL(url,window.location.href).href;}catch(e){}
  audioEl.onerror=function(){
    audioEl.onerror=null;
    toast('Missing audio file: '+(tr&&tr.file?tr.file:'audio/'+tid+'.mp3'));
    S.playing.on=false;
    renderMini();renderPlayerIfOpen();syncPlayingRows();
  };
  if(audioEl.src!==url){audioEl.src=url;}
  if(resume){audioEl.addEventListener('loadedmetadata',function h(){try{audioEl.currentTime=resume;}catch(e){}audioEl.removeEventListener('loadedmetadata',h);});}
  else{try{audioEl.currentTime=0;}catch(e){}}
  ensureId3(alId,S.playing.i);
  var pr=audioEl.play();
  if(pr&&pr.catch)pr.catch(function(err){
    console.warn('play failed',err);
    toast('Could not start audio — check audio/'+tid+'.mp3');
  });
  savePersist();
  renderMini();renderPlayerIfOpen();syncPlayingRows();
  setTimeout(bindSeekBars,60);
}
function playRef(r,ctx){var p=r.split(':');play(p[0],+p[1],ctx);}
/** First playable "albumId:index" in the library, or null when empty. */
function firstRef(){var a=window.allRefs?allRefs():[];return a.length?a[0]:null;}
function togglePlay(){
  if(!S.playing.al){
    var r=firstRef();
    if(!r){toast('Library is empty — add music files and run python .github/scripts/add_music.py');return;}
    playRef(r);return;
  }
  if(S.playing.on){audioEl.pause();S.playing.on=false;}
  else{var pr=audioEl.play();if(pr&&pr.catch)pr.catch(function(){});S.playing.on=true;}
  renderMini();renderPlayerIfOpen();syncPlayingRows();
}
function nextTrack(fromEnded){
  if(!S.playing.al)return;
  if(fromEnded&&S.repeat==='one'){try{audioEl.currentTime=0;}catch(e){}audioEl.play().catch(function(){});S.playing.on=true;renderMini();renderPlayerIfOpen();return;}
  if(S.queue.length){playRef(S.queue.shift());return;}
  var al=album(S.playing.al);
  var n=al.tracks.length;
  var ni;
  if(S.shuffle){
    if(n<=1)ni=0;
    else{do{ni=Math.floor(Math.random()*n);}while(ni===S.playing.i);}
  }else{
    ni=S.playing.i+1;
    if(ni>=n){
      if(S.repeat==='all'||!fromEnded)ni=0;
      else{S.playing.on=false;try{audioEl.pause();}catch(e){}renderMini();renderPlayerIfOpen();return;}
    }
  }
  play(S.playing.al,ni,S.playing.ctx);
}
function prevTrack(){
  if(!S.playing.al)return;
  if(audioEl.currentTime>3){try{audioEl.currentTime=0;}catch(e){}S.playing.t=0;syncProgressUI();return;}
  var al=album(S.playing.al);
  play(S.playing.al,(S.playing.i-1+al.tracks.length)%al.tracks.length,S.playing.ctx);
}
function seek(d){
  if(!S.playing.al)return;
  var nt=nowTrack();if(!nt)return;
  var dur=audioEl.duration&&isFinite(audioEl.duration)?audioEl.duration:durS(nt.d);
  var t=Math.max(0,Math.min(dur-0.25,(audioEl.currentTime||0)+d));
  try{audioEl.currentTime=t;}catch(e){}
  S.playing.t=t;syncProgressUI();
}
setInterval(function(){
 if(S.sleep>0){S.sleep--;if(S.sleep===0){S.playing.on=false;try{audioEl.pause();}catch(e){}toast('Sleep timer — paused');renderMini();renderPlayerIfOpen();}}
},1000);
function fmt(s){var m=Math.floor(s/60),ss=s%60;return m+':'+(ss<10?'0':'')+ss;}
function syncPlayingRows(){$$('.trow').forEach(function(r){var ref=r.getAttribute('data-ref');if(!ref)return;var nt=nowTrack();r.classList.toggle('playing',!!nt&&ref===S.playing.al+':'+S.playing.i);});}
/* COMPONENTS */
function albumCard(al,size){var a=artist(al.a);
 return '<div class="acard '+(size||'')+'" data-rv>'
 +'<div class="im">'
 +'<img src="'+coverFor(al,al.tracks&&al.tracks[0])+'" alt="'+esc(al.t)+' — '+esc(a.name)+'" loading="lazy">'
 +'<button type="button" class="pb" data-a="play-album" data-id="'+al.id+'" aria-label="Play '+esc(al.t)+'">'+ic('play',16)+'</button>'
 +'<button type="button" class="im-hit" data-a="album" data-id="'+al.id+'" aria-label="Open '+esc(al.t)+'"></button>'
 +'</div>'
 +'<div class="acard-meta">'
 +'<button type="button" class="t" data-a="album" data-id="'+al.id+'">'+esc(al.t)+'</button>'
 +'<span class="s">'+esc(a.name)+'</span>'
 +'<span class="g">'+al.y+' · '+esc(al.g)+'</span>'
 +'</div></div>';
}
function trackRow(al,idx,showAl){var ref=al.id+':'+idx;var tr=al.tracks[idx]||{id:'',t:'',d:'0:00'};var liked=S.likes[ref];
 var isOn=S.playing.al===al.id&&S.playing.i===idx;
 return '<div class="trow'+(isOn?' playing':'')+'" data-ref="'+ref+'" data-tid="'+esc(tr.id||'')+'" data-a="play-ref" data-ref-play="'+ref+'" role="button" tabindex="0" aria-label="Play '+esc(tr.t)+'">'
 +'<span class="n">'+(isOn&&S.playing.on?ic('pause',14):(idx<9?'0':'')+(idx+1))+'</span>'
 +'<span><span class="tt">'+esc(tr.t)+'</span>'+(showAl?'<span class="ta"> — '+esc(artist(al.a).name)+'</span>':'')+'</span>'
 +'<span class="acts" onclick="event.stopPropagation()">'
 +'<button class="ibtn" style="width:32px;height:32px" data-a="play-ref" data-ref="'+ref+'" aria-label="Play">'+ic(isOn&&S.playing.on?'pause':'play',15)+'</button>'
 +'<button class="ibtn" style="width:32px;height:32px" data-a="like" data-ref="'+ref+'" aria-label="Save">'+ic(liked?'heartF':'heart',15)+'</button>'
 +'<button class="ibtn" style="width:32px;height:32px" data-a="queue-add" data-ref="'+ref+'" aria-label="Queue">'+ic('queue',15)+'</button>'
 +'</span><span class="d">'+tr.d+'</span></div>';}
function railHead(idx,t,act){return '<div class="sec-t"><div><span class="idx">'+idx+'</span><h2>'+t+'</h2></div>'+(act||'')+'</div>';}
function footerHTML(){
 return '<div class="wrap"><div class="f-word">SONORA<em>.</em></div>'
 +'<div class="f-grid"><div><h4>Listen</h4><button data-a="nav" data-p="discover">Discover</button><button data-a="nav" data-p="music">Music</button><button data-a="nav" data-p="charts">Charts</button><button data-a="nav" data-p="playlists">Playlists</button></div>'
 +'<div><h4>Explore</h4><button data-a="nav" data-p="artists">Artists</button><button data-a="nav" data-p="history">History of sound</button><button data-a="nav" data-p="about">About</button></div>'
 +'<div><h4>You</h4><button data-a="nav" data-p="library">Library</button><button data-a="nav" data-p="stats">Listening stats</button><button data-a="reset-app">Reset app</button></div></div>'
 +'<div class="f-bot"><span>© 2026 SONORA — self-hosted music player. Your library &amp; stats stay on this device.</span><span>Listen deeper.</span></div></div>';}
/* PAGES */
function pgHome(){
 /* hero = most recent album in the manifest (real tags, real cover) */
 var hero=ALBUMS.slice().sort(function(a,b){return (b.y||0)-(a.y||0);})[0]||null;
 var heroImg=hero?coverFor(hero,hero.tracks&&hero.tracks[0]):IMG.ORB;
 var heroTitle=hero?hero.t:'Your library';
 var heroSub=hero?(artist(hero.a).name+' — '+hero.y):'No tracks yet';
 var h='<section class="hero"><div class="bg" id="heroBg"><img src="'+heroImg+'" alt="" fetchpriority="high"></div><div class="wrap in">'
 +'<span class="mn" data-rv><span class="ac">FEATURED</span> — '+esc(heroSub.toUpperCase())+'</span>'
 +'<h1 data-rv style="--d:.08s">Listen <em>deeper.</em></h1>'
 +'<p class="sub" data-rv style="--d:.16s">Your music, played locally. Nothing tracked, nothing uploaded.</p>'
 +'<div class="ctas" data-rv style="--d:.24s">'+(hero?'<button class="btn solid" data-a="play-album" data-id="'+hero.id+'">'+ic('play',14)+' Play '+esc(hero.t)+'</button>':'')+'<button class="btn" data-a="nav" data-p="discover">Explore</button></div>'
 +'</div>'+(hero?'<div class="now"><img src="'+heroImg+'" alt="" style="width:52px;height:52px;border-radius:8px;object-fit:cover"><div style="min-width:0"><div class="mn"><span class="ac">LATEST</span></div><div style="font-weight:600;font-size:13px;margin-top:3px">'+esc(heroTitle)+'</div><div style="font-size:11.5px;color:var(--ink2)">'+esc(heroSub)+'</div></div><button class="ibtn fill" data-a="play-album" data-id="'+hero.id+'" aria-label="Play '+esc(hero.t)+'">'+ic('play',16)+'</button></div>':'')+'</section>';
 h+='<div class="tick" aria-hidden="true"><div class="tick-in">'+('<span>LISTEN DEEPER</span><span>YOUR LIBRARY · YOUR DEVICE</span><span>NO TRACKING</span><span>PRESS PLAY</span>').repeat(6)+('<span>LISTEN DEEPER</span><span>YOUR LIBRARY · YOUR DEVICE</span><span>NO TRACKING</span><span>PRESS PLAY</span>').repeat(6)+'</div></div>';
 if(!ALBUMS.length){
   h+='<section class="sec"><div class="wrap" style="text-align:center;padding:60px 0">'
   +'<p class="it" style="color:var(--ink2);font-size:18px">Your library is empty.</p>'
   +'<p class="it" style="color:var(--mut);margin-top:10px">Drop audio files into <code>audio/</code>, then run <code>python .github/scripts/add_music.py</code> — covers are extracted from the files themselves.</p>'
   +'<div style="margin-top:26px"><button class="btn" data-a="nav" data-p="about">How SONORA works</button></div></div></section>';
   return h;
 }
 h+='<section class="sec"><div class="wrap">'+railHead('01','In your library','<button class="tlink" data-a="nav" data-p="music">All music</button>');
 h+='<div class="mgrid">'+ALBUMS.slice(0,7).map(function(al,i){return albumCard(al,['c3','c3','c2','c2','c2','c3','c3'][i%7]);}).join('')+'</div></div></section>';
 var hist=(S.hist||[]).filter(function(r){var t=trackRef(r);return t&&t.t;});
 if(hist.length){
   h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('02','Recently played','<button class="tlink" data-a="nav" data-p="library">Library</button>');
   h+='<div style="border-top:1px solid var(--line)">'+hist.slice(0,5).map(function(r,i){var tr=trackRef(r);
    return '<button class="crow" data-a="play-ref" data-ref="'+r+'" data-rv><span class="rk">'+(i<9?'0':'')+(i+1)+'</span><img src="'+coverFor(tr.al,tr)+'" alt=""><span><span class="tt">'+esc(tr.t)+'</span><span class="ta" style="display:block">'+esc(artist(tr.al.a).name)+'</span></span><span class="d" style="font-family:var(--mono);font-size:10px;color:var(--mut)">'+tr.d+'</span><span class="ibtn fill" style="width:36px;height:36px">'+ic('play',14)+'</span></button>';}).join('')+'</div></div></section>';
 }
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('03','Playlists','<button class="tlink" data-a="nav" data-p="playlists">All playlists</button>');
 h+='<div class="rail">'+PLAYLISTS.map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'" data-rv><span class="im"><img src="'+p.img+'" alt="" loading="lazy"><span class="pb">'+ic('play',16)+'</span></span><span class="t">'+esc(p.t)+'</span><span class="s">'+p.tracks.length+' tracks · '+esc(p.cur)+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgDiscover(){
 /* Safe fallback — js/foryou.js normally replaces PAGES.discover with a richer build. */
 var refs=allRefs();
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">DISCOVER</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Your sound.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Everything in your library, ready to play.</p></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap">'+railHead('01','Start here');
 h+='<div class="rail">'+(refs.length?refs.slice(0,8).map(function(r){var tr=trackRef(r);return '<div class="acard sm" data-rv><button data-a="play-ref" data-ref="'+r+'" style="width:100%;text-align:left"><span class="im" style="display:block"><img src="'+coverFor(tr.al,tr)+'" alt="" loading="lazy"><span class="pb" style="opacity:1;transform:none">'+ic('play',16)+'</span></span><span class="t" style="font-size:13px">'+esc(tr.t)+'</span><span class="s">'+esc(artist(tr.al.a).name)+'</span></button></div>';}).join(''):'<p class="it" style="color:var(--mut)">Library is empty — add music files and run python .github/scripts/add_music.py.</p>')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('02','Albums');h+='<div class="rail">'+ALBUMS.map(function(al){return albumCard(al);}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('03','Artists');h+='<div class="rail">'+Object.keys(ARTISTS).slice(0,8).map(function(id){var a=ARTISTS[id];return '<button class="acard sm" data-a="artist" data-id="'+id+'" data-rv><span class="im"><img src="'+a.img+'" alt="" loading="lazy"></span><span class="t" style="font-size:13px">'+esc(a.name)+'</span><span class="s">'+esc(a.g||'—')+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgMusic(){
 var g=S.tab||'all';
 var list=ALBUMS.filter(function(a){return g==='all'||(a.g&&a.g.toLowerCase().indexOf(g)>-1);});
 /* genre chips derived from the real library */
 var gset={};ALBUMS.forEach(function(a){String(a.g||'').toLowerCase().split(/[/,]+/).forEach(function(w){w=w.trim();if(w.length>2)gset[w]=1;});});
 var chips=['all'].concat(Object.keys(gset).sort().slice(0,12));
 var sizes=['c3','c3','c2','c2','c2','c3','c3','c2','c2'];
 var h='<div class="wrap page-head" style="padding-top:110px"><span class="mn" data-rv><span class="ac">CATALOG</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px;line-height:1.1">Music</h1></div>';
 h+='<section class="sec" style="padding-top:18px"><div class="wrap"><div class="chips" style="margin-bottom:34px" data-rv>'+chips.map(function(x){return '<button class="chip '+(g===x?'on':'')+'" data-a="mfilter" data-v="'+x+'">'+x+'</button>';}).join('')+'</div>';
 h+='<div class="mgrid">'+(list.length?list.map(function(al,i){return albumCard(al,sizes[i%sizes.length]);}).join(''):'<p class="it" style="color:var(--mut)">Nothing here yet — drop files into <code>audio/</code> and run <code>python .github/scripts/add_music.py</code>.</p>')+'</div></div></section>';
 return h;
}
function pgCharts(){
 /* Real chart: plays tallied from this device's history (S.hist). */
 var counts={};(S.hist||[]).forEach(function(r){if(trackRef(r))counts[r]=(counts[r]||0)+1;});
 var rows=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">ON THIS DEVICE</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">The SONORA chart.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>What you played most, ranked by plays — counted locally.</p></div>';
 if(!rows.length){
   h+='<section class="sec" style="padding-top:26px"><div class="wrap"><p class="it" style="color:var(--mut)">No plays yet — your chart appears after you listen.</p></div></section>';
   return h;
 }
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div style="border-top:1px solid var(--line)">'+rows.map(function(r,i){var tr=trackRef(r);
  return '<button class="crow" data-a="play-ref" data-ref="'+r+'" data-rv><span class="rk">'+(i<9?'0':'')+(i+1)+'</span><span><span class="mv'+(i===0?' nw':' up')+'">'+(i===0?'TOP':'▲')+'</span></span><img src="'+coverFor(tr.al,tr)+'" alt="" loading="lazy"><span><span class="tt">'+esc(tr.t)+'</span><span class="ta" style="display:block">'+esc(artist(tr.al.a).name+' — '+tr.al.t)+'</span></span><span class="d" style="font-family:var(--mono);font-size:10px;color:var(--mut)">'+counts[r]+' plays</span><span class="ibtn fill" style="width:36px;height:36px">'+ic('play',14)+'</span></button>';}).join('')+'</div>'
 +'<p class="mn" style="margin-top:26px">METHODOLOGY — RANKED BY PLAYS ON THIS DEVICE. NO DATA LEAVES YOUR BROWSER.</p></div></section>';
 return h;
}
function pgAlbum(id){
 var al=album(id),a=artist(al.a);
 var total=al.tracks.reduce(function(x,t){return x+durS(t.d||t[1]||'0:00');},0);
 var h='<div class="wrap"><div class="al-hero"><div class="art" data-rv><img src="'+coverFor(al,al.tracks&&al.tracks[0])+'" alt="'+esc(al.t)+' artwork"></div>'
 +'<div data-rv style="--d:.1s"><span class="mn"><span class="ac">ALBUM</span> — '+al.y+'</span><h1 style="margin-top:14px">'+esc(al.t)+'</h1><div class="by">'+esc(a.name)+'</div>'
 +'<div class="chips" style="margin:22px 0"><span class="chip on" style="pointer-events:none">'+esc(al.g)+'</span><span class="chip" style="pointer-events:none">'+al.tracks.length+' tracks</span><span class="chip" style="pointer-events:none">'+fmt(total)+'</span></div>'
 +'<p style="color:var(--ink2);max-width:520px">'+esc(al.desc)+'</p>'
 +'<div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap"><button class="btn solid" data-a="play-album" data-id="'+al.id+'">'+ic('play',14)+' Play album</button><button class="btn" data-a="save-album" data-id="'+al.id+'">Save</button><button class="btn" data-a="share">'+ic('share',14)+' Share</button></div></div></div></div>';
 h+='<section class="sec" style="padding-top:20px"><div class="wrap" style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:clamp(24px,4vw,60px)" class="al-body"><div><div class="mn" style="margin-bottom:14px">TRACKLIST</div>'+al.tracks.map(function(t,i){return trackRow(al,i,false);}).join('')+'</div>'
 +'<div><div class="mn" style="margin-bottom:14px">CREDITS</div>'+[['Artist',a.name],['Album',al.t],['Year',al.y||'—'],['Genre',al.g||'—'],['Tracks',String(al.tracks.length)],['Source',al.tracks[0]&&al.tracks[0].file?al.tracks[0].file:'audio/']].map(function(c){return '<div style="display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span style="color:var(--mut)">'+c[0]+'</span><span style="text-align:right">'+esc(String(c[1]))+'</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 14px">MORE FROM '+esc(a.name).toUpperCase()+'</div><div class="rail" style="gap:12px">'+ALBUMS.filter(function(x){return x.a===al.a&&x.id!==al.id;}).map(function(x){return albumCard(x,'sm');}).join('')+'</div></div></div></section>';
 return h;
}
function pgArtists(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">ARTISTS</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">The voices.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="mgrid">'+Object.keys(ARTISTS).map(function(k,i){var a=ARTISTS[k];return '<button class="'+(i%3===0?'c3':'c2')+'" data-a="artist" data-id="'+k+'" data-rv style="text-align:left"><span style="display:block;border-radius:12px;overflow:hidden"><img src="'+a.img+'" alt="'+esc(a.name)+'" loading="lazy" style="width:100%;aspect-ratio:'+(i%3===0?'16/10':'1/1')+';object-fit:cover"></span><span style="display:block;font-family:var(--serif);font-size:clamp(20px,2.4vw,30px);margin-top:14px">'+esc(a.name)+'</span><span class="mn" style="display:block;margin-top:6px">'+esc(a.g).toUpperCase()+' — '+esc(a.loc).toUpperCase()+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgArtist(id){
 var a=artist(id);var als=ALBUMS.filter(function(x){return x.a===id;});var pops=als.length?als[0]:(ALBUMS[0]||null);
 var h='<div class="wrap"><div class="ar-hero"><div class="im" data-rv><img src="'+a.img+'" alt="'+esc(a.name)+'"></div>'
 +'<div data-rv style="--d:.1s"><span class="mn"><span class="ac">ARTIST</span></span><h1 style="margin-top:14px">'+esc(a.name)+'</h1>'
 +'<div class="mn" style="margin-top:14px">'+esc(a.g||'INDEPENDENT').toUpperCase()+(a.loc?' — '+esc(a.loc).toUpperCase():'')+'</div>'
 +(a.bio?'<p style="color:var(--ink2);margin-top:22px;max-width:520px">'+esc(a.bio)+'</p>':'')
 +'<div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap">'+(pops?'<button class="btn solid" data-a="play-album" data-id="'+pops.id+'">'+ic('play',14)+' Play</button>':'')+'<button class="btn '+(S.follows[id]?'acc':'')+'" data-a="follow" data-id="'+id+'">'+(S.follows[id]?'Following ✓':'Follow')+'</button></div></div></div></div>';
 if(als.length){
   h+='<section class="sec" style="padding-top:30px"><div class="wrap">'+railHead('01','Popular tracks');als[0].tracks.slice(0,5).forEach(function(t,i){h+=trackRow(als[0],i,false);});h+='</div></section>';
   h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('02','Discography');h+='<div class="rail">'+als.map(function(x){return albumCard(x);}).join('')+'</div></div></section>';
 }else{
   h+='<section class="sec" style="padding-top:30px"><div class="wrap"><p class="it" style="color:var(--mut)">No releases in this library yet.</p></div></section>';
 }
 if(a.sim&&a.sim.length){h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('03','Similar artists');h+='<div class="rail">'+a.sim.map(function(k){var s=artist(k);return '<button class="acard sm" data-a="artist" data-id="'+k+'" data-rv><span class="im"><img src="'+s.img+'" alt="" loading="lazy"></span><span class="t" style="font-size:13px">'+esc(s.name)+'</span><span class="s">'+esc(s.g)+'</span></button>';}).join('')+'</div></div></section>';}
 return h;
}
function pgPlaylists(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">PLAYLISTS</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Playlists.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Auto-built from your library — by genre and by everything you have.</p></div>';
 if(!PLAYLISTS.length)h+='<section class="sec" style="padding-top:30px"><div class="wrap"><p class="it" style="color:var(--mut)">No playlists yet — add music files and run <span style="font-family:var(--mono)">python .github/scripts/add_music.py</span>.</p></div></section>';
 else h+='<section class="sec" style="padding-top:30px"><div class="wrap"><div class="rail">'+PLAYLISTS.map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'" data-rv><span class="im"><img src="'+p.img+'" alt="" loading="lazy"><span class="pb">'+ic('play',16)+'</span></span><span class="t">'+esc(p.t)+'</span><span class="s">'+p.tracks.length+' tracks</span><span class="g">'+esc(p.d||'From your library')+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgPlaylist(id){
 var p=playlist(id);var total=p.tracks.reduce(function(x,r){return x+durS(trackRef(r).d);},0);
 var h='<div class="wrap" style="padding-top:100px"><div class="al-hero" style="min-height:auto"><div class="art" data-rv style="max-width:340px"><img src="'+p.img+'" alt=""></div><div data-rv style="--d:.1s"><span class="mn"><span class="ac">PLAYLIST</span> — CURATED BY '+esc(p.cur).toUpperCase()+'</span><h1 style="font-size:clamp(34px,4.6vw,64px);margin-top:14px">'+esc(p.t)+'</h1><p class="it" style="color:var(--ink2);margin-top:12px">'+esc(p.d)+'</p><div class="chips" style="margin:20px 0"><span class="chip" style="pointer-events:none">'+p.tracks.length+' tracks</span><span class="chip" style="pointer-events:none">'+fmt(total)+'</span></div><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn solid" data-a="play-pl" data-id="'+p.id+'">'+ic('play',14)+' Play</button><button class="btn" data-a="save-pl" data-id="'+p.id+'">'+(S.savedPl[id]?'Saved ✓':'Save')+'</button><button class="btn" data-a="share">'+ic('share',14)+' Share</button></div></div></div>'
 +'<div style="max-width:760px;margin-top:30px">'+p.tracks.map(function(r){var tr=trackRef(r);return '<div class="trow" data-ref="'+r+'"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span><span class="ta"> — '+esc(artist(tr.al.a).name)+'</span></span><span class="acts"><button class="ibtn" style="width:32px;height:32px" data-a="like" data-ref="'+r+'">'+ic(S.likes[r]?'heartF':'heart',15)+'</button></span><span class="d">'+tr.d+'</span></div>';}).join('')+'</div></div>';
 return h;
}
function pgHistory(){
 var d=HISTORY[S.decade]||HISTORY[0];
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">ARCHIVE</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">A history of sound.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="chips" style="margin-bottom:40px" data-rv>'+HISTORY.map(function(x,i){return '<button class="chip '+(S.decade===i?'on':'')+'" data-a="decade" data-v="'+i+'">'+x.y+'</button>';}).join('')+'</div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:60px" data-rv><div><div class="serif" style="font-size:clamp(60px,8vw,120px);color:var(--acc);line-height:1">'+d.y+'</div><div class="mn" style="margin:20px 0 10px">GENRES</div><div class="chips">'+d.g.map(function(x){return '<span class="chip" style="pointer-events:none">'+x+'</span>';}).join('')+'</div><div class="mn" style="margin:24px 0 8px">CULTURAL MOMENT</div><p class="it" style="color:var(--ink2);font-size:17px">'+d.m+'</p></div>'
 +'<div><div class="mn" style="margin-bottom:8px">TECHNOLOGY</div><div style="font-family:var(--serif);font-size:26px">'+d.t+'</div><p style="color:var(--ink2);margin-top:8px">'+d.a+'</p><div class="mn" style="margin:26px 0 12px">THE TECHNOLOGY OF MUSIC</div><div class="tl">'+TECH.map(function(t){return '<div class="it2"><div class="y" style="font-size:20px">'+t[0]+'</div><div style="font-weight:600;margin-top:2px">'+t[1]+'</div><div style="font-size:13px;color:var(--ink2)">'+t[2]+'</div></div>';}).join('')+'</div></div></div></div></section>';
 return h;
}
function pgAbout(){
 var nArt=Object.keys(ARTISTS).length,nAlb=ALBUMS.length,nTrk=allRefs().length;
 var h='<div class="wrap" style="padding-top:120px;max-width:900px"><span class="mn" data-rv><span class="ac">ABOUT</span></span><h1 class="serif" data-rv style="font-size:clamp(38px,5.6vw,76px);font-weight:400;margin-top:14px;line-height:1.05">Your files.<br>Your <em style="color:var(--acc)">listening.</em></h1>'
 +'<p class="it" style="color:var(--ink2);font-size:clamp(16px,2vw,20px);margin-top:26px" data-rv>SONORA is a self-hosted music player. It runs entirely in your browser, reads the audio files you put in <span style="font-family:var(--mono)">/audio/</span>, and keeps every play, like and playlist on your own device. No accounts, no tracking, no streaming service.</p></div>';
 h+='<section class="sec" style="padding-top:40px"><div class="wrap"><div class="kv" data-rv><div><div class="v">'+nAlb+'</div><div class="l">Albums in library</div></div><div><div class="v">'+nTrk+'</div><div class="l">Tracks indexed</div></div><div><div class="v">'+nArt+'</div><div class="l">Artists</div></div><div><div class="v">0</div><div class="l">Trackers, by design</div></div></div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:60px" class="princ">'
 +[['Local first','Audio, covers and metadata are read from your own files. Covers are extracted from the ID3 tags of each track.'],['Private by default','Likes, history and stats live in localStorage on this device — nothing is sent anywhere.'],['Add music with one command','Drop a file into /audio/, run <span style="font-family:var(--mono);font-size:13px">python .github/scripts/add_music.py</span>, commit. The manifest and playlists rebuild themselves.'],['No black boxes','Charts are ranked by plays on this device. What you see is what is there.']].map(function(p,i){return '<div data-rv style="--d:'+(i*.07)+'s;border-top:1px solid var(--line);padding-top:20px"><span class="mn"><span class="ac">0'+(i+1)+'</span></span><div class="serif" style="font-size:24px;margin-top:10px">'+p[0]+'</div><p style="color:var(--ink2);margin-top:8px">'+p[1]+'</p></div>';}).join('')+'</div>'
 +'<style>@media(max-width:800px){.princ{grid-template-columns:1fr!important}}</style></div></section>';
 return h;
}
function pgLibrary(){
 var t=S.libTab;
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">LIBRARY</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Your library.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="chips" style="margin-bottom:34px" data-rv>'+[['liked','Liked tracks'],['albums','Albums'],['artists','Artists'],['playlists','Playlists'],['hist','History']].map(function(x){return '<button class="chip '+(t===x[0]?'on':'')+'" data-a="libtab" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
 if(t==='liked'){var ks=Object.keys(S.likes).filter(function(k){return S.likes[k];});
  h+=ks.length?ks.map(function(r){var tr=trackRef(r);return trackRow(tr.al,tr.i,true);}).join(''):'<div style="padding:60px 0;text-align:center"><div class="mn">EMPTY</div><p class="it" style="color:var(--mut);margin-top:10px">Nothing liked yet. Tap the heart on any track.</p></div>';}
 if(t==='albums'){S.savedAlb=S.savedAlb||{};var aks=Object.keys(S.savedAlb).filter(function(k){return S.savedAlb[k];});
  h+=aks.length?'<div class="mgrid">'+aks.map(function(id,i){return albumCard(album(id),i%2?'c2':'c3');}).join('')+'</div>':'<div style="padding:60px 0;text-align:center"><div class="mn">EMPTY</div><p class="it" style="color:var(--mut);margin-top:10px">Save an album from its page to see it here.</p></div>';}
 if(t==='artists'){var keys=Object.keys(ARTISTS).sort(function(a,b){return (S.follows[b]?1:0)-(S.follows[a]?1:0);});
  h+='<div class="rail">'+keys.map(function(k){var a=ARTISTS[k];return '<button class="acard sm" data-a="artist" data-id="'+k+'"><span class="im" style="border-radius:50%"><img src="'+a.img+'" alt="" loading="lazy"></span><span class="t" style="font-size:13px">'+esc(a.name)+'</span><span class="s">'+(S.follows[k]?'Following':'Artist')+'</span></button>';}).join('')+'</div>';}
 if(t==='playlists'){h+='<div class="rail">'+(Object.keys(S.savedPl).length?PLAYLISTS.filter(function(p){return S.savedPl[p.id];}).map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'"><span class="im"><img src="'+p.img+'" alt=""></span><span class="t">'+esc(p.t)+'</span></button>';}).join(''):'<p class="it" style="color:var(--mut)">No saved playlists yet.</p>')+'</div>';}
 if(t==='hist'){h+=S.hist.length?S.hist.slice(0,10).map(function(r){var tr=trackRef(r);return '<div class="trow" data-ref="'+r+'"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span><span class="ta"> — '+esc(artist(tr.al.a).name)+'</span></span><span></span><span class="d">'+tr.d+'</span></div>';}).join(''):'<p class="it" style="color:var(--mut)">No history yet.</p>';}
 h+='</div></section>';
 return h;
}
function pgStats(){
 var counts={},gcounts={},tot=0;
 S.hist.forEach(function(r){var tr=trackRef(r);if(!tr||!tr.al)return;counts[tr.al.a]=(counts[tr.al.a]||0)+1;tot+=durS(tr.d);var g=(tr.al.g||'').split('/')[0].trim();if(g)gcounts[g]=(gcounts[g]||0)+1;});
 var top=function(m,n){return Object.keys(m).sort(function(a,b){return m[b]-m[a];}).slice(0,n);};
 var tas=top(counts,5),tgs=top(gcounts,4),likes=Object.keys(S.likes).filter(function(k){return S.likes[k];}).length;
 var maxA=tas.length?counts[tas[0]]:1,maxG=tgs.length?gcounts[tgs[0]]:1;
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">STATS</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Your listening, in numbers.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Counted from plays on this device. Nothing leaves your browser.</p></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap" data-real-stats><div class="kv" data-rv><div><div class="v">'+S.hist.length+'</div><div class="l">Plays tracked</div></div><div><div class="v" style="color:var(--acc)">'+(tas.length?esc(artist(tas[0]).name):'—')+'</div><div class="l">Top artist</div></div><div><div class="v">'+fmt(tot)+'</div><div class="l">Time listened</div></div><div><div class="v">'+likes+'</div><div class="l">Liked tracks</div></div></div>';
 if(tas.length||tgs.length){
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:60px"><div data-rv><div class="mn" style="margin-bottom:16px">TOP ARTISTS</div>'+tas.map(function(k){return '<div class="bar-row"><span style="font-size:13px">'+esc(artist(k).name)+'</span><span class="b"><i data-w="'+Math.round(counts[k]/maxA*100)+'"></i></span><span class="v">'+counts[k]+'</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 16px">GENRES</div>'+tgs.map(function(k){return '<div class="bar-row"><span style="font-size:13px">'+esc(k)+'</span><span class="b"><i data-w="'+Math.round(gcounts[k]/maxG*100)+'"></i></span><span class="v">'+gcounts[k]+'</span></div>';}).join('')+'</div>'
 +'<div data-rv style="--d:.1s"><div class="mn" style="margin-bottom:16px">MOST PLAYED</div>'+tas.map(function(k,i){var n=0,ref=null;S.hist.forEach(function(r){var tr=trackRef(r);if(tr&&tr.al.a===k&&!ref){ref=tr;n++;}});return '<div class="bar-row"><span style="font-size:13px">'+(i+1)+'. '+(ref?esc(ref.t):'')+'</span><span class="b"><i data-w="'+Math.round(counts[k]/maxA*100)+'"></i></span><span class="v">'+counts[k]+'</span></div>';}).join('')+'</div></div>';
 }else{
  h+='<div style="padding:60px 0;text-align:center;margin-top:20px"><div class="mn">NO PLAYS YET</div><p class="it" style="color:var(--mut);margin-top:10px">Play a few tracks and your stats will build themselves.</p></div>';
 }
 h+='</div></section>';
 return h;
}
/* RENDER */
var PAGES={home:pgHome,discover:pgDiscover,music:pgMusic,charts:pgCharts,album:pgAlbum,artists:pgArtists,artist:pgArtist,playlists:pgPlaylists,playlist:pgPlaylist,history:pgHistory,about:pgAbout,library:pgLibrary,stats:pgStats};
function nav(p,param){S.page=p;S.param=param||null;closeSearch();render();}
function render(){
 renderNav();renderMnav();
 var fn=PAGES[S.page]||pgHome;
 $('#view').innerHTML='<div style="animation:fadeUp .4s ease">'+fn(S.param)+'</div>';
 $('#foot').innerHTML=footerHTML();
 bindReveal();mountBars();syncPlayingRows();
 window.scrollTo(0,0);
}
function renderNav(){
 var links=[['discover','Discover'],['music','Music'],['artists','Artists'],['charts','Charts'],['history','History']];
 $('#nav').innerHTML='<button class="brand" data-a="nav" data-p="home"><i></i>SONORA</button><nav class="nav-c">'+links.map(function(l){return '<button class="'+(S.page===l[0]?'on':'')+'" data-a="nav" data-p="'+l[0]+'">'+l[1]+'</button>';}).join('')+'</nav><div class="nav-r"><button class="ib" data-a="search" aria-label="Search">'+ic('search',17)+'</button><button class="txt" data-a="nav" data-p="library">Library</button><button class="ib" data-a="nav" data-p="stats" aria-label="Profile">'+ic('user',17)+'</button></div>';
}
function renderMnav(){
 $('#mnav').innerHTML=[['home','home','Home'],['search','search','Search'],['library','lib','Library'],['stats','user','Profile']].map(function(x){return '<button class="'+(S.page===x[0]?'on':'')+'" data-a="'+(x[0]==='search'?'search':'nav')+'" data-p="'+x[0]+'">'+ic(x[1],18)+x[2]+'</button>';}).join('');
}
var io=null;
function bindReveal(){
 var els=$$('[data-rv]:not(.in)');
 if(RM||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
 if(!io)io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:.1});
 els.forEach(function(e){io.observe(e);});
}
function mountBars(){$$('.bar-row .b i[data-w]').forEach(function(el){setTimeout(function(){el.style.width=el.getAttribute('data-w')+'%';},120);});}
addEventListener('scroll',function(){
 $('#nav').classList.toggle('scrolled',scrollY>30);
 var doc=document.documentElement;
 $('#pbar i').style.transform='scaleX('+(scrollY/Math.max(1,doc.scrollHeight-innerHeight))+')';
 var hb=$('#heroBg');if(hb&&!RM)hb.style.transform='translateY('+(scrollY*0.18)+'px)';
},{passive:true});
/* MINI */
function renderMini(){
 var nt=nowTrack();var m=$('#mini');
 if(!nt){m.classList.remove('on');return;}
 var a=artist(nt.al.a);
 m.classList.add('on');
 m.innerHTML='<div class="bar" id="miniProg" title="Seek"><i id="miniBar" style="width:'+(S.playing.t/durS(nt.d)*100)+'%"></i></div><div class="in">'
 +'<div class="art" data-a="player-open"><img src="'+coverFor(nt.al,nt)+'" alt=""></div>'
 +'<div class="inf" data-a="player-open"><div class="tt">'+esc(nt.t)+'</div><div class="ta">'+esc(a.name)+'</div></div>'
 +'<div class="c"><button class="ibtn xtra" style="border:none" data-a="like" data-ref="'+S.playing.al+':'+S.playing.i+'" aria-label="Save">'+ic(S.likes[S.playing.al+':'+S.playing.i]?'heartF':'heart',18)+'</button>'
 +'<button class="ibtn xtra" data-a="mute" aria-label="Mute" style="border:none;opacity:'+(S.muted?1:0.7)+'">'+(S.muted?'🔇':'🔊')+'</button>'
 +'<button class="ibtn" data-a="prev" aria-label="Previous" style="border:none">'+ic('prev',18)+'</button>'
 +'<button class="ibtn fill" data-a="toggle" aria-label="Play/Pause">'+ic(S.playing.on?'pause':'play',18)+'</button>'
 +'<button class="ibtn" data-a="next" aria-label="Next" style="border:none">'+ic('next',18)+'</button>'
 +'<button class="ibtn xtra" data-a="shuffle" aria-label="Shuffle" style="border:none;color:'+(S.shuffle?'var(--acc)':'inherit')+'">⇄</button>'
 +'<button class="ibtn xtra" data-a="player-open" aria-label="Expand" style="border:none">'+ic('up',18)+'</button></div></div>';
 setTimeout(function(){bindSeekBars();bindVolTrack();},40);
}
/* FULL PLAYER */
var waveRaf=0;
// seek bars rebound after mini/player paint

function renderPlayerIfOpen(){if($('#player').classList.contains('open'))openPlayer();}
function openPlayer(){
 var nt=nowTrack();
 if(!nt){var r=firstRef();if(!r){toast('Library is empty — add music files and run python .github/scripts/add_music.py');return;}playRef(r);nt=nowTrack();if(!nt)return;}
 var a=artist(nt.al.a);var P=$('#player');
 P.classList.add('open');P.classList.toggle('playing',S.playing.on);
 if(S.ptab!=='queue'&&S.ptab!=='credits')S.ptab='queue';
 var tabs=['queue','credits'];
 P.innerHTML='<div class="pbg"><img src="'+coverFor(nt.al,nt)+'" alt=""></div><div class="pin">'
 +'<div class="top"><button class="ibtn" style="border:none" data-a="player-close" aria-label="Close">'+ic('down',20)+'</button><span class="mn">NOW PLAYING — '+esc(nt.al.t).toUpperCase()+'</span><button class="ibtn '+(S.ambient?'fill':'')+'" style="'+(S.ambient?'':'border:none')+'" data-a="ambient" aria-label="Ambient mode">'+ic('glow',18)+'</button><button class="ibtn" id="eqBtn" data-a="eq-toggle" title="Equalizer (E)" aria-label="Equalizer" aria-pressed="'+(window.EQ&&EQ.isOpen&&EQ.isOpen()?'true':'false')+'" style="border:none'+(window.EQ&&EQ.isOpen&&EQ.isOpen()?';color:var(--acc)':'')+'">'+ic('sliders',18)+'</button></div>'
 +'<div class="mid"><div class="art"><img src="'+coverFor(nt.al,nt)+'" alt="'+esc(nt.al.t)+' artwork"></div>'
 +'<div><div class="tt">'+esc(nt.t)+'</div><div class="ta">'+esc(a.name)+'</div></div>'
 +'<div style="width:100%"><canvas id="wave" height="56"></canvas><div class="times"><span id="pCur">'+fmt(Math.floor(S.playing.t||0))+'</span><span id="pDur">'+nt.d+'</span></div><div id="pProg" title="Seek" style="height:4px;background:var(--line);border-radius:3px;margin-top:8px;cursor:pointer"><div id="pBar" style="height:100%;background:var(--acc);width:'+(S.playing.t/durS(nt.d)*100)+'%;border-radius:3px"></div></div></div>'
 +'<div class="ctrl">'
 +'<button class="ibtn" style="border:none;color:'+(S.shuffle?'var(--acc)':'inherit')+'" data-a="shuffle" title="Shuffle (S)">⇄</button>'
 +'<button class="ibtn" style="border:none" data-a="like" data-ref="'+S.playing.al+':'+S.playing.i+'">'+ic(S.likes[S.playing.al+':'+S.playing.i]?'heartF':'heart',20)+'</button>'
 +'<button class="ibtn" style="border:none;width:52px;height:52px" data-a="prev">'+ic('prev',22)+'</button>'
 +'<button class="ibtn fill" style="width:64px;height:64px" data-a="toggle">'+ic(S.playing.on?'pause':'play',24)+'</button>'
 +'<button class="ibtn" style="border:none;width:52px;height:52px" data-a="next">'+ic('next',22)+'</button>'
 +'<button class="ibtn" style="border:none" data-a="queue-add" data-ref="'+S.playing.al+':'+S.playing.i+'">'+ic('queue',20)+'</button>'
 +'<button class="ibtn" style="border:none;color:'+(S.repeat!=='off'?'var(--acc)':'inherit')+'" data-a="repeat" title="Repeat (R)">'+(S.repeat==='one'?'🔂':'🔁')+'</button>'
 +'<button class="ibtn" style="border:none" data-a="mute" title="Mute (M)">'+(S.muted?'🔇':'🔊')+'</button></div>'
 +'<div class="vol-row" style="display:flex;align-items:center;gap:10px;max-width:280px;margin:14px auto 0;width:100%"><button class="ibtn" style="border:none;width:32px;height:32px" data-a="vol-dn" aria-label="Volume down">−</button>'
 +'<div id="volTrack" style="flex:1;height:4px;background:var(--line);border-radius:4px;cursor:pointer;position:relative"><i id="volBar" style="display:block;height:100%;width:'+(S.muted?0:S.volume*100)+'%;background:var(--acc);border-radius:4px"></i></div>'
 +'<button class="ibtn" style="border:none;width:32px;height:32px" data-a="vol-up" aria-label="Volume up">+</button>'
 +'<span class="mn" style="min-width:36px;text-align:right">'+(S.muted?0:Math.round(S.volume*100))+'%</span></div>'
 +'<div class="mn" style="text-align:center;margin-top:10px">SLEEP — <button class="chip" style="padding:4px 10px;font-size:10px" data-a="sleep" data-v="0">OFF</button> <button class="chip" style="padding:4px 10px;font-size:10px" data-a="sleep" data-v="900">15M</button> <button class="chip" style="padding:4px 10px;font-size:10px" data-a="sleep" data-v="3600">1H</button></div></div>'
 +'<div class="tabs">'+tabs.map(function(t){return '<button class="'+(S.ptab===t?'on':'')+'" data-a="ptab" data-v="'+t+'">'+t+'</button>';}).join('')+'</div>'
 +'<div class="tabbody" id="ptabBody">'+ptabHTML()+'</div></div>'
 +'<div id="eqPanel" hidden aria-label="Equalizer panel"></div>';
 if(window.EQ&&EQ.mount)EQ.mount($('#eqPanel'));
 startWave();setTimeout(function(){bindSeekBars();bindVolTrack();},80);
}
function ptabHTML(){
 if(S.ptab==='lyrics')S.ptab='queue';
 if(S.ptab==='queue'){var nt=nowTrack();
  if(!nt)return '<p class="it" style="color:var(--mut)">Nothing playing.</p>';
  var up=nt.al.tracks.slice(S.playing.i+1,S.playing.i+6);
  var h='<div class="mn" style="margin-bottom:10px">UP NEXT — '+esc(nt.al.t).toUpperCase()+'</div>';
  if(!up.length) h+='<p class="it" style="color:var(--mut);margin-bottom:12px">End of album'+(S.repeat==='all'?' — will restart':'')+'.</p>';
  else h+=up.map(function(t,i){var idx=S.playing.i+1+i;var ref=nt.al.id+':'+idx;return '<div class="trow" data-a="play-ref" data-ref="'+ref+'" role="button" tabindex="0"><span class="n">'+(idx+1<10?'0':'')+(idx+1)+'</span><span><span class="tt">'+esc(t.t||'')+'</span></span><span></span><span class="d">'+(t.d||'')+'</span></div>';}).join('');
  if(S.queue.length){h+='<div class="mn" style="margin:14px 0 10px">FROM QUEUE</div>'+S.queue.map(function(r,i){var tr=trackRef(r);return '<div class="trow" data-a="play-ref" data-ref="'+r+'" role="button"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span></span><span class="acts" style="opacity:1"><button class="ibtn" style="width:30px;height:30px" data-a="queue-rm" data-i="'+i+'" aria-label="Remove" onclick="event.stopPropagation()">'+ic('x',13)+'</button></span><span class="d">'+tr.d+'</span></div>';}).join('');}
  else h+='<p class="it" style="color:var(--mut);margin-top:10px">Queue is empty — add tracks with the queue button.</p>';
  return h;}
 var ct=nowTrack();
 if(!ct)return '<p class="it" style="color:var(--mut)">Nothing playing.</p>';
 var al=ct.al;var aa=artist(al.a);
 var src=(al.tracks[0]&&al.tracks[0].file)?al.tracks[0].file:'audio/';
 return '<div class="mn" style="margin-bottom:10px">CREDITS</div>'+[['Artist',aa.name],['Album',al.t],['Year',al.y||'—'],['Genre',al.g||'—'],['Tracks',String(al.tracks.length)],['Source',src]].map(function(c){return '<div style="display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span style="color:var(--mut)">'+c[0]+'</span><span style="text-align:right">'+esc(String(c[1]))+'</span></div>';}).join('');
}
function closePlayer(){$('#player').classList.remove('open');cancelAnimationFrame(waveRaf);}
function startWave(){
 cancelAnimationFrame(waveRaf);
 var cv=$('#wave');if(!cv)return;
 var dpr=Math.min(2,devicePixelRatio||1);
 var r0=cv.getBoundingClientRect();cv.width=r0.width*dpr;cv.height=56*dpr;cv.getContext('2d').scale(dpr,dpr);
 var analyser=null,adata=null;
 function draw(now){
  var ctx=cv.getContext('2d');var w=cv.width/dpr,h=56;
  ctx.clearRect(0,0,w,h);
  var nt=nowTrack();var prog=nt?S.playing.t/durS(nt.d):0;
  var acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#D9A441';
  ctx.lineWidth=1.4;
  function path(){
    if(!analyser&&window.EQ&&EQ.analyser){try{analyser=EQ.analyser;adata=new Uint8Array(analyser.frequencyBinCount);}catch(e){analyser=null;}}
    ctx.beginPath();
    if(analyser&&adata){
      /* live waveform from the EQ analyser (Web Audio) */
      analyser.getByteTimeDomainData(adata);
      var n=adata.length;
      for(var xa=0;xa<=w;xa+=3){
        var v=(adata[Math.min(n-1,Math.floor(xa/w*n))]-128)/128;
        var ya=h/2+v*(h*0.46);
        if(xa===0)ctx.moveTo(xa,ya);else ctx.lineTo(xa,ya);
      }
      return;
    }
    /* fallback fake wave — AudioContext not started yet (no user gesture) */
    for(var x=0;x<=w;x+=3){var p=x/w;var amp=(Math.sin(p*9+(S.playing.on?now/900:0))*0.5+Math.sin(p*23-(S.playing.on?now/1400:0))*0.3+Math.sin(p*47)*0.2);var env=0.35+0.65*Math.sin(p*Math.PI);var y=h/2+amp*env*(h*0.36)*(S.playing.on?1:0.5);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}}
  path();ctx.strokeStyle='rgba(242,238,230,.18)';ctx.stroke();
  ctx.save();ctx.beginPath();ctx.rect(0,0,w*prog,h);ctx.clip();path();ctx.strokeStyle=acc;ctx.stroke();ctx.restore();
  waveRaf=requestAnimationFrame(draw);
 }
 waveRaf=requestAnimationFrame(draw);
}
/* SEARCH */
function openSearch(){
 var ov=$('#searchOv');ov.classList.add('open');
 ov.innerHTML='<div class="in"><div style="display:flex;justify-content:space-between;align-items:center"><span class="mn"><span class="ac">SEARCH</span> — ⌘K</span><button class="ibtn" data-a="search-close" aria-label="Close">'+ic('x',18)+'</button></div><input id="sIn" placeholder="Artists, albums, tracks…" autocomplete="off"><div id="sBody"></div></div>';
 setTimeout(function(){$('#sIn').focus();},80);
 sRender('');
 $('#sIn').addEventListener('input',function(e){sRender(e.target.value);});
}
function closeSearch(){$('#searchOv').classList.remove('open');}
function sRender(q){
 q=(q||'').toLowerCase();
 var B=$('#sBody');if(!B)return;
 if(!q){
  var sugg=[];Object.keys(ARTISTS).slice(0,3).forEach(function(k){sugg.push(ARTISTS[k].name);});ALBUMS.slice(0,3).forEach(function(al){if(al.g)sugg.push(al.g.split('/')[0].trim());});
  sugg=sugg.filter(function(v,i,x){return v&&x.indexOf(v)===i;}).slice(0,5);
  B.innerHTML=(S.recents.length?'<div class="sres-g">Recent</div>'+S.recents.map(function(r){return '<button class="sres-i" data-a="s-set" data-v="'+r+'"><span style="color:var(--mut)">'+ic('clock',16)+'</span><span><span class="t">'+r+'</span></span></button>';}).join(''):'')
  +(sugg.length?'<div class="sres-g">Suggested</div>'+sugg.map(function(r){return '<button class="sres-i" data-a="s-set" data-v="'+r+'"><span style="color:var(--acc)">'+ic('wave',16)+'</span><span><span class="t">'+r+'</span></span></button>';}).join(''):'')
  ||'<p class="it" style="color:var(--mut);padding:30px 0">Your library is empty — add music files and run python .github/scripts/add_music.py.</p>';
  return;
 }
 var res={Artists:[],Albums:[],Tracks:[],Playlists:[]};
 Object.keys(ARTISTS).forEach(function(k){var a=ARTISTS[k];if((a.name+a.g).toLowerCase().indexOf(q)>-1)res.Artists.push({t:a.name,s:a.g,img:a.img,go:function(){nav('artist',k);}});});
 ALBUMS.forEach(function(al){if((al.t+al.g).toLowerCase().indexOf(q)>-1)res.Albums.push({t:al.t,s:artist(al.a).name,img:al.img,go:function(){nav('album',al.id);}});
  al.tracks.forEach(function(tr,i){if((tr.t||'').toLowerCase().indexOf(q)>-1)res.Tracks.push({t:tr.t,s:artist(al.a).name+' — '+al.t,img:al.img,go:function(){play(al.id,i);}});});});
 PLAYLISTS.forEach(function(p){if(p.t.toLowerCase().indexOf(q)>-1)res.Playlists.push({t:p.t,s:p.cur,img:p.img,go:function(){nav('playlist',p.id);}});});
 var top=res.Artists[0]||res.Albums[0]||res.Tracks[0];
 var h=top?'<div class="sres-g">Top result</div><button class="sres-i" data-a="s-top" style="border:1px solid var(--line2);border-radius:14px;padding:16px"><img src="'+top.img+'" style="width:64px;height:64px"><span><span class="t" style="font-size:18px">'+esc(top.t)+'</span><span class="s">'+esc(top.s)+'</span></span><span style="margin-left:auto" class="ibtn fill">'+ic('play',16)+'</span></button>':'';
 Object.keys(res).forEach(function(g){if(res[g].length){h+='<div class="sres-g">'+g+'</div>'+res[g].slice(0,4).map(function(r,i){return '<button class="sres-i" data-a="s-go" data-g="'+g+'" data-i="'+i+'"><img src="'+r.img+'"><span><span class="t">'+esc(r.t)+'</span><span class="s">'+esc(r.s)+'</span></span></button>';}).join('');}});
 window._sres=res;
 B.innerHTML=h||'<p class="it" style="color:var(--mut);padding:30px 0">Nothing found for “'+esc(q)+'”.</p>';
}
/* MODAL */
function openModal(html){$('#modal').classList.add('open');$('#modal').innerHTML='<div class="box">'+html+'</div>';}
function closeModal(){$('#modal').classList.remove('open');}
/* INTRO */
(function(){
 if(RM)return;
 var w='SONORA';var el=$('#introW');
 el.innerHTML=w.split('').map(function(c,i){return '<span style="animation-delay:'+(i*0.06)+'s">'+c+'</span>';}).join('');
 var go=function(){$('#intro').classList.add('gone');};
 $('#intro').addEventListener('click',go);
 setTimeout(go,2100);
})();
/* EVENTS */
document.addEventListener('click',function(e){
 var t=e.target.closest('[data-a]');
 if(!t)return;
 var a=t.getAttribute('data-a');
 switch(a){
  case 'nav':nav(t.getAttribute('data-p'),t.getAttribute('data-id'));break;
  case 'album':nav('album',t.getAttribute('data-id'));break;
  case 'artist':nav('artist',t.getAttribute('data-id'));break;
  case 'playlist':nav('playlist',t.getAttribute('data-id'));break;
  case 'play-album':play(t.getAttribute('data-id'),0);toast('Playing — '+album(t.getAttribute('data-id')).t);break;
  case 'play-pl':var p=playlist(t.getAttribute('data-id'));S.queue=p.tracks.slice(1);playRef(p.tracks[0]);toast('Playing — '+p.t);break;
  case 'play-pl-list':var rs=t.getAttribute('data-refs').split(',');S.queue=rs.slice(1);playRef(rs[0]);toast('Playing your selection');break;
  case 'play-ref':{
    var r=t.getAttribute('data-ref')||t.getAttribute('data-ref-play')||(t.closest('[data-ref]')&&t.closest('[data-ref]').getAttribute('data-ref'));
    if(!r)break;
    if(S.playing.al+':'+S.playing.i===r){togglePlay();}
    else playRef(r);
    break;}
  case 'toggle':togglePlay();break;
  case 'next':nextTrack();break;
  case 'prev':prevTrack();break;
  case 'player-open':openPlayer();break;
  case 'player-close':closePlayer();break;
  case 'ambient':S.ambient=!S.ambient;saveState();renderPlayerIfOpen();toast(S.ambient?'Ambient mode on':'Ambient mode off');break;
  case 'sleep':S.sleep=+t.getAttribute('data-v');toast(S.sleep?'Sleep timer set':'Sleep timer off');break;
  case 'ptab':S.ptab=t.getAttribute('data-v');$('#ptabBody').innerHTML=ptabHTML();$$('#player .tabs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-v')===S.ptab);});saveState();break;
  case 'like':var ref=t.getAttribute('data-ref');S.likes[ref]=!S.likes[ref];savePersist();toast(S.likes[ref]?'Saved to liked tracks':'Removed from liked tracks');renderMini();renderPlayerIfOpen();syncHearts(ref);if(S.page==='library')render();break;
  case 'queue-add':S.queue.push(t.getAttribute('data-ref'));toast('Added to queue');break;
  case 'queue-rm':S.queue.splice(+t.getAttribute('data-i'),1);$('#ptabBody').innerHTML=ptabHTML();toast('Removed from queue');break;
  case 'follow':S.follows[t.getAttribute('data-id')]=!S.follows[t.getAttribute('data-id')];savePersist();toast(S.follows[t.getAttribute('data-id')]?'Following':'Unfollowed');render();break;
  case 'save-album':{
    var aid=t.getAttribute('data-id')||S.param||(S.playing&&S.playing.al);
    if(!aid){toast('Nothing to save');break;}
    S.savedAlb=S.savedAlb||{};
    S.savedAlb[aid]=!S.savedAlb[aid];
    savePersist();
    toast(S.savedAlb[aid]?'Album saved to library':'Removed from library');
    break;}
  case 'save-pl':S.savedPl[t.getAttribute('data-id')]=!S.savedPl[t.getAttribute('data-id')];savePersist();toast(S.savedPl[t.getAttribute('data-id')]?'Playlist saved':'Removed');render();break;
  case 'share':if(window.SONORA_SHARE&&SONORA_SHARE.open)SONORA_SHARE.open();else{try{navigator.clipboard.writeText(location.href);toast('Link copied');}catch(e){toast(location.href);}}break;
  case 'search':openSearch();break;
  case 'search-close':closeSearch();break;
  case 's-set':$('#sIn').value=t.getAttribute('data-v');sRender(t.getAttribute('data-v'));break;
  case 's-go':var g=t.getAttribute('data-g'),i=+t.getAttribute('data-i');closeSearch();window._sres[g][i].go();break;
  case 's-top':var top=(window._sres.Artists[0]||window._sres.Albums[0]||window._sres.Tracks[0]);closeSearch();if(top)top.go();break;
  case 'mfilter':S.tab=t.getAttribute('data-v');render();break;
  case 'decade':S.decade=+t.getAttribute('data-v');saveState();render();break;
  case 'libtab':S.libTab=t.getAttribute('data-v');saveState();render();break;
  case 'mclose':closeModal();break;
  case 'mute':toggleMute();break;
  case 'vol-up':setVolume(S.volume+0.1);toast('Volume '+Math.round(S.volume*100)+'%');break;
  case 'vol-dn':setVolume(S.volume-0.1);toast('Volume '+Math.round(S.volume*100)+'%');break;
  case 'shuffle':toggleShuffle();break;
  case 'repeat':cycleRepeat();break;
  case 'shortcuts':shortcutsHelp();break;
  case 'eq-toggle':
    if(window.EQ&&EQ.toggle)EQ.toggle();
    (function(){var eb=$('#eqBtn');if(eb)eb.setAttribute('aria-pressed',(window.EQ&&EQ.isOpen&&EQ.isOpen())?'true':'false');
      if(eb)eb.style.color=(window.EQ&&EQ.isOpen&&EQ.isOpen())?'var(--acc)':'';})();
    break;
  case 'reset-app':
    if(confirm('Reset SONORA? This clears likes, library, history, EQ presets and player state.')){clearState();location.reload();}
    break;
  case 'like-current':likeCurrent();break;
  case 'toast':toast(t.getAttribute('data-msg'));break;
 }
});
function syncHearts(ref){$$('[data-a="like"][data-ref="'+ref+'"]').forEach(function(b){b.innerHTML=ic(S.likes[ref]?'heartF':'heart',b.closest('#player')?20:15);});}
document.addEventListener('keydown',function(e){
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();return;}
 if(e.key==='Escape'){closeSearch();closeModal();closePlayer();return;}
 var tag=(document.activeElement&&document.activeElement.tagName)||'';
 if(/INPUT|TEXTAREA|SELECT/.test(tag))return;
 // Focused track row
 if((e.key==='Enter')&&document.activeElement&&document.activeElement.classList.contains('trow')){
  e.preventDefault();var ref=document.activeElement.getAttribute('data-ref');if(ref){if(S.playing.al+':'+S.playing.i===ref)togglePlay();else playRef(ref);}return;}
 var key=e.key;var code=e.code;
 // Play / pause
 if(code==='Space'||key==='k'||key==='K'){
  if($('#searchOv')&&$('#searchOv').classList.contains('open'))return;
  e.preventDefault();togglePlay();return;
 }
 // Seek
 if(key==='ArrowRight'){e.preventDefault();seek(e.shiftKey?30:10);return;}
 if(key==='ArrowLeft'){e.preventDefault();seek(e.shiftKey?-30:-10);return;}
 // Volume
 if(key==='ArrowUp'){e.preventDefault();setVolume((S.muted?0:S.volume)+0.05);if(S.muted){S.muted=false;audioEl.volume=S.volume;saveState();}toast('Volume '+Math.round(S.volume*100)+'%');return;}
 if(key==='ArrowDown'){e.preventDefault();setVolume((S.muted?0:S.volume)-0.05);toast('Volume '+Math.round(S.volume*100)+'%');return;}
 if(key==='m'||key==='M'){e.preventDefault();toggleMute();return;}
 // Next / prev
 if(key==='n'||key==='N'||(code==='MediaTrackNext')){e.preventDefault();nextTrack(false);return;}
 if(key==='p'||key==='P'||(code==='MediaTrackPrevious')){e.preventDefault();prevTrack();return;}
 if(code==='MediaPlayPause'){e.preventDefault();togglePlay();return;}
 // Like / shuffle / repeat
 if(key==='l'||key==='L'){e.preventDefault();likeCurrent();return;}
 if(key==='s'||key==='S'){e.preventDefault();toggleShuffle();return;}
 if(key==='r'||key==='R'){e.preventDefault();cycleRepeat();return;}
 // EQ panel / bypass
 if(key==='e'||key==='E'){
  if(!window.EQ)return;
  e.preventDefault();
  if(e.shiftKey){EQ.setEnabled(!EQ.enabled);saveState();toast('EQ '+(EQ.enabled?'enabled':'bypassed'));}
  else EQ.toggle();
  return;
 }
 // Full player
 if(key==='f'||key==='F'){e.preventDefault();if($('#player').classList.contains('open'))closePlayer();else openPlayer();return;}
 // Help
 if(key==='?'||(e.shiftKey&&key==='/')){e.preventDefault();shortcutsHelp();return;}
 // Jump 0-9 → 0%..90%
 if(key>='0'&&key<='9'){e.preventDefault();seekToRatio(parseInt(key,10)/10);return;}
});
$('#modal').addEventListener('click',function(e){if(e.target.id==='modal')closeModal();});
/* EQ needs an AudioContext — browsers only allow one inside a user gesture */
(function(){
 var evs=['pointerdown','keydown','touchend'];
 function eqBoot(){
  try{if(window.EQ&&EQ.init)EQ.init(audioEl);}catch(e){}
  for(var i=0;i<evs.length;i++)document.removeEventListener(evs[i],eqBoot);
 }
 for(var i=0;i<evs.length;i++)document.addEventListener(evs[i],eqBoot,{once:true});
})();
if(window.EQ){EQ.onChange=function(){saveState();};}
loadManifest();
render();
renderMini(); /* show restored (paused) track from sonora-state-v2 */
