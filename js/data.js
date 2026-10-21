/* =========================================================
   HOW TO ADD MUSIC
   1) Drop an .mp3 into /audio/
   2) Add ONE line to audio/manifest.json (see format below)
   3) That's it — the app auto-loads it. No code editing needed.
   =========================================================

   audio/manifest.json format (strict JSON — notes live in
   "_readme" keys so JSON.parse() keeps working):

   {
     "_readme": "Each entry of 'tracks' is one song. Keys: id, file, title, artist, album are required; year, genre, duration, cover are optional.",
     "tracks": [
       {
         "id": "my-song-01",
         "file": "audio/my-song-01.mp3",
         "title": "My Song",
         "artist": "My Artist",
         "album": "My Album",
         "year": 2026,
         "genre": "Electronic",
         "duration": "4:12",
         "cover": "audio/covers/my-song-01.jpg"
       }
     ]
   }

   "cover" is optional — if it is missing (or the file 404s) the
   app reads the ID3 tags straight from the mp3 instead
   (title, artist, album and embedded cover art).

   =========================================================
   SONORA DATA LAYER
   All demo/editorial data lives here (moved out of app.js).
   Edit music data HERE — app.js only contains logic.
   Everything is a plain global (var / function) so app.js keeps
   working unchanged, and is collected on window.SONORA_DATA.
   ========================================================= */

'use strict';
var IMG={
 MS:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/147639a71-e3bc-4299-9eaa-a7279ef3de25.png',
 AUR:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1417b83c9-652f-443f-a2fb-195136014c66.png',
 NIA:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/10c18961c-4582-407f-bc8f-c64fdb2789db.png',
 SORA:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/17e2fbb34-75b9-4735-a09d-a28c88cce1ed.png',
 KAIRO:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/11d03f9b0-a533-4e4f-b2dd-110c1a956ebc.png',
 MILO:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/11af33997-8f15-4fab-bf0a-f0282d4541f4.png',
 ELIAS:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/10ecba782-6b45-4188-b1b9-6ce4f7cd92e5.png',
 VERA:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/17018636f-fa3c-42dc-9822-a7821cab8eda.png',
 PC:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1984af3f8-9a91-4c86-a16d-c1ef0092354d.png',
 WS:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1fd2bc5ad-93df-46c1-b160-101281bf121e.png',
 STUDIO:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/10f2c5870-f2d8-4784-8b99-dccd307c45f8.png',
 TOKYO:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1c6f8c521-2b2f-4834-a44f-43631c657d42.png',
 CLUB:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1cf641d6d-ebb8-4db0-8d7c-b4d8e2a290df.png',
 TAPE:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1f1b1c950-a85c-4d4e-afad-4c93a10a1b33.png',
 SESSION:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/14057731c-3857-48ad-8384-2be48252c993.png',
 ORB:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/1d6b83efe-923b-4c42-b1e3-faa994895aa9.png',
 HALL:'https://image.qwenlm.ai/public_source/f63825b7-d7f9-466e-9e7c-e54c1b0e605a/130ed182c-3e03-4bbf-80a3-fff2246ac715.png'
};
/* DATA */
var ARTISTS={};
/* Safe: an empty library must never crash the page. */
function artist(id){
  if(ARTISTS[id])return ARTISTS[id];
  return {id:id||'',name:'Unknown artist',g:'',loc:'',ac:'#D9A441',img:IMG.ORB,sim:[],bio:''};
}
var ALBUMS=[];
function album(id){
  for(var i=0;i<ALBUMS.length;i++)if(ALBUMS[i].id===id)return ALBUMS[i];
  return {id:'',t:'No album',a:'',y:0,g:'',img:IMG.ORB,desc:'',credits:{},tracks:[]};
}
function trackRef(r){
  var p=String(r||'').split(':');
  var al=album(p[0]);
  var i=+p[1]||0;
  var tr=(al.tracks&&al.tracks[i])||{id:'',t:'Unknown',d:'0:00'};
  return {al:al,i:i,id:tr.id||'',t:tr.t,d:tr.d};
}
function durS(d){var p=String(d||'0:00').split(':');return (+p[0]||0)*60+(+p[1]||0);}
var PLAYLISTS=[];
function playlist(id){
  for(var i=0;i<PLAYLISTS.length;i++)if(PLAYLISTS[i].id===id)return PLAYLISTS[i];
  return {id:'',t:'Playlist',d:'',cur:'',img:IMG.ORB,tracks:[]};
}
var STORIES=[
 {id:'st1',cat:'Culture',t:'The sound of midnight',au:'Lena Okafor',rt:'12 min',img:IMG.STUDIO,ex:'A visual story about artists who create after dark — when the city lowers its voice and the machines start listening.',quote:'Night is not the absence of day. It is a different instrument.',body:['The studio above the tram depot only makes sense after 1am. That is when Aurora Vale begins, when the last train has passed and the building stops vibrating. “I don’t fight the noise floor,” she says. “I tune to it.”','Across town, a producer keeps his monitors quiet enough that the room stays in the mix. A jazz singer records after closing time, with the glasses still on the bar. What they share is not a genre but a schedule: they work in the hours when listening becomes possible.','Midnight is not empty. It is full of small signals — fridge hum, distant doors, the city breathing. The artists in this story treat those signals as collaborators.','When the sun comes up, they stop. Not because they are tired, but because the instrument has changed.']},
 {id:'st2',cat:'Sound',t:'Why silence became part of modern music',au:'M. Duarte',rt:'8 min',img:IMG.HALL,ex:'From concert halls to ambient techno: how the quiet learned to carry a song.',quote:'Silence is not the opposite of music. It is the frame.',body:['Every room has a noise floor, and every recording decides what to do with it. This is a short history of the artists who decided to keep it.','From tape hiss left deliberately in the mix to long passages of near-nothing on modern records, silence became a material — something arranged, not avoided.','The essay traces the lineage from experimental concert music to ambient, and asks what the loudness war did to our tolerance for quiet.']},
 {id:'st3',cat:'Places',t:'Inside the underground clubs of Berlin',au:'J. Krüger',rt:'10 min',img:IMG.CLUB,ex:'Concrete, haze, and a sound system tuned like a pipe organ.',quote:'A good room doesn’t play music. It remembers it.',body:['Behind an unmarked door, a sound system that took eleven years to tune. We spent a night inside the rooms where electronic music is tested on bodies, not algorithms.','The resident engineer walks us through crossover points, ceiling reflections, and why the queue is part of the acoustics.']},
 {id:'st4',cat:'Technology',t:'The analog revival',au:'R. Feld',rt:'9 min',img:IMG.TAPE,ex:'Why a generation raised on streaming is falling for tape hiss.',quote:'Imperfection, it turns out, is information.',body:['Cassette sales are up for the fourteenth straight year. Reel-to-reel machines are being repaired, not recycled. We visit the workshops keeping the analog world alive.','The story is not nostalgia. It is about texture: the sound of a medium having a body.']},
 {id:'st5',cat:'Places',t:'The sound of Tokyo after midnight',au:'A. Hoshino',rt:'11 min',img:IMG.TOKYO,ex:'Field recordings from a city that never quite sleeps — it just whispers.',quote:'At 2am, even the vending machines sing in key.',audio:true,body:['With a pair of omni microphones and a last-train ticket, we recorded the city between stations: vending machine glow, rain on shutters, the hum of a pachinko parlor exhaling.','Throughout this article, press play on the clips. They are not illustrations. They are the article.']},
 {id:'st6',cat:'Culture',t:'How cities shape sound',au:'L. Okafor',rt:'7 min',img:IMG.PC,ex:'Lisbon reverb, Oslo restraint, Tokyo precision: geography as genre.',quote:'You can hear the street grid in the mix.',body:['Why does Lisbon music feel like dusk? Why does Oslo sound like space between buildings? A short meditation on geography as an instrument.']}
];
function story(id){for(var i=0;i<STORIES.length;i++)if(STORIES[i].id===id)return STORIES[i];return STORIES[0];}
var EVENTS=[
 {id:'ev1',t:'Aurora Vale — Midnight Signals Tour',a:'aurora',v:'Coliseu dos Recreios',c:'Lisbon',d:'14.11.2026',time:'21:00',g:'Electronic',pr:'€38',img:IMG.MS,desc:'The full midnight program, performed in sequence, with a quadraphonic tape orchestra.'},
 {id:'ev2',t:'Vera Lune — Velvet Hours, live quartet',a:'vera',v:'Le Caveau',c:'Paris',d:'22.11.2026',time:'20:30',g:'Jazz',pr:'€26',img:IMG.VERA,desc:'One set, no encores announced, phones in the velvet box.'},
 {id:'ev3',t:'SONORA SESSIONS / 019 — taping',a:'nia',v:'Warehouse 9',c:'Berlin',d:'05.12.2026',time:'19:00',g:'Soul',pr:'Free',img:IMG.SESSION,desc:'A live audience of eighty, recorded for the Sessions series.'},
 {id:'ev4',t:'Night Signals Festival',a:'aurora',v:'Kraftwerk',c:'Berlin',d:'12.12.2026',time:'22:00',g:'Electronic',pr:'€54',img:IMG.CLUB,desc:'Six rooms, one night. SONORA curates the quiet room.'},
 {id:'ev5',t:'Milo North — acoustic evening',a:'milo',v:'Sentralen',c:'Oslo',d:'18.12.2026',time:'19:30',g:'Folk',pr:'€22',img:IMG.MILO,desc:'Solo guitar, winter songs, no support act.'},
 {id:'ev6',t:'Fog Archive in spatial audio',a:'elias',v:'Harpa — Studio',c:'Reykjavík',d:'09.01.2027',time:'18:00',g:'Ambient',pr:'€18',img:IMG.ELIAS,desc:'A listening room, not a concert. Forty chairs, sixty-four speakers.'}
];
var STATIONS=[
 {id:'late',n:'Late Night',tag:'For the last hour of the day',ac:'#6C8CFF',host:'Mara Voss'},
 {id:'focus',n:'Focus',tag:'Instrumental, unhurried',ac:'#7FA6B8',host:'Automated'},
 {id:'disc',n:'Discovery',tag:'New voices, weekly',ac:'#D98BA6',host:'K. Adeyemi'},
 {id:'amb',n:'Ambient',tag:'Weather, not songs',ac:'#8FA98A',host:'Automated'},
 {id:'elec',n:'Electronic',tag:'After-hours pulse',ac:'#E07A4F',host:'DJ Halide'},
 {id:'jazz',n:'Jazz',tag:'Blue, mostly',ac:'#B84A4A',host:'T. Marchand'},
 {id:'indie',n:'Indie',tag:'Guitars & cities',ac:'#D8A24A',host:'P. Lindgren'},
 {id:'clas',n:'Classical',tag:'Old futures',ac:'#A8A297',host:'Automated'},
 {id:'world',n:'World',tag:'Everywhere at once',ac:'#C97B4F',host:'S. Diallo'}
];
var SCHEDULE=[['18:00','Drive Time, Gently','P. Lindgren','Indie'],['19:00','New Voices Hour','K. Adeyemi','Discovery'],['20:00','Blue Hour','T. Marchand','Jazz'],['21:00','After-Hours Pulse','DJ Halide','Electronic'],['22:00','The Last Hour','Mara Voss','Late Night']];
var SESSIONS=[];
var GENRES=[
 {id:'electronic',n:'Electronic',sub:['Techno','IDM','Synthwave','Downtempo'],rel:['ambient','indie'],blurb:'Music built from circuits and clocks — from Düsseldorf to Detroit to Berlin.'},
 {id:'jazz',n:'Jazz',sub:['Noir','Modal','Spiritual','Vocal'],rel:['soul','classical'],blurb:'The art of composing in real time, in rooms with long memory.'},
 {id:'hiphop',n:'Hip-hop',sub:['Boom bap','Trap','Spoken word'],rel:['soul','electronic'],blurb:'Rhythm as rhetoric: sampled pasts and spoken futures.'},
 {id:'classical',n:'Classical',sub:['Modern','Minimalism','Choral'],rel:['ambient','jazz'],blurb:'Old futures, still arriving.'},
 {id:'rock',n:'Rock',sub:['Post-punk','Shoegaze','Indie rock'],rel:['indie','folk'],blurb:'Guitars, rooms, and the distance between them.'},
 {id:'ambient',n:'Ambient',sub:['Drone','Field recording','Dark ambient'],rel:['electronic','classical'],blurb:'Weather, not songs. Music you stand inside.'},
 {id:'soul',n:'Soul',sub:['Neo-soul','R&B','Gospel'],rel:['jazz','hiphop'],blurb:'The close microphone and the long note.'},
 {id:'folk',n:'Folk',sub:['Acoustic','Nordic folk','Americana'],rel:['rock','classical'],blurb:'Songs at walking pace.'},
 {id:'experimental',n:'Experimental',sub:['Tape music','Glitch','Musique concrète'],rel:['ambient','electronic'],blurb:'The edge cases of listening.'},
 {id:'world',n:'World',sub:['Highlife','City pop','Fado'],rel:['folk','soul'],blurb:'Everywhere at once.'}
];
var HISTORY=[
 {y:'1960',g:['Soul','Folk','Free jazz'],t:'Multitrack recording',a:'The first studios become instruments',m:'Albums begin to be “works”, not collections'},
 {y:'1970',g:['Rock','Funk','Disco'],t:'The cassette',a:'Music becomes portable and personal',m:'The mixtape is born — curation as love language'},
 {y:'1980',g:['Synthpop','Hip-hop','New wave'],t:'Synthesizers & samplers',a:'Machines enter the band',m:'The studio moves into a bedroom'},
 {y:'1990',g:['Techno','Grunge','Trip-hop'],t:'The CD & the club',a:'Dance culture goes global',m:'The DJ becomes an author'},
 {y:'2000',g:['Indie','Electroclash','R&B'],t:'The MP3',a:'Music becomes a file',m:'Listening detaches from the object'},
 {y:'2010',g:['Streaming pop','Lo-fi','Trap'],t:'Streaming',a:'Everything, everywhere, flat',m:'Discovery becomes algorithmic'},
 {y:'2020',g:['Hyperpop','Ambient revival'],t:'Spatial audio',a:'Listening becomes a room again',m:'The quiet returns to recordings'},
 {y:'2026',g:['AI-assisted','Field recording','Neo-soul'],t:'AI-assisted production',a:'Tools that listen back',m:'The question shifts from “made by whom” to “cared for by whom”'}
];
var TECH=[['1948','Vinyl','The first format. The object becomes the music.'],['1963','Cassette','Portable, personal, imperfect — and revolutionary.'],['1982','Compact Disc','Silence between tracks becomes digital zero.'],['1995','MP3','The file. Music leaves the object entirely.'],['2010','Streaming','Access replaces ownership; the library becomes a pipe.'],['2021','Spatial audio','The mix gains a room; listening gains a body.'],['2026','AI-assisted production','Tools that suggest, arrange, and listen back.']];
var CHARTS=[];
var LYRICS_MS=[['City hums in minor keys','windows breathe in sodium'],['I keep your voice on frequency','half asleep and halfway home'],['Midnight signals, carry slow','every light a morse of you'],['If the night is a transmitter','then my heart’s the antenna, tuned'],['Static on the staircase','shadow on the wall'],['I read the streetlights slowly','like handwriting, like you'],['Midnight signals, carry slow','tell the dark I’m listening still'],['If silence is a country','then this song’s a postcard home']];

/* Collect everything for tooling / future use. */
window.SONORA_DATA={
 IMG:IMG,ARTISTS:ARTISTS,ALBUMS:ALBUMS,PLAYLISTS:PLAYLISTS,
 STORIES:STORIES,EVENTS:EVENTS,STATIONS:STATIONS,SCHEDULE:SCHEDULE,
 SESSIONS:SESSIONS,GENRES:GENRES,HISTORY:HISTORY,TECH:TECH,
 CHARTS:CHARTS,LYRICS_MS:LYRICS_MS
};
window.artist=artist;window.album=album;window.trackRef=trackRef;
window.durS=durS;window.playlist=playlist;window.story=story;
