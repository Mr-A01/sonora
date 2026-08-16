/**
 * SONORA — Listen deeper.
 * Real HTMLAudioElement playback, scrubbable progress, localStorage library.
 */

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
var ARTISTS={
 aurora:{id:'aurora',name:'Aurora Vale',g:'Alternative / Electronic',loc:'Lisbon, Portugal',ac:'#6C8CFF',img:IMG.AUR,sim:['elias','sora','nia'],bio:'Aurora Vale writes music for the hour when the city lowers its voice. Trained as a classical pianist and rebuilt as a synthesist, she treats the night as a collaborator: tram hum as bassline, sodium light as color grade. Midnight Signals, her third album, was recorded alone between 1am and 5am.'},
 milo:{id:'milo',name:'Milo North',g:'Folk / Acoustic',loc:'Oslo, Norway',ac:'#8FA98A',img:IMG.MILO,sim:['aurora','elias'],bio:'Milo North carries the Nordic folk tradition into quiet modern rooms. One guitar, one microphone, no corrections. His songs move at walking pace and reward patience.'},
 nia:{id:'nia',name:'Nia Sol',g:'Soul / R&B',loc:'London, UK',ac:'#D8A24A',img:IMG.NIA,sim:['vera','sora'],bio:'Nia Sol sings like warm static — a voice recorded close, with the room left in. Golden Static pairs analog keys with arrangements that never hurry.'},
 kairo:{id:'kairo',name:'Kairo Bloom',g:'Hip-hop / Spoken word',loc:'Accra / Berlin',ac:'#E07A4F',img:IMG.KAIRO,sim:['sora','nia'],bio:'Between Accra and Berlin, Kairo Bloom builds hip-hop from rooftop psalms, night-market field recordings and boom-bap patience.'},
 elias:{id:'elias',name:'Elias Grey',g:'Ambient / Modern classical',loc:'Reykjavík, Iceland',ac:'#7FA6B8',img:IMG.ELIAS,sim:['aurora','milo'],bio:'Elias Grey records weather. Fog, tide, and tape hiss become structure in his work — music you stand inside rather than listen to.'},
 sora:{id:'sora',name:'Sora June',g:'Indie Pop / City pop',loc:'Tokyo, Japan',ac:'#D98BA6',img:IMG.SORA,sim:['aurora','kairo'],bio:'Sora June writes small cinematic songs about large anonymous cities: vending-machine glow, last trains, umbrellas shared by strangers.'},
 vera:{id:'vera',name:'Vera Lune',g:'Jazz / Noir',loc:'Paris, France',ac:'#B84A4A',img:IMG.VERA,sim:['nia','elias'],bio:'Vera Lune performs after midnight, in rooms with low light and long memory. Velvet Hours was tracked live to tape in a single weekend.'}
};
function artist(id){return ARTISTS[id]||ARTISTS.aurora;}
var ALBUMS=[
 {id:'ms',t:'Midnight Signals',a:'aurora',y:2026,g:'Alternative / Electronic',img:IMG.MS,desc:'Eight transmissions recorded between 1am and 5am. The album treats the sleeping city as an instrument — tram hum as bassline, sodium light as color grade.',tracks:[{id:'ms-01-glass-horizon',t:'Glass Horizon',d:'4:12'},{id:'ms-02-midnight-signals',t:'Midnight Signals',d:'5:03'},{id:'ms-03-half-awake',t:'Half Awake',d:'3:48'},{id:'ms-04-sodium-lights',t:'Sodium Lights',d:'4:26'},{id:'ms-05-blue-hour',t:'Blue Hour',d:'3:59'},{id:'ms-06-terminal-dreams',t:'Terminal Dreams',d:'5:41'},{id:'ms-07-afterglow',t:'Afterglow',d:'4:02'},{id:'ms-08-signal-fade',t:'Signal / Fade',d:'6:01'}]},
 {id:'gs',t:'Golden Static',a:'nia',y:2026,g:'Soul / R&B',img:IMG.NIA,desc:'Warm circuits and close vocals. Nia Sol’s second album keeps the tape hiss in on purpose.',tracks:[{id:'gs-01-honey-smoke',t:'Honey & Smoke',d:'3:44'},{id:'gs-02-golden-static',t:'Golden Static',d:'4:12'},{id:'gs-03-velvet-hour',t:'Velvet Hour',d:'3:58'},{id:'gs-04-slow-burn',t:'Slow Burn',d:'4:26'},{id:'gs-05-amber',t:'Amber',d:'3:39'},{id:'gs-06-warm-circuits',t:'Warm Circuits',d:'4:41'},{id:'gs-07-after-you',t:'After You',d:'4:16'},{id:'gs-08-close-to-dawn',t:'Close to Dawn',d:'4:20'}]},
 {id:'nr',t:'Neon Rain',a:'sora',y:2026,g:'Indie Pop',img:IMG.SORA,desc:'Seven songs for wet pavement and pink signage. City pop remembered by someone who wasn’t born yet.',tracks:[{id:'nr-01-vending-machine-glow',t:'Vending Machine Glow',d:'3:32'},{id:'nr-02-neon-rain',t:'Neon Rain',d:'4:02'},{id:'nr-03-umbrella-logic',t:'Umbrella Logic',d:'3:26'},{id:'nr-04-2am-convenience-store',t:'2AM Convenience Store',d:'3:48'},{id:'nr-05-shinjuku-blue',t:'Shinjuku Blue',d:'4:12'},{id:'nr-06-last-train-home',t:'Last Train Home',d:'4:44'},{id:'nr-07-pink-noise-city',t:'Pink Noise City',d:'3:40'}]},
 {id:'bt',t:'Bloom Theory',a:'kairo',y:2025,g:'Hip-hop',img:IMG.KAIRO,desc:'Rooftop psalms and concrete gardens. A debut that grows slowly and blooms at night.',tracks:[{id:'bt-01-concrete-garden',t:'Concrete Garden',d:'3:22'},{id:'bt-02-bloom-theory',t:'Bloom Theory',d:'3:58'},{id:'bt-03-rooftop-psalms',t:'Rooftop Psalms',d:'4:12'},{id:'bt-04-harmattan',t:'Harmattan',d:'3:41'},{id:'bt-05-night-market',t:'Night Market',d:'3:26'},{id:'bt-06-second-sun',t:'Second Sun',d:'4:05'},{id:'bt-07-gravity',t:'Gravity',d:'3:52'},{id:'bt-08-letters-home',t:'Letters Home',d:'4:16'}]},
 {id:'ns',t:'Northern Stillness',a:'milo',y:2025,g:'Folk',img:IMG.MILO,desc:'Songs at walking pace, recorded near the tree line with the window open.',tracks:[{id:'ns-01-pine-stone',t:'Pine & Stone',d:'4:02'},{id:'ns-02-the-quiet-part',t:'The Quiet Part',d:'3:41'},{id:'ns-03-frost-line',t:'Frost Line',d:'4:18'},{id:'ns-04-riverbed',t:'Riverbed',d:'3:55'},{id:'ns-05-lantern',t:'Lantern',d:'4:36'},{id:'ns-06-northern-stillness',t:'Northern Stillness',d:'5:12'},{id:'ns-07-homecoming',t:'Homecoming',d:'4:40'}]},
 {id:'fa',t:'Fog Archive',a:'elias',y:2024,g:'Ambient',img:IMG.ELIAS,desc:'Six long exposures of Icelandic weather. Not songs — places.',tracks:[{id:'fa-01-black-sand',t:'Black Sand',d:'7:12'},{id:'fa-02-fog-archive-i',t:'Fog Archive I',d:'8:04'},{id:'fa-03-tide-memory',t:'Tide Memory',d:'6:48'},{id:'fa-04-fog-archive-ii',t:'Fog Archive II',d:'7:36'},{id:'fa-05-drift',t:'Drift',d:'6:22'},{id:'fa-06-north-light',t:'North Light',d:'8:16'}]},
 {id:'pc',t:'Paper Cities',a:'aurora',y:2023,g:'Alternative',img:IMG.PC,desc:'The debut: rooftops, attics, and the last tram home.',tracks:[{id:'pc-01-paper-cities',t:'Paper Cities',d:'3:58'},{id:'pc-02-rooftop-weather',t:'Rooftop Weather',d:'4:11'},{id:'pc-03-old-keys',t:'Old Keys',d:'3:36'},{id:'pc-04-window-seat',t:'Window Seat',d:'4:24'},{id:'pc-05-last-tram',t:'Last Tram',d:'5:02'},{id:'pc-06-attic-light',t:'Attic Light',d:'3:47'},{id:'pc-07-winter-count',t:'Winter Count',d:'4:42'}]},
 {id:'vh',t:'Velvet Hours',a:'vera',y:2023,g:'Jazz',img:IMG.VERA,desc:'Live to tape in a Paris basement, after closing time.',tracks:[{id:'vh-01-velvet-hours',t:'Velvet Hours',d:'5:12'},{id:'vh-02-smoke-brass',t:'Smoke & Brass',d:'4:38'},{id:'vh-03-bar-light',t:'Bar Light',d:'5:02'},{id:'vh-04-midnight-pour',t:'Midnight Pour',d:'4:26'},{id:'vh-05-red-dress',t:'Red Dress',d:'5:44'},{id:'vh-06-last-call',t:'Last Call',d:'6:08'},{id:'vh-07-after-hours',t:'After Hours',d:'5:20'}]},
 {id:'ws',t:'Winter Songs — EP',a:'milo',y:2024,g:'Folk / Acoustic',img:IMG.WS,desc:'Five quiet songs for the darkest month.',tracks:[{id:'ws-01-first-snow',t:'First Snow',d:'3:52'},{id:'ws-02-woodsmoke',t:'Woodsmoke',d:'4:04'},{id:'ws-03-december-again',t:'December, Again',d:'3:47'},{id:'ws-04-the-long-way',t:'The Long Way',d:'4:05'},{id:'ws-05-still-here',t:'Still Here',d:'4:00'}]}
];
function album(id){for(var i=0;i<ALBUMS.length;i++)if(ALBUMS[i].id===id)return ALBUMS[i];return ALBUMS[0];}
function trackRef(r){var p=r.split(':');var al=album(p[0]);var i=+p[1];var tr=al.tracks[i]||{id:al.id+'-00',t:'Unknown',d:'0:00'};return {al:al,i:i,id:tr.id||(al.id+'-'+(i+1)),t:tr.t,d:tr.d};}
function durS(d){var p=d.split(':');return (+p[0])*60+(+p[1]);}
var PLAYLISTS=[
 {id:'pl1',t:'2AM / ALONE IN THE CITY',d:'For empty streets and full heads.',cur:'SONORA Editors',img:IMG.ORB,tracks:['ms:2','nr:3','pc:4','fa:0','vh:2','ms:6']},
 {id:'pl2',t:'SUNDAY MORNING',d:'Slow light, slow coffee, slower tempo.',cur:'Nia Sol',img:IMG.NIA,tracks:['gs:0','ns:0','ws:0','gs:4','ns:6']},
 {id:'pl3',t:'DRIVING WITHOUT A DESTINATION',d:'Windows down, no map.',cur:'SONORA Editors',img:IMG.PC,tracks:['pc:0','bt:3','nr:5','ms:3','pc:4']},
 {id:'pl4',t:'AFTER THE RAIN',d:'The city smells like memory.',cur:'Sora June',img:IMG.SORA,tracks:['nr:1','fa:2','ms:6','pc:6','nr:6']},
 {id:'pl5',t:'WORK / DEEP FOCUS',d:'One hour of undisturbed work.',cur:'Elias Grey',img:IMG.ELIAS,tracks:['fa:0','fa:3','fa:5','ms:7','fa:4']},
 {id:'pl6',t:'NEW VOICES',d:'Artists you haven’t met yet.',cur:'SONORA Editors',img:IMG.KAIRO,tracks:['bt:0','nr:0','gs:1','ns:3','vh:0']}
];
function playlist(id){for(var i=0;i<PLAYLISTS.length;i++)if(PLAYLISTS[i].id===id)return PLAYLISTS[i];return PLAYLISTS[0];}
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
var SESSIONS=[
 {id:'se1',n:'SONORA SESSIONS / 018',a:'aurora',loc:'Lisbon — Warehouse on Rua do Vapor',dur:'42:18',img:IMG.SESSION,notes:'Recorded in an empty warehouse with one spotlight and a quadraphonic tape rig. No overdubs; the room is in every take.',set:[['Glass Horizon','04:12'],['Sodium Lights','04:26'],['Half Awake — stripped','03:58'],['Midnight Signals','05:03'],['Afterglow','04:02']]},
 {id:'se2',n:'SONORA SESSIONS / 017',a:'elias',loc:'Reykjavík — Harpa, Studio B',dur:'38:44',img:IMG.ELIAS,notes:'Three long exposures performed to a room of forty listeners in the dark.',set:[['Black Sand','07:12'],['Tide Memory','06:48'],['North Light','08:16']]},
 {id:'se3',n:'SONORA SESSIONS / 016',a:'vera',loc:'Paris — Le Caveau, after hours',dur:'35:20',img:IMG.VERA,notes:'Tracked live after closing time, glasses and all.',set:[['Velvet Hours','05:12'],['Bar Light','05:02'],['Last Call','06:08']]}
];
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
var CHARTS=[
 {ref:'ms:1',mv:'NEW',plays:'2.1M'},{ref:'gs:1',mv:'+2',plays:'1.8M'},{ref:'nr:1',mv:'+1',plays:'1.6M'},
 {ref:'bt:1',mv:'-2',plays:'1.4M'},{ref:'ms:3',mv:'+4',plays:'1.2M'},{ref:'vh:0',mv:'0',plays:'1.1M'},
 {ref:'ns:5',mv:'-1',plays:'980k'},{ref:'fa:0',mv:'+3',plays:'910k'},{ref:'nr:5',mv:'NEW',plays:'860k'},
 {ref:'gs:4',mv:'-3',plays:'800k'},{ref:'pc:0',mv:'+1',plays:'740k'},{ref:'ws:0',mv:'-4',plays:'690k'}
];
var LYRICS_MS=[['City hums in minor keys','windows breathe in sodium'],['I keep your voice on frequency','half asleep and halfway home'],['Midnight signals, carry slow','every light a morse of you'],['If the night is a transmitter','then my heart’s the antenna, tuned'],['Static on the staircase','shadow on the wall'],['I read the streetlights slowly','like handwriting, like you'],['Midnight signals, carry slow','tell the dark I’m listening still'],['If silence is a country','then this song’s a postcard home']];
/* STATE */
var S={page:'home',param:null,tab:null,
 playing:{al:null,i:0,t:0,on:false,ctx:null},queue:[],likes:{},follows:{},hist:[],savedPl:{},savedAlb:{},volume:0.85,muted:false,shuffle:false,repeat:'off',
 ambient:true,ptab:'queue',radio:null,radioT:0,sleep:0,
 genre:'ambient',decade:5,libTab:'liked',evCity:'all',evG:'all',
 smart:{mood:'Reflective',time:'Late night',act:'Reading',en:'Low'},
 sessionPlay:false,studioTab:'overview',relTab:'Published',upStep:1,
 recents:['aurora vale','ambient','midnight','tokyo']};

/* ========== REAL AUDIO ENGINE ========== */
/* Track audio files live in audio/{trackId}.mp3 — see README */
var AUDIO_FALLBACK="audio/track1.mp3";
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
  if(tr&&tr.id)return 'audio/'+tr.id+'.mp3';
  return 'audio/'+alId+'-'+(idx+1)+'.mp3';
}
function loadPersist(){
  try{
    var raw=localStorage.getItem("sonora-state");
    if(!raw)return;
    var d=JSON.parse(raw);
    if(d.likes)S.likes=d.likes;
    if(d.follows)S.follows=d.follows;
    if(d.savedPl)S.savedPl=d.savedPl;
    if(d.recents)S.recents=d.recents;
    if(d.hist)S.hist=d.hist;
    if(d.savedAlb)S.savedAlb=d.savedAlb;
  }catch(e){}
}
function savePersist(){
  try{
    localStorage.setItem("sonora-state",JSON.stringify({
      likes:S.likes,follows:S.follows,savedPl:S.savedPl,recents:S.recents,hist:S.hist,savedAlb:S.savedAlb||{}
    }));
  }catch(e){}
}
loadPersist();
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
audioEl.addEventListener("timeupdate",syncProgressUI);
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
var FINE=window.matchMedia&&matchMedia('(pointer: fine)').matches;
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
 radio:'<circle cx="12" cy="12" r="2.4"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 share:'<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7h14v-7"/>',
 glow:'<circle cx="12" cy="12" r="3.4"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/>',
 home:'<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-8M21 20H3"/>',
 moon:'<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>'
}[n]||'';return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P+'</svg>';}
/* PLAYBACK */
function nowTrack(){if(!S.playing.al)return null;var al=album(S.playing.al);var tr=al.tracks[S.playing.i]||{id:'',t:'',d:'0:00'};return {al:al,i:S.playing.i,id:tr.id,t:tr.t,d:tr.d};}

function setVolume(v){
  v=Math.max(0,Math.min(1,v));
  S.volume=v;S.muted=v===0?true:S.muted&&v===0;
  if(!S.muted)audioEl.volume=v;
  else audioEl.volume=0;
  try{localStorage.setItem('sonora-vol',JSON.stringify({volume:S.volume,muted:S.muted}));}catch(e){}
  renderMini();renderPlayerIfOpen();
}
function toggleMute(){
  S.muted=!S.muted;
  audioEl.volume=S.muted?0:S.volume;
  try{localStorage.setItem('sonora-vol',JSON.stringify({volume:S.volume,muted:S.muted}));}catch(e){}
  toast(S.muted?'Muted':'Unmuted');
  renderMini();renderPlayerIfOpen();
}
function cycleRepeat(){
  S.repeat=S.repeat==='off'?'all':(S.repeat==='all'?'one':'off');
  toast('Repeat: '+(S.repeat==='off'?'Off':S.repeat==='one'?'One':'All'));
  renderMini();renderPlayerIfOpen();
}
function toggleShuffle(){
  S.shuffle=!S.shuffle;
  toast(S.shuffle?'Shuffle on':'Shuffle off');
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
try{
  var _v=JSON.parse(localStorage.getItem('sonora-vol')||'null');
  if(_v){S.volume=typeof _v.volume==='number'?_v.volume:0.85;S.muted=!!_v.muted;audioEl.volume=S.muted?0:S.volume;}
}catch(e){}

function play(alId,idx,ctx){
  S.playing={al:alId,i:idx||0,t:0,on:true,ctx:ctx||null};
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
    // Fallback to bundled demos if custom id file is missing
    var fb=['audio/track1.mp3','audio/track2.mp3','audio/track3.mp3','audio/track4.mp3','audio/track5.mp3','audio/track6.mp3','audio/track7.mp3','audio/track8.mp3'];
    var i=0;for(var c=0;c<tid.length;c++)i=(i+tid.charCodeAt(c))%fb.length;
    var alt=fb[i];
    try{alt=new URL(alt,window.location.href).href;}catch(e){}
    if(audioEl.src.indexOf(alt)===-1){audioEl.src=alt;audioEl.play().catch(function(){});}
    else toast('Missing audio file: audio/'+tid+'.mp3');
  };
  if(audioEl.src!==url){audioEl.src=url;}
  try{audioEl.currentTime=0;}catch(e){}
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
function togglePlay(){
  if(!S.playing.al){play("ms",0);return;}
  if(S.playing.on){audioEl.pause();S.playing.on=false;}
  else{var pr=audioEl.play();if(pr&&pr.catch)pr.catch(function(){});S.playing.on=true;}
  renderMini();renderPlayerIfOpen();syncPlayingRows();
}
function nextTrack(fromEnded){
  if(!S.playing.al&&!S.radio)return;
  if(fromEnded&&S.repeat==='one'){try{audioEl.currentTime=0;}catch(e){}audioEl.play().catch(function(){});S.playing.on=true;renderMini();renderPlayerIfOpen();return;}
  if(S.queue.length){playRef(S.queue.shift());return;}
  if(S.radio){
    var pool=['ms:1','gs:1','nr:1','fa:0','vh:0','bt:1','ns:0','pc:0'];
    S.radio.idx=(S.radio.idx+1)%pool.length;
    playRef(pool[S.radio.idx]);
    return;
  }
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
 if(S.radio&&S.playing.on){S.radioT++;if(S.radioT>20){S.radioT=0;S.radio.idx=(S.radio.idx+1)%5;}}
},1000);
function fmt(s){var m=Math.floor(s/60),ss=s%60;return m+':'+(ss<10?'0':'')+ss;}
function syncPlayingRows(){$$('.trow').forEach(function(r){var ref=r.getAttribute('data-ref');if(!ref)return;var nt=nowTrack();r.classList.toggle('playing',!!nt&&ref===S.playing.al+':'+S.playing.i);});}
function radioPlay(id){
  S.radio={st:id,idx:0};S.radioT=0;
  var st=null;STATIONS.forEach(function(x){if(x.id===id)st=x;});
  if(st)setAccent(st.ac);
  var pool=['ms:1','gs:1','nr:1','fa:0','vh:0','bt:1','ns:0','pc:0'];
  playRef(pool[0]);
  toast('On air — '+(st?st.n:id));
}
function radioNow(){if(!S.radio)return null;var pool=['ms:1','gs:1','nr:1','fa:0','vh:0','bt:1','ns:0','pc:0'];return trackRef(pool[S.radio.idx%pool.length]);}
/* COMPONENTS */
function albumCard(al,size){var a=artist(al.a);
 return '<div class="acard '+(size||'')+'" data-rv data-cur="PLAY">'
 +'<div class="im">'
 +'<img src="'+al.img+'" alt="'+esc(al.t)+' — '+esc(a.name)+'" loading="lazy">'
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
function storyCard(st){return '<article class="scard" data-rv><button type="button" class="scard-hit" data-a="story" data-id="'+st.id+'" data-cur="READ" aria-label="Read '+esc(st.t)+'"><span class="im"><img src="'+st.img+'" alt="" loading="lazy"><span class="cat">'+st.cat+'</span></span><span class="t">'+esc(st.t)+'</span><span class="m">'+st.au+' · '+st.rt+' read</span></button></article>';}
function railHead(idx,t,act){return '<div class="sec-t"><div><span class="idx">'+idx+'</span><h2>'+t+'</h2></div>'+(act||'')+'</div>';}
function footerHTML(){
 return '<div class="wrap"><div class="f-word">SONORA<em>.</em></div>'
 +'<div class="f-grid"><div><h4>Listen</h4><button data-a="nav" data-p="discover">Discover</button><button data-a="nav" data-p="music">Music</button><button data-a="nav" data-p="charts">Charts</button><button data-a="nav" data-p="radio">Radio</button><button data-a="nav" data-p="playlists">Playlists</button></div>'
 +'<div><h4>Culture</h4><button data-a="nav" data-p="stories">Stories</button><button data-a="nav" data-p="live">Sessions</button><button data-a="nav" data-p="events">Events</button><button data-a="nav" data-p="history">History of sound</button><button data-a="nav" data-p="about">About</button></div>'
 +'<div><h4>Artists</h4><button data-a="nav" data-p="artists">Artists</button><button data-a="nav" data-p="studio">Artist studio</button><button data-a="nav" data-p="genres">Genres</button></div>'
 +'<div><h4>SONORA</h4><button data-a="nav" data-p="membership">SONORA+</button><button data-a="nav" data-p="library">Library</button><button data-a="nav" data-p="stats">Listening stats</button></div></div>'
 +'<div class="f-bot"><span>© 2026 SONORA — a fictional demo. All artists, releases & data are invented.</span><span>Listen deeper.</span></div></div>';}
/* PAGES */
function pgHome(){
 var h='<section class="hero"><div class="bg" id="heroBg"><img src="'+IMG.MS+'" alt="" fetchpriority="high"></div><div class="wrap in">'
 +'<span class="mn" data-rv><span class="ac">FEATURED</span> — AURORA VALE · MIDNIGHT SIGNALS · 2026</span>'
 +'<h1 data-rv style="--d:.08s">Listen <em>deeper.</em></h1>'
 +'<p class="sub" data-rv style="--d:.16s">Discover music through artists, stories, places, and sound. Music is not content. It is culture.</p>'
 +'<div class="ctas" data-rv style="--d:.24s"><button class="btn solid" data-a="nav" data-p="discover">Explore today’s selection</button><button class="btn" data-a="nav" data-p="radio">Open radio</button></div>'
 +'</div><div class="now"><img src="'+IMG.MS+'" alt="" style="width:52px;height:52px;border-radius:8px;object-fit:cover"><div style="min-width:0"><div class="mn"><span class="ac">NOW</span></div><div style="font-weight:600;font-size:13px;margin-top:3px">Midnight Signals</div><div style="font-size:11.5px;color:var(--ink2)">Aurora Vale — out now</div></div><button class="ibtn fill" data-a="play-album" data-id="ms" aria-label="Play album">'+ic('play',16)+'</button></div></section>';
 h+='<div class="tick" aria-hidden="true"><div class="tick-in">'+('<span>THE SPACE BETWEEN — OUT NOW</span><span>SONORA SESSIONS / 018 — LISBON</span><span>WEEKLY CHART — FRIDAYS</span><span>LISTEN DEEPER</span>').repeat(6)+('<span>THE SPACE BETWEEN — OUT NOW</span><span>SONORA SESSIONS / 018 — LISBON</span><span>WEEKLY CHART — FRIDAYS</span><span>LISTEN DEEPER</span>').repeat(6)+'</div></div>';
 h+='<section class="sec"><div class="wrap"><div class="bigstory"><div class="im" data-rv><img src="'+IMG.STUDIO+'" alt="A studio at night" loading="lazy"></div><div data-rv style="--d:.1s"><span class="mn"><span class="ac">FEATURED STORY</span> — CULTURE</span><h3 style="margin-top:16px">The sound of <em>midnight</em></h3><p>Artists who create after dark — when the city lowers its voice and the machines start listening.</p><blockquote>“Night is not the absence of day. It is a different instrument.”</blockquote><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn acc" data-a="story" data-id="st1">Read story</button><button class="ibtn" data-a="play-ref" data-ref="ms:1" aria-label="Play Midnight Signals">'+ic('play',16)+'</button></div></div></div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('01','Today’s selection','<button class="tlink" data-a="nav" data-p="music">All music</button>');
 h+='<div class="mgrid">'+albumCard(album('ms'),'c3')+albumCard(album('gs'),'c3')+albumCard(album('nr'),'c2')+albumCard(album('bt'),'c2')+albumCard(album('ns'),'c2')+albumCard(album('fa'),'c3')+albumCard(album('vh'),'c3')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('02','This week’s chart','<button class="tlink" data-a="nav" data-p="charts">Full chart</button>');
 h+='<div style="border-top:1px solid var(--line)">'+CHARTS.slice(0,5).map(function(c,i){var tr=trackRef(c.ref);var mv=c.mv==='NEW'?'<span class="mv nw">NEW</span>':c.mv.charAt(0)==='+'?'<span class="mv up">▲ '+c.mv.slice(1)+'</span>':c.mv==='0'?'<span class="mv">•</span>':'<span class="mv dn">▼ '+c.mv.slice(1)+'</span>';
  return '<button class="crow" data-a="play-ref" data-ref="'+c.ref+'"><span class="rk">'+(i+1)+'</span><span>'+mv+'</span><img src="'+tr.al.img+'" alt=""><span><span class="tt">'+esc(tr.t)+'</span><span class="ta" style="display:block">'+esc(artist(tr.al.a).name)+'</span></span><span class="d" style="font-family:var(--mono);font-size:10px;color:var(--mut)">'+c.plays+'</span><span class="ibtn fill" style="width:36px;height:36px">'+ic('play',14)+'</span></button>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('03','Editorial playlists','<button class="tlink" data-a="nav" data-p="playlists">All playlists</button>');
 h+='<div class="rail">'+PLAYLISTS.map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'" data-cur="PLAY" data-rv><span class="im"><img src="'+p.img+'" alt="" loading="lazy"><span class="pb">'+ic('play',16)+'</span></span><span class="t">'+esc(p.t)+'</span><span class="s">'+p.tracks.length+' tracks · '+esc(p.cur)+'</span></button>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('04','From the journal','<button class="tlink" data-a="nav" data-p="stories">All stories</button>');
 h+='<div class="rail">'+STORIES.slice(0,4).map(storyCard).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('05','SONORA Radio','<button class="tlink" data-a="nav" data-p="radio">Open radio</button>');
 h+='<div class="rail">'+STATIONS.slice(0,5).map(function(st){return '<button class="stcard" style="--sc:'+st.ac+'" data-a="radio-go" data-id="'+st.id+'" data-cur="TUNE" data-rv><span class="dot"></span><span class="n">'+st.n+'</span><span class="tg">'+st.tag+'</span></button>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('06','SONORA Sessions','<button class="tlink" data-a="nav" data-p="live">All sessions</button>');
 h+='<div class="bigstory" style="grid-template-columns:1.4fr 1fr"><div class="im" data-rv data-a="session" data-id="se1" data-cur="WATCH" style="cursor:pointer"><img src="'+IMG.SESSION+'" alt="SONORA Sessions 018" loading="lazy"><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span class="ibtn fill" style="width:64px;height:64px">'+ic('play',22)+'</span></span></div><div data-rv style="--d:.1s"><span class="mn"><span class="ac">SESSIONS / 018</span> — LISBON · 42:18</span><h3 style="margin-top:14px;font-size:clamp(26px,3vw,42px)">Aurora Vale, alone with the tape machine</h3><p>One spotlight, an empty warehouse, no overdubs. The room is in every take.</p><div style="margin-top:22px"><button class="btn" data-a="session" data-id="se1">Watch session</button></div></div></div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('07','Out this month','<button class="tlink" data-a="nav" data-p="events">All events</button>');
 h+=EVENTS.slice(0,3).map(function(e){var p=e.d.split('.');return '<button class="evcard" data-a="event" data-id="'+e.id+'" data-rv><span class="d"><span class="mm">'+['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][+p[1]-1]+'</span><span class="dd">'+p[0]+'</span></span><span><span class="t">'+esc(e.t)+'</span><span class="s">'+e.v+' · '+e.c+' · '+e.time+'</span></span><span class="btn sm">'+e.pr+'</span></button>';}).join('')+'</div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap"><div class="bigstory" style="grid-template-columns:1fr 1fr"><div data-rv><span class="mn"><span class="ac">SONORA+</span></span><h3 style="margin-top:14px">For people who love music, not simply store it.</h3><p>High-quality audio, offline listening, exclusive sessions, early event access, editorial collections.</p><div style="margin-top:24px"><button class="btn acc" data-a="nav" data-p="membership">See membership</button></div></div><div class="im" data-rv style="--d:.1s"><img src="'+IMG.ORB+'" alt="" loading="lazy" style="aspect-ratio:4/3;object-fit:cover"></div></div></div></section>';
 return h;
}
function pgDiscover(){
 var fy=[['ms:4','Because you played Aurora Vale this week'],['bt:2','Because you like hip-hop with field recordings'],['fa:1','A quiet step from ambient'],['vh:3','Editor’s choice — jazz after dark'],['nr:0','New artist we think you’ll trust'],['pc:3','Genre expansion: city pop adjacent']];
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">DISCOVER</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Good evening.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Here is what the night suggests.</p></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap">'+railHead('01','For you','<button class="tlink" data-a="nav" data-p="smart">Smart selection</button>');
 h+='<div class="rail">'+fy.map(function(r){var tr=trackRef(r[0]);return '<div class="acard sm" data-rv><button data-a="play-ref" data-ref="'+r[0]+'" data-cur="PLAY" style="width:100%;text-align:left"><span class="im" style="display:block"><img src="'+tr.al.img+'" alt="" loading="lazy"><span class="pb" style="opacity:1;transform:none">'+ic('play',16)+'</span></span><span class="t" style="font-size:13px">'+esc(tr.t)+'</span><span class="s">'+esc(artist(tr.al.a).name)+'</span></button><span class="why">'+r[1]+'</span></div>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('02','New releases');h+='<div class="rail">'+['ms','gs','nr'].map(function(id){return albumCard(album(id));}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('03','Hidden gems');h+='<div class="rail">'+['ws','vh','pc'].map(function(id){return albumCard(album(id),'sm');}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('04','Trending');h+='<div class="rail">'+['bt','ns','fa'].map(function(id){return albumCard(album(id));}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('05','Discovery mix — why you’re hearing this');
 h+='<div class="mgrid">'+[['NEW ARTIST','Sora June','sora','You haven’t heard her yet. The city says you will.'],['SIMILAR ARTIST','Elias Grey','elias','Because you played Aurora Vale.'],['GENRE EXPANSION','Vera Lune','vera','One step from soul into noir jazz.'],['UNEXPECTED PICK','Milo North','milo','Folk, for a night that usually plays synths.'],['EDITOR’S CHOICE','Nia Sol','nia','Our editors won’t stop talking about this record.']].map(function(c,i){var a=artist(c[2]);return '<div class="'+(i===0?'c3':'c2')+'" data-rv><button data-a="artist" data-id="'+a.id+'" data-cur="VIEW" style="width:100%;text-align:left"><span style="display:block;border-radius:10px;overflow:hidden"><img src="'+a.img+'" alt="" loading="lazy" style="aspect-ratio:1/1;object-fit:cover;width:100%"></span><span class="mn" style="display:block;margin-top:12px;color:var(--acc)">'+c[0]+'</span><span class="t" style="display:block;font-weight:600;margin-top:4px">'+c[1]+'</span><span class="why">'+c[3]+'</span></button></div>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('06','Recently played');
 h+='<div class="rail">'+(S.hist.length?S.hist.slice(0,6).map(function(r){var tr=trackRef(r);return '<button class="acard sm" data-a="album" data-id="'+tr.al.id+'" data-rv><span class="im"><img src="'+tr.al.img+'" alt="" loading="lazy"></span><span class="t" style="font-size:13px">'+esc(tr.t)+'</span><span class="s">'+esc(artist(tr.al.a).name)+'</span></button>';}).join(''):'<p class="it" style="color:var(--mut)">Nothing yet — press play somewhere.</p>')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('07','Made for tonight');
 h+='<div class="rail">'+PLAYLISTS.slice(0,3).map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'" data-cur="PLAY" data-rv><span class="im"><img src="'+p.img+'" alt="" loading="lazy"><span class="pb">'+ic('play',16)+'</span></span><span class="t">'+esc(p.t)+'</span><span class="s">'+esc(p.cur)+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgMusic(){
 var g=S.tab||'all';
 var list=ALBUMS.filter(function(a){return g==='all'||a.g.toLowerCase().indexOf(g)>-1;});
 var sizes=['c3','c3','c2','c2','c2','c3','c3','c2','c2'];
 var h='<div class="wrap page-head" style="padding-top:110px"><span class="mn" data-rv><span class="ac">CATALOG</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px;line-height:1.1">Music</h1></div>';
 h+='<section class="sec" style="padding-top:18px"><div class="wrap"><div class="chips" style="margin-bottom:34px" data-rv>'+['all','alternative','electronic','soul','hip-hop','folk','ambient','indie','jazz'].map(function(x){return '<button class="chip '+(g===x?'on':'')+'" data-a="mfilter" data-v="'+x+'">'+x+'</button>';}).join('')+'</div>';
 h+='<div class="mgrid">'+list.map(function(al,i){return albumCard(al,sizes[i%sizes.length]);}).join('')+'</div></div></section>';
 return h;
}
function pgCharts(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">WEEK 46 — 2026</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">The SONORA chart.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>What the world listened to, ranked by listening — not by clicks.</p></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div style="border-top:1px solid var(--line)">'+CHARTS.map(function(c,i){var tr=trackRef(c.ref);var mv=c.mv==='NEW'?'<span class="mv nw">NEW</span>':c.mv.charAt(0)==='+'?'<span class="mv up">▲ '+c.mv.slice(1)+'</span>':c.mv==='0'?'<span class="mv">•</span>':'<span class="mv dn">▼ '+c.mv.slice(1)+'</span>';
  return '<button class="crow" data-a="play-ref" data-ref="'+c.ref+'" data-rv><span class="rk">'+(i+1)+'</span><span>'+mv+'</span><img src="'+tr.al.img+'" alt="" loading="lazy"><span><span class="tt">'+esc(tr.t)+'</span><span class="ta" style="display:block">'+esc(artist(tr.al.a).name+' — '+tr.al.t)+'</span></span><span class="d" style="font-family:var(--mono);font-size:10px;color:var(--mut)">'+c.plays+'</span><span class="ibtn fill" style="width:36px;height:36px">'+ic('play',14)+'</span></button>';}).join('')+'</div>'
 +'<p class="mn" style="margin-top:26px">METHODOLOGY — RANKED BY COMPLETED LISTENS ACROSS SONORA. DEMO DATA.</p></div></section>';
 return h;
}
function pgAlbum(id){
 var al=album(id),a=artist(al.a);
 var total=al.tracks.reduce(function(x,t){return x+durS(t.d||t[1]||'0:00');},0);
 var h='<div class="wrap"><div class="al-hero"><div class="art" data-rv><img src="'+al.img+'" alt="'+esc(al.t)+' artwork"></div>'
 +'<div data-rv style="--d:.1s"><span class="mn"><span class="ac">ALBUM</span> — '+al.y+'</span><h1 style="margin-top:14px">'+esc(al.t)+'</h1><div class="by">'+esc(a.name)+'</div>'
 +'<div class="chips" style="margin:22px 0"><span class="chip on" style="pointer-events:none">'+esc(al.g)+'</span><span class="chip" style="pointer-events:none">'+al.tracks.length+' tracks</span><span class="chip" style="pointer-events:none">'+fmt(total)+'</span></div>'
 +'<p style="color:var(--ink2);max-width:520px">'+esc(al.desc)+'</p>'
 +'<div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap"><button class="btn solid" data-a="play-album" data-id="'+al.id+'">'+ic('play',14)+' Play album</button><button class="btn" data-a="save-album" data-id="'+al.id+'">Save</button><button class="btn" data-a="share">'+ic('share',14)+' Share</button></div></div></div></div>';
 h+='<section class="sec" style="padding-top:20px"><div class="wrap" style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:clamp(24px,4vw,60px)" class="al-body"><div><div class="mn" style="margin-bottom:14px">TRACKLIST</div>'+al.tracks.map(function(t,i){return trackRow(al,i,false);}).join('')+'</div>'
 +'<div><div class="mn" style="margin-bottom:14px">CREDITS</div>'+[['Written by',a.name],['Produced by',a.name+' & J. Ribeiro'],['Performed by',a.name],['Publisher','Sonora Publishing'],['Label','Sonora Records'],['Copyright','℗ & © '+al.y+' Sonora Records']].map(function(c){return '<div style="display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span style="color:var(--mut)">'+c[0]+'</span><span style="text-align:right">'+c[1]+'</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 14px">MORE FROM '+esc(a.name).toUpperCase()+'</div><div class="rail" style="gap:12px">'+ALBUMS.filter(function(x){return x.a===al.a&&x.id!==al.id;}).map(function(x){return albumCard(x,'sm');}).join('')+'</div></div></div></section>';
 return h;
}
function pgArtists(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">ARTISTS</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">The voices.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="mgrid">'+Object.keys(ARTISTS).map(function(k,i){var a=ARTISTS[k];return '<button class="'+(i%3===0?'c3':'c2')+'" data-a="artist" data-id="'+k+'" data-cur="VIEW" data-rv style="text-align:left"><span style="display:block;border-radius:12px;overflow:hidden"><img src="'+a.img+'" alt="'+esc(a.name)+'" loading="lazy" style="width:100%;aspect-ratio:'+(i%3===0?'16/10':'1/1')+';object-fit:cover"></span><span style="display:block;font-family:var(--serif);font-size:clamp(20px,2.4vw,30px);margin-top:14px">'+esc(a.name)+'</span><span class="mn" style="display:block;margin-top:6px">'+esc(a.g).toUpperCase()+' — '+esc(a.loc).toUpperCase()+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgArtist(id){
 var a=artist(id);var als=ALBUMS.filter(function(x){return x.a===id;});var pops=als.length?als[0]:ALBUMS[0];
 var evs=EVENTS.filter(function(e){return e.a===id;});var ses=SESSIONS.filter(function(s){return s.a===id;});
 var h='<div class="wrap"><div class="ar-hero"><div class="im" data-rv><img src="'+a.img+'" alt="'+esc(a.name)+'"></div>'
 +'<div data-rv style="--d:.1s"><span class="mn"><span class="ac">ARTIST</span></span><h1 style="margin-top:14px">'+esc(a.name)+'</h1>'
 +'<div class="mn" style="margin-top:14px">'+esc(a.g).toUpperCase()+' — '+esc(a.loc).toUpperCase()+'</div>'
 +'<p style="color:var(--ink2);margin-top:22px;max-width:520px">'+esc(a.bio)+'</p>'
 +'<div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap"><button class="btn solid" data-a="play-album" data-id="'+pops.id+'">'+ic('play',14)+' Play</button><button class="btn '+(S.follows[id]?'acc':'')+'" data-a="follow" data-id="'+id+'">'+(S.follows[id]?'Following ✓':'Follow')+'</button><button class="btn" data-a="toast" data-msg="Artist radio — demo">'+ic('radio',14)+' Artist radio</button></div></div></div></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap">'+railHead('01','Popular tracks');(als[0]||{tracks:[]}).tracks.slice(0,5).forEach(function(t,i){h+=trackRow(als[0],i,false);});h+='</div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('02','Discography');h+='<div class="rail">'+als.map(function(x){return albumCard(x);}).join('')+'</div></div></section>';
 if(ses.length){h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('03','Live sessions');h+='<div class="rail">'+ses.map(function(s){return '<button class="acard" data-a="session" data-id="'+s.id+'" data-cur="WATCH" data-rv><span class="im" style="aspect-ratio:16/9"><img src="'+s.img+'" alt="" loading="lazy"><span class="pb" style="opacity:1;transform:none">'+ic('play',16)+'</span></span><span class="t">'+esc(s.n)+'</span><span class="s">'+esc(s.loc)+' · '+s.dur+'</span></button>';}).join('')+'</div></div></section>';}
 if(evs.length){h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('04','Upcoming');h+=evs.map(function(e){return '<button class="evcard" data-a="event" data-id="'+e.id+'" data-rv><span class="d"><span class="mm">'+e.d.split('.')[1]+'.'+e.d.split('.')[2].slice(2)+'</span><span class="dd">'+e.d.split('.')[0]+'</span></span><span><span class="t">'+esc(e.t)+'</span><span class="s">'+e.v+' · '+e.c+'</span></span><span class="btn sm">'+e.pr+'</span></button>';}).join('')+'</div></section>';}
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('05','Similar artists');h+='<div class="rail">'+a.sim.map(function(k){var s=artist(k);return '<button class="acard sm" data-a="artist" data-id="'+k+'" data-cur="VIEW" data-rv><span class="im"><img src="'+s.img+'" alt="" loading="lazy"></span><span class="t" style="font-size:13px">'+esc(s.name)+'</span><span class="s">'+esc(s.g)+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgStories(){
 var g=S.tab||'all';var list=STORIES.filter(function(s){return g==='all'||s.cat===g;});
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">THE JOURNAL</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Stories.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Music, written down.</p></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="chips" style="margin-bottom:34px" data-rv>'+['all','Artists','Culture','Sound','Technology','Places'].map(function(c){return '<button class="chip '+(g===c?'on':'')+'" data-a="sfilter" data-v="'+c+'">'+c+'</button>';}).join('')+'</div>';
 if(!list.length) h+='<p class="it" style="color:var(--mut);padding:40px 0">No stories in this category.</p>';
 else h+='<div class="stories-grid">'+list.map(storyCard).join('')+'</div>';
 h+='</div></section>';
 return h;
}
function pgStory(id){
 var st=story(id);
 var h='<div class="wrap" style="padding-top:120px;max-width:860px"><div style="text-align:center" data-rv><span class="mn"><span class="ac">'+st.cat.toUpperCase()+'</span> — '+st.rt.toUpperCase()+' READ</span><h1 class="serif" style="font-size:clamp(34px,5vw,60px);font-weight:400;margin-top:18px;line-height:1.08">'+esc(st.t)+'</h1><p class="it" style="color:var(--ink2);margin-top:16px;font-size:17px">'+esc(st.ex)+'</p><div class="mn" style="margin-top:22px">BY '+st.au.toUpperCase()+' — 2026</div></div>'
 +'<figure data-rv style="margin:44px 0;border-radius:14px;overflow:hidden"><img src="'+st.img+'" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover"></figure>'
 +'<div class="prose" data-rv>';
 if(st.audio)h+='<div class="audioclip"><button class="ibtn fill" data-a="clip" aria-label="Play field recording">'+ic('play',15)+'</button><div><div class="l">FIELD RECORDING</div><div style="font-size:12px;color:var(--ink2)">Tokyo / Shibuya / 01:42 AM — 0:15</div></div></div>';
 st.body.forEach(function(p,i){h+='<p>'+p+'</p>';if(i===1)h+='<blockquote>“'+st.quote+'”</blockquote>';if(i===2)h+='<figure><img src="'+(st.id==='st5'?IMG.TOKYO:st.img)+'" alt="" loading="lazy" style="border-radius:12px"><figcaption>'+st.cat+' — SONORA JOURNAL</figcaption></figure>';});
 h+='</div>';
 h+='<div style="margin:50px 0;border-top:1px solid var(--line);padding-top:26px"><div class="mn" style="margin-bottom:16px"><span class="ac">SOUNDTRACK TO THIS STORY</span></div>'+['ms:1','fa:0'].map(function(r){var tr=trackRef(r);return trackRow(tr.al,tr.i,true);}).join('')+'</div>';
 h+='<div class="mn" style="margin-bottom:16px">KEEP READING</div><div class="rail" style="padding-bottom:20px">'+STORIES.filter(function(s){return s.id!==id;}).slice(0,3).map(storyCard).join('')+'</div></div>';
 return h;
}
function pgLive(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">LIVE</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">SONORA Sessions.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>One room, one take, no corrections.</p></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="rail">'+SESSIONS.map(function(s){var a=artist(s.a);return '<button class="acard lg" data-a="session" data-id="'+s.id+'" data-cur="WATCH" data-rv><span class="im" style="aspect-ratio:16/9"><img src="'+s.img+'" alt="" loading="lazy"><span class="pb" style="opacity:1;transform:none">'+ic('play',16)+'</span></span><span class="t">'+esc(s.n)+'</span><span class="s">'+esc(a.name)+' — '+esc(s.loc)+'</span><span class="g">'+s.dur+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgSession(id){
 var s=null;SESSIONS.forEach(function(x){if(x.id===id)s=x;});var a=artist(s.a);
 var h='<div class="wrap" style="padding-top:100px"><span class="mn" data-rv><span class="ac">'+esc(s.n)+'</span> — '+esc(s.loc).toUpperCase()+' · '+s.dur+'</span>'
 +'<div style="position:relative;border-radius:16px;overflow:hidden;margin-top:22px" data-rv><img src="'+s.img+'" alt="" style="width:100%;aspect-ratio:21/9;object-fit:cover;filter:'+(S.sessionPlay?'brightness(.5)':'none')+';transition:filter .8s">'
 +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><button class="ibtn fill" style="width:72px;height:72px" data-a="session-play">'+ic(S.sessionPlay?'pause':'play',24)+'</button></div>'
 +(S.sessionPlay?'<div style="position:absolute;left:24px;bottom:20px"><div class="mn"><span class="ac">NOW</span> — '+esc(s.set[0][0])+'</div><div style="font-size:12px;color:var(--ink2);margin-top:4px">NEXT — '+esc(s.set[1][0])+'</div></div>':'')+'</div></div>';
 h+='<section class="sec" style="padding-top:40px"><div class="wrap" style="display:grid;grid-template-columns:1.4fr 1fr;gap:60px"><div><div class="mn" style="margin-bottom:14px">SETLIST</div>'+s.set.map(function(t,i){return '<div class="trow"><span class="n">'+(i<9?'0':'')+(i+1)+'</span><span><span class="tt" '+(S.sessionPlay&&i===0?'style="color:var(--acc)"':'')+'>'+esc(t[0])+'</span></span><span></span><span class="d">'+t[1]+'</span></div>';}).join('')
 +'<div class="mn" style="margin:30px 0 12px">ARTIST NOTES</div><p class="it" style="color:var(--ink2);font-size:16px;line-height:1.8;max-width:520px">'+esc(s.notes)+'</p></div>'
 +'<div><div class="mn" style="margin-bottom:14px">CREDITS</div>'+[['Artist',a.name],['Recorded at',s.loc],['Engineer','R. Costa'],['Mixed by','J. Ribeiro'],['Filmed by','SONORA Films'],['Supported by','SONORA+ members']].map(function(c){return '<div style="display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span style="color:var(--mut)">'+c[0]+'</span><span style="text-align:right">'+c[1]+'</span></div>';}).join('')
 +'<div style="margin-top:26px"><button class="btn" data-a="artist" data-id="'+a.id+'">About '+esc(a.name)+'</button></div></div></div></section>';
 return h;
}
function pgRadio(){
 var on=S.radio;var now=radioNow();
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">RADIO</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">SONORA Radio.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Curated streams, around the clock.</p></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap">'+(on?'<div style="border:1px solid var(--acc);border-radius:14px;padding:20px 24px;display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-bottom:36px" data-rv><span class="mn"><span class="ac">ON AIR</span> — '+STATIONS.filter(function(x){return x.id===on.st;})[0].n.toUpperCase()+'</span><div style="flex:1;min-width:200px"><div style="font-weight:600">'+(now?esc(now.t):'')+'</div><div style="font-size:12px;color:var(--ink2)">'+(now?esc(artist(now.al.a).name):'')+'</div></div><button class="ibtn fill" data-a="radio-stop" aria-label="Stop">'+ic('pause',16)+'</button></div>':'');
 h+='<div class="rail">'+STATIONS.map(function(st){return '<button class="stcard '+(on&&on.st===st.id?'on':'')+'" style="--sc:'+st.ac+'" data-a="radio-go" data-id="'+st.id+'" data-cur="TUNE" data-rv><span class="dot"></span><span class="n">'+st.n+'</span><span class="tg">'+st.tag+'</span><span class="mn" style="display:block;margin-top:14px">HOST — '+st.host.toUpperCase()+'</span></button>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:60px"><div><div class="sec-t"><h2 style="font-size:26px">Tonight’s schedule</h2></div><div class="sched">'+SCHEDULE.map(function(r){return '<div class="r"><span class="t">'+r[0]+'</span><span><span style="font-weight:600">'+r[1]+'</span><span style="display:block;font-size:12px;color:var(--ink2)">'+r[3]+'</span></span><span class="mn">'+r[2].toUpperCase()+'</span></div>';}).join('')+'</div></div>'
 +'<div><div class="sec-t"><h2 style="font-size:26px">Hosts</h2></div>'+[['Mara Voss','The Last Hour','Former club resident; plays records like secrets.'],['K. Adeyemi','New Voices Hour','Scouts three continents a month.'],['DJ Halide','After-Hours Pulse','Four-to-the-floor, always below 122 BPM.']].map(function(x){return '<div style="display:flex;gap:16px;padding:16px 0;border-top:1px solid var(--line)"><span class="ibtn" style="border-radius:50%">'+ic('mic',16)+'</span><div><div style="font-weight:600">'+x[0]+'</div><div class="mn" style="margin:4px 0">'+x[1].toUpperCase()+'</div><div style="font-size:13px;color:var(--ink2)">'+x[2]+'</div></div></div>';}).join('')+'</div></div></section>';
 h+='<section class="sec" style="padding-top:0"><div class="wrap">'+railHead('01','SONORA Podcasts');
 h+='<div class="rail">'+[['The Listening Room','Weekly · 45 min','Long conversations about records.'],['Tape Hiss','Biweekly · 30 min','The analog world, reported.'],['Night Freight','Monthly · 60 min','Field recordings, narrated.']].map(function(p){return '<button class="acard" data-a="toast" data-msg="Podcasts — demo concept" data-rv><span class="im" style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:var(--panel)">'+ic('mic',34)+'</span><span class="t">'+p[0]+'</span><span class="s">'+p[1]+'</span><span class="g">'+p[2]+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgEvents(){
 var list=EVENTS.filter(function(e){return (S.evCity==='all'||e.c===S.evCity)&&(S.evG==='all'||e.g===S.evG);});
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">EVENTS</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Out tonight.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:30px" data-rv><div class="chips">'+['all','Lisbon','Paris','Berlin','Oslo','Reykjavík'].map(function(c){return '<button class="chip '+(S.evCity===c?'on':'')+'" data-a="evcity" data-v="'+c+'">'+c+'</button>';}).join('')+'</div><div class="chips">'+['all','Electronic','Jazz','Soul','Folk','Ambient'].map(function(c){return '<button class="chip '+(S.evG===c?'on':'')+'" data-a="evg" data-v="'+c+'">'+c+'</button>';}).join('')+'</div></div>';
 h+=list.map(function(e){var p=e.d.split('.');return '<button class="evcard" data-a="event" data-id="'+e.id+'" data-rv><span class="d"><span class="mm">'+['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][+p[1]-1]+'</span><span class="dd">'+p[0]+'</span></span><span><span class="t">'+esc(e.t)+'</span><span class="s">'+e.v+' · '+e.c+' · '+e.time+' · '+e.g+'</span></span><span class="btn sm">'+e.pr+'</span></button>';}).join('')||'<p class="it" style="color:var(--mut)">Nothing matches — try another city.</p>';
 h+='</div></section>';
 return h;
}
function pgEvent(id){
 var e=null;EVENTS.forEach(function(x){if(x.id===id)e=x;});var a=artist(e.a);
 var h='<div class="wrap" style="padding-top:110px;max-width:1000px"><span class="mn" data-rv><span class="ac">EVENT</span> — '+e.g.toUpperCase()+'</span><h1 class="serif" data-rv style="font-size:clamp(32px,4.6vw,58px);font-weight:400;margin-top:14px;line-height:1.06">'+esc(e.t)+'</h1>'
 +'<div style="border-radius:14px;overflow:hidden;margin:34px 0" data-rv><img src="'+e.img+'" alt="" style="width:100%;aspect-ratio:21/9;object-fit:cover"></div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:50px" data-rv><div><div class="mn" style="margin-bottom:12px">DETAILS</div>'+[['Artist',a.name],['Venue',e.v],['City',e.c],['Date',e.d],['Time',e.time],['From',e.pr]].map(function(r){return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line);font-size:14px"><span style="color:var(--mut)">'+r[0]+'</span><span>'+r[1]+'</span></div>';}).join('')
 +'<div style="display:flex;gap:12px;margin-top:26px"><button class="btn solid" data-a="tickets">'+ic('cal',14)+' Tickets</button><button class="btn" data-a="artist" data-id="'+e.a+'">About the artist</button></div></div>'
 +'<div><div class="mn" style="margin-bottom:12px">ABOUT</div><p class="it" style="color:var(--ink2);font-size:16px;line-height:1.8">'+esc(e.desc)+'</p><div class="mn" style="margin:26px 0 12px">VENUE SOUND PROFILE</div><p style="font-size:13.5px;color:var(--ink2)">Warm low end, controlled reverbs, hearing-loop equipped. Quiet room available.</p></div></div></div>';
 return h;
}
function pgPlaylists(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">PLAYLISTS</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Editorial playlists.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Moods, curated by humans.</p><div style="margin-top:24px" data-rv><button class="btn" data-a="new-pl">'+ic('plus',14)+' Create playlist</button><button class="btn" data-a="nav" data-p="smart" style="margin-left:10px">'+ic('glow',14)+' Smart selection</button></div></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap"><div class="rail">'+PLAYLISTS.map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'" data-cur="PLAY" data-rv><span class="im"><img src="'+p.img+'" alt="" loading="lazy"><span class="pb">'+ic('play',16)+'</span></span><span class="t">'+esc(p.t)+'</span><span class="s">'+p.tracks.length+' tracks · '+esc(p.cur)+'</span><span class="g">'+esc(p.d)+'</span></button>';}).join('')+'</div></div></section>';
 return h;
}
function pgPlaylist(id){
 var p=playlist(id);var total=p.tracks.reduce(function(x,r){return x+durS(trackRef(r).d);},0);
 var h='<div class="wrap" style="padding-top:100px"><div class="al-hero" style="min-height:auto"><div class="art" data-rv style="max-width:340px"><img src="'+p.img+'" alt=""></div><div data-rv style="--d:.1s"><span class="mn"><span class="ac">PLAYLIST</span> — CURATED BY '+esc(p.cur).toUpperCase()+'</span><h1 style="font-size:clamp(34px,4.6vw,64px);margin-top:14px">'+esc(p.t)+'</h1><p class="it" style="color:var(--ink2);margin-top:12px">'+esc(p.d)+'</p><div class="chips" style="margin:20px 0"><span class="chip" style="pointer-events:none">'+p.tracks.length+' tracks</span><span class="chip" style="pointer-events:none">'+fmt(total)+'</span></div><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn solid" data-a="play-pl" data-id="'+p.id+'">'+ic('play',14)+' Play</button><button class="btn" data-a="save-pl" data-id="'+p.id+'">'+(S.savedPl[id]?'Saved ✓':'Save')+'</button><button class="btn" data-a="share">'+ic('share',14)+' Share</button></div></div></div>'
 +'<div style="max-width:760px;margin-top:30px">'+p.tracks.map(function(r){var tr=trackRef(r);return '<div class="trow" data-ref="'+r+'"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span><span class="ta"> — '+esc(artist(tr.al.a).name)+'</span></span><span class="acts"><button class="ibtn" style="width:32px;height:32px" data-a="like" data-ref="'+r+'">'+ic(S.likes[r]?'heartF':'heart',15)+'</button></span><span class="d">'+tr.d+'</span></div>';}).join('')+'</div></div>';
 return h;
}
function pgSmart(){
 var sm=S.smart;
 var res=[['ms:2','Reflective + late night'],['fa:0','Low energy, ambient floor'],['nr:3','City at 2am'],['vh:2','Warmth for reading'],['pc:6','A quiet ending']];
 var mins=res.reduce(function(x,r){return x+durS(trackRef(r[0]).d);},0);
 var h='<div class="wrap" style="padding-top:110px;max-width:900px"><span class="mn" data-rv><span class="ac">SMART SELECTION</span></span><h1 class="serif" data-rv style="font-size:clamp(34px,4.6vw,56px);font-weight:400;margin-top:12px">Tell us the night.<br>We’ll bring the sound.</h1>'
 +'<div style="margin-top:36px;display:grid;gap:22px" data-rv>'
 +[['Mood',['Reflective','Warm','Restless','Melancholic','Hopeful'],'mood'],['Time',['Early morning','Afternoon','Evening','Late night'],'time'],['Activity',['Reading','Working','Walking','Driving','Falling asleep'],'act'],['Energy',['Low','Medium','High'],'en']].map(function(g){return '<div><div class="mn" style="margin-bottom:10px">'+g[0].toUpperCase()+'</div><div class="chips">'+g[1].map(function(o){return '<button class="chip '+(sm[g[2]]===o?'on':'')+'" data-a="smart" data-k="'+g[2]+'" data-v="'+o+'">'+o+'</button>';}).join('')+'</div></div>';}).join('')+'</div>'
 +'<div style="margin-top:40px;border:1px solid var(--acc);border-radius:16px;padding:28px" data-rv><div class="mn"><span class="ac">YOUR SELECTION</span></div><h2 class="serif" style="font-size:clamp(24px,3vw,36px);font-weight:400;margin-top:10px">Your '+Math.round(mins/60)+'-minute '+sm.time.toLowerCase()+' selection</h2><p class="it" style="color:var(--ink2);margin-top:8px">'+sm.mood+', '+sm.act.toLowerCase()+', '+sm.en.toLowerCase()+' energy.</p>'
 +'<div style="margin-top:20px">'+res.map(function(r){var tr=trackRef(r[0]);return '<div class="trow" data-ref="'+r[0]+'"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span><span class="ta"> — '+esc(artist(tr.al.a).name)+'</span></span><span class="why" style="margin:0">'+r[1]+'</span><span class="d">'+tr.d+'</span></div>';}).join('')+'</div>'
 +'<div style="margin-top:22px;display:flex;gap:12px"><button class="btn solid" data-a="play-pl-list" data-refs="'+res.map(function(r){return r[0];}).join(',')+'">'+ic('play',14)+' Play selection</button><button class="btn" data-a="save-pl-gen">Save as playlist</button></div></div></div>';
 return h;
}
function pgGenres(){
 var g=null;GENRES.forEach(function(x){if(x.id===S.genre)g=x;});
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">GENRES</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">A map of listening.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px" class="gwrap">'+GENRES.map(function(x){return '<button class="gtile" data-a="genre" data-id="'+x.id+'" data-rv><span class="n">'+x.n+'</span><span class="sub">'+x.sub.join(' · ')+'</span></button>';}).join('')+'</div>'
 +'<style>@media(max-width:1000px){.gwrap{grid-template-columns:1fr 1fr!important}}@media(max-width:560px){.gwrap{grid-template-columns:1fr!important}}</style>'
 +'<div style="margin-top:60px;border:1px solid var(--line);border-radius:16px;padding:34px" data-rv><div class="mn"><span class="ac">'+g.n.toUpperCase()+'</span></div><p class="it" style="color:var(--ink2);font-size:17px;margin-top:12px;max-width:560px">'+g.blurb+'</p>'
 +'<div class="mn" style="margin:26px 0 12px">SUBGENRES</div><div class="chips">'+g.sub.map(function(s){return '<span class="chip" style="pointer-events:none">'+s+'</span>';}).join('')+'</div>'
 +'<div class="mn" style="margin:26px 0 12px">RELATED</div><div class="chips">'+g.rel.map(function(r){var rg=null;GENRES.forEach(function(x){if(x.id===r)rg=x;});return '<button class="chip" data-a="genre" data-id="'+r+'">'+rg.n+'</button>';}).join('')+'</div>'
 +'<div class="mn" style="margin:26px 0 14px">LISTEN</div><div class="rail">'+ALBUMS.filter(function(a){return a.g.toLowerCase().indexOf(g.n.toLowerCase().slice(0,4))>-1;}).slice(0,4).map(function(a){return albumCard(a,'sm');}).join('')+'</div></div></div></section>';
 return h;
}
function pgHistory(){
 var d=HISTORY[S.decade];
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">ARCHIVE</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">A history of sound.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="chips" style="margin-bottom:40px" data-rv>'+HISTORY.map(function(x,i){return '<button class="chip '+(S.decade===i?'on':'')+'" data-a="decade" data-v="'+i+'">'+x.y+'</button>';}).join('')+'</div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:60px" data-rv><div><div class="serif" style="font-size:clamp(60px,8vw,120px);color:var(--acc);line-height:1">'+d.y+'</div><div class="mn" style="margin:20px 0 10px">GENRES</div><div class="chips">'+d.g.map(function(x){return '<span class="chip" style="pointer-events:none">'+x+'</span>';}).join('')+'</div><div class="mn" style="margin:24px 0 8px">CULTURAL MOMENT</div><p class="it" style="color:var(--ink2);font-size:17px">'+d.m+'</p></div>'
 +'<div><div class="mn" style="margin-bottom:8px">TECHNOLOGY</div><div style="font-family:var(--serif);font-size:26px">'+d.t+'</div><p style="color:var(--ink2);margin-top:8px">'+d.a+'</p><div class="mn" style="margin:26px 0 12px">THE TECHNOLOGY OF MUSIC</div><div class="tl">'+TECH.map(function(t){return '<div class="it2"><div class="y" style="font-size:20px">'+t[0]+'</div><div style="font-weight:600;margin-top:2px">'+t[1]+'</div><div style="font-size:13px;color:var(--ink2)">'+t[2]+'</div></div>';}).join('')+'</div></div></div></div></section>';
 return h;
}
function pgAbout(){
 var h='<div class="wrap" style="padding-top:120px;max-width:900px"><span class="mn" data-rv><span class="ac">ABOUT</span></span><h1 class="serif" data-rv style="font-size:clamp(38px,5.6vw,76px);font-weight:400;margin-top:14px;line-height:1.05">Music is not content.<br>It is <em style="color:var(--acc)">culture.</em></h1>'
 +'<p class="it" style="color:var(--ink2);font-size:clamp(16px,2vw,20px);margin-top:26px" data-rv>SONORA is a home for people who love music — a place to discover, read, listen and belong. Not a slot machine for songs.</p></div>';
 h+='<section class="sec" style="padding-top:40px"><div class="wrap"><div class="kv" data-rv><div><div class="v">2022</div><div class="l">Founded</div></div><div><div class="v">46</div><div class="l">Artists championed</div></div><div><div class="v">312</div><div class="l">Stories published</div></div><div><div class="v">18</div><div class="l">Sessions recorded</div></div></div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:60px" class="princ">'
 +[['Listen first','Every recommendation is heard by a person before it reaches you.'],['Explain discovery','We tell you why you’re hearing something. No black boxes.'],['Pay artists fairly','Transparent streams, fair splits, early payouts.'],['Keep the quiet','No autoplay traps, no infinite rage. Listening is a choice.']].map(function(p,i){return '<div data-rv style="--d:'+(i*.07)+'s;border-top:1px solid var(--line);padding-top:20px"><span class="mn"><span class="ac">0'+(i+1)+'</span></span><div class="serif" style="font-size:24px;margin-top:10px">'+p[0]+'</div><p style="color:var(--ink2);margin-top:8px">'+p[1]+'</p></div>';}).join('')+'</div>'
 +'<style>@media(max-width:800px){.princ{grid-template-columns:1fr!important}}</style>'
 +'<div style="margin-top:70px">'+railHead('01','What people say')+'<div class="rail">'+[['“The only streaming service that feels like a bookstore.”','Mono Magazine'],['“Editorial curation with a conscience.”','The Listening Post'],['“Sessions alone are worth it.”','Field Notes']].map(function(q){return '<div class="stcard" style="width:300px" data-rv><div class="it" style="font-size:18px;line-height:1.5">'+q[0]+'</div><div class="mn" style="margin-top:16px">'+q[1].toUpperCase()+'</div></div>';}).join('')+'</div></div>'
 +'<div style="margin-top:60px">'+railHead('02','The people')+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px" class="team">'+[['Lena Okafor','Editor-in-chief'],['R. Feld','Head of music'],['K. Adeyemi','Radio & new voices'],['M. Duarte','Culture desk']].map(function(t,i){return '<div data-rv style="--d:'+(i*.06)+'s;border-top:1px solid var(--line);padding-top:16px"><div class="serif" style="font-size:22px">'+t[0]+'</div><div class="mn" style="margin-top:6px">'+t[1].toUpperCase()+'</div></div>';}).join('')+'</div><style>@media(max-width:700px){.team{grid-template-columns:1fr!important}}</style></div></div></section>';
 return h;
}
function pgLibrary(){
 var t=S.libTab;
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">LIBRARY</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Your library.</h1></div>';
 h+='<section class="sec" style="padding-top:26px"><div class="wrap"><div class="chips" style="margin-bottom:34px" data-rv>'+[['liked','Liked tracks'],['albums','Albums'],['artists','Artists'],['playlists','Playlists'],['hist','History'],['stories','Saved stories']].map(function(x){return '<button class="chip '+(t===x[0]?'on':'')+'" data-a="libtab" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
 if(t==='liked'){var ks=Object.keys(S.likes).filter(function(k){return S.likes[k];});
  h+=ks.length?ks.map(function(r){var tr=trackRef(r);return trackRow(tr.al,tr.i,true);}).join(''):'<div style="padding:60px 0;text-align:center"><div class="mn">EMPTY</div><p class="it" style="color:var(--mut);margin-top:10px">Nothing liked yet. Tap the heart on any track.</p></div>';}
 if(t==='albums'){S.savedAlb=S.savedAlb||{};var aks=Object.keys(S.savedAlb).filter(function(k){return S.savedAlb[k];});
  h+=aks.length?'<div class="mgrid">'+aks.map(function(id,i){return albumCard(album(id),i%2?'c2':'c3');}).join('')+'</div>':'<div style="padding:60px 0;text-align:center"><div class="mn">EMPTY</div><p class="it" style="color:var(--mut);margin-top:10px">Save an album from its page to see it here.</p></div>';}
 if(t==='artists'){var keys=Object.keys(ARTISTS).sort(function(a,b){return (S.follows[b]?1:0)-(S.follows[a]?1:0);});
  h+='<div class="rail">'+keys.map(function(k){var a=ARTISTS[k];return '<button class="acard sm" data-a="artist" data-id="'+k+'" data-cur="VIEW"><span class="im" style="border-radius:50%"><img src="'+a.img+'" alt="" loading="lazy"></span><span class="t" style="font-size:13px">'+esc(a.name)+'</span><span class="s">'+(S.follows[k]?'Following':'Artist')+'</span></button>';}).join('')+'</div>';}
 if(t==='playlists'){h+='<div class="rail">'+(Object.keys(S.savedPl).length?PLAYLISTS.filter(function(p){return S.savedPl[p.id];}).map(function(p){return '<button class="acard" data-a="playlist" data-id="'+p.id+'"><span class="im"><img src="'+p.img+'" alt=""></span><span class="t">'+esc(p.t)+'</span></button>';}).join(''):'<p class="it" style="color:var(--mut)">No saved playlists yet.</p>')+'</div>';}
 if(t==='hist'){h+=S.hist.length?S.hist.slice(0,10).map(function(r){var tr=trackRef(r);return '<div class="trow" data-ref="'+r+'"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span><span class="ta"> — '+esc(artist(tr.al.a).name)+'</span></span><span></span><span class="d">'+tr.d+'</span></div>';}).join(''):'<p class="it" style="color:var(--mut)">No history yet.</p>';}
 if(t==='stories'){h+='<div class="rail">'+STORIES.slice(0,3).map(storyCard).join('')+'</div>';}
 h+='</div></section>';
 return h;
}
function pgStats(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">2026 SO FAR</span></span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Your year in listening.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>Not a wrap. A portrait.</p></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap"><div class="kv" data-rv><div><div class="v">48,214</div><div class="l">Minutes listened</div></div><div><div class="v" style="color:var(--acc)">Aurora Vale</div><div class="l">Top artist</div></div><div><div class="v">Midnight Signals</div><div class="l" style="font-size:8px">Top album</div></div><div><div class="v">23:40</div><div class="l">Favorite hour</div></div></div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:60px"><div data-rv><div class="mn" style="margin-bottom:16px">TOP ARTISTS</div>'+[['Aurora Vale',92],['Elias Grey',64],['Nia Sol',51],['Sora June',38],['Vera Lune',26]].map(function(x){return '<div class="bar-row"><span style="font-size:13px">'+x[0]+'</span><span class="b"><i data-w="'+x[1]+'"></i></span><span class="v">'+x[1]+'</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 16px">GENRES</div>'+[['Ambient / Electronic',44],['Soul / Jazz',26],['Indie / Folk',18],['Hip-hop',12]].map(function(x){return '<div class="bar-row"><span style="font-size:13px">'+x[0]+'</span><span class="b"><i data-w="'+x[1]+'"></i></span><span class="v">'+x[1]+'%</span></div>';}).join('')+'</div>'
 +'<div data-rv style="--d:.1s"><div class="mn" style="margin-bottom:16px">DAYS</div>'+[['Mon',34],['Tue',41],['Wed',38],['Thu',56],['Fri',72],['Sat',88],['Sun',61]].map(function(x){return '<div class="bar-row"><span style="font-size:13px">'+x[0]+'</span><span class="b"><i data-w="'+x[1]+'"></i></span><span class="v">'+x[1]+'</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 14px">LISTENING CLOCK</div>'
 +'<svg viewBox="0 0 200 200" style="width:220px;display:block;margin:0 auto">'+(function(){var s='';for(var i=0;i<24;i++){var a=(i/24)*Math.PI*2-Math.PI/2;var on=(i>=20||i<2);var x1=100+Math.cos(a)*70,y1=100+Math.sin(a)*70,x2=100+Math.cos(a)*86,y2=100+Math.sin(a)*86;s+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(on?'var(--acc)':'var(--line2)')+'" stroke-width="4" stroke-linecap="round"/>';}return s;})()+'<text x="100" y="96" text-anchor="middle" fill="var(--ink)" font-family="Fraunces" font-size="20">22–02</text><text x="100" y="116" text-anchor="middle" fill="var(--mut)" font-family="IBM Plex Mono" font-size="8" letter-spacing="2">PEAK HOURS</text></svg>'
 +'<p class="it" style="color:var(--ink2);margin-top:20px;text-align:center">You discovered <b style="color:var(--ink)">31 new artists</b> this year. Favorite day: <b style="color:var(--ink)">Saturday</b>. Most while <b style="color:var(--ink)">reading</b>.</p></div></div></div></section>';
 return h;
}
function pgStudio(){
 var h='<div class="wrap" style="padding-top:110px"><span class="mn" data-rv><span class="ac">ARTIST STUDIO</span> — DEMO DATA</span><h1 class="serif" data-rv style="font-size:clamp(36px,5vw,64px);font-weight:400;margin-top:10px">Aurora Vale — studio.</h1><p class="it" style="color:var(--ink2);margin-top:8px" data-rv>SONORA is also an artist platform.</p><div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap" data-rv><button class="btn solid" data-a="upload">'+ic('up',14)+' Upload release</button><button class="btn" data-a="toast" data-msg="Label dashboard — demo concept">Label dashboard</button></div></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap"><div class="kv" data-rv><div><div class="v">1,284,112</div><div class="l">Streams · 90d</div></div><div><div class="v">312,408</div><div class="l">Monthly listeners</div></div><div><div class="v">41%</div><div class="l">Via discovery</div></div><div><div class="v">€4,812</div><div class="l">Revenue · 90d</div></div></div>'
 +'<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:60px;margin-top:56px"><div data-rv><div class="mn" style="margin-bottom:14px">REVENUE — 6 MONTHS</div>'+[['May',42],['Jun',55],['Jul',61],['Aug',58],['Sep',74],['Oct',88]].map(function(x){return '<div class="bar-row"><span style="font-size:13px">'+x[0]+'</span><span class="b"><i data-w="'+x[1]+'"></i></span><span class="v">€'+Math.round(x[1]*55)+'</span></div>';}).join('')
 +'<div class="mn" style="margin:30px 0 14px">TOP TRACKS</div>'+album('ms').tracks.slice(0,5).map(function(tr,i){return '<div class="bar-row" style="grid-template-columns:24px 130px 1fr 70px"><span class="mn">'+(i+1)+'</span><span style="font-size:13px">'+(tr.t||tr[0])+'</span><span class="b"><i data-w="'+(95-i*14)+'"></i></span><span class="v">'+(312-i*41)+'k</span></div>';}).join('')
 +'<div class="mn" style="margin:30px 0 14px">RELEASES</div><div class="chips" style="margin-bottom:16px">'+['Drafts','Scheduled','Published','Archived'].map(function(x){return '<button class="chip '+(S.relTab===x?'on':'')+'" data-a="reltab" data-v="'+x+'">'+x+'</button>';}).join('')+'</div>'
 +(S.relTab==='Published'?ALBUMS.filter(function(a){return a.a==='aurora';}).map(function(a){return '<div style="display:flex;gap:14px;align-items:center;padding:12px 0;border-top:1px solid var(--line)"><img src="'+a.img+'" style="width:46px;height:46px;border-radius:8px;object-fit:cover"><div style="flex:1"><div style="font-weight:600">'+a.t+'</div><div style="font-size:12px;color:var(--ink2)">'+a.y+' · '+a.tracks.length+' tracks</div></div><span style="font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--acc)">LIVE</span></div>';}).join('')
 :S.relTab==='Scheduled'?'<div style="display:flex;gap:14px;align-items:center;padding:12px 0;border-top:1px solid var(--line)"><img src="'+IMG.STUDIO+'" style="width:46px;height:46px;border-radius:8px;object-fit:cover"><div style="flex:1"><div style="font-weight:600">Dawn Chorus — Single</div><div style="font-size:12px;color:var(--ink2)">Releases 20.02.2027 · all territories</div></div><span style="font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--acc)">SCHEDULED</span></div>'
 :S.relTab==='Drafts'?'<div style="padding:14px 0;border-top:1px solid var(--line);font-size:13px;color:var(--ink2)">3 untitled demos · last saved today 03:12</div>'
 :'<div style="padding:14px 0;border-top:1px solid var(--line);font-size:13px;color:var(--ink2)">Early EPs (2021) — archived at your request.</div>')
 +'</div>'
 +'<div data-rv style="--d:.1s"><div class="mn" style="margin-bottom:14px">AUDIENCE</div>'+[['Portugal',38],['Germany',22],['Japan',14],['UK',11],['Other',15]].map(function(x){return '<div class="bar-row"><span style="font-size:13px">'+x[0]+'</span><span class="b"><i data-w="'+x[1]+'"></i></span><span class="v">'+x[1]+'%</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 14px">DISCOVERY SOURCES</div>'+[['Editorial playlists',44],['Radio',21],['Search',14],['Algorithmic mixes',12],['Direct',9]].map(function(x){return '<div class="bar-row"><span style="font-size:13px">'+x[0]+'</span><span class="b"><i data-w="'+x[1]+'"></i></span><span class="v">'+x[1]+'%</span></div>';}).join('')
 +'<div class="mn" style="margin:26px 0 14px">PLAYLIST PLACEMENTS</div>'+[['2AM / ALONE IN THE CITY','3 tracks'],['WORK / DEEP FOCUS','2 tracks'],['NEW VOICES','1 track']].map(function(x){return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span>'+x[0]+'</span><span style="color:var(--ink2)">'+x[1]+'</span></div>';}).join('')+'</div></div></div></section>';
 return h;
}
function pgMembership(){
 var h='<div class="wrap" style="padding-top:110px;max-width:1100px"><span class="mn" data-rv><span class="ac">MEMBERSHIP</span></span><h1 class="serif" data-rv style="font-size:clamp(38px,5.4vw,72px);font-weight:400;margin-top:12px">Listen deeper,<br>with <em style="color:var(--acc)">SONORA+</em>.</h1></div>';
 h+='<section class="sec" style="padding-top:30px"><div class="wrap"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px" class="memg">'+[['Free','€0',['Catalog with occasional interruptions','Standard quality','Radio & journal']],['SONORA+','€9 / mo',['High-quality & lossless audio','Offline listening','Exclusive sessions','Early event access','Editorial collections']],['Artist','€4 / mo',['Everything in Free','Artist studio & analytics','Uploads & releases','Audience insights']],['Business','€49 / mo',['Venue & brand accounts','Curated in-space radio','Campaign tools']]].map(function(p,i){return '<div class="pcard" data-rv style="--d:'+(i*.07)+'s"><span class="mn">'+(i===1?'<span class="ac">MOST LOVED</span>':'PLAN')+'</span><div class="n" style="margin-top:10px">'+p[0]+'</div><div class="pr">'+p[1]+'</div><ul>'+p[2].map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul><button class="btn '+(i===1?'acc':'')+'" data-a="toast" data-msg="'+p[0]+' — demo checkout" style="width:100%;justify-content:center">Choose</button></div>';}).join('')+'</div><style>@media(max-width:1000px){.memg{grid-template-columns:1fr 1fr!important}}@media(max-width:600px){.memg{grid-template-columns:1fr!important}}</style></div></section>';
 return h;
}
/* RENDER */
var PAGES={home:pgHome,discover:pgDiscover,music:pgMusic,charts:pgCharts,album:pgAlbum,artists:pgArtists,artist:pgArtist,stories:pgStories,story:pgStory,live:pgLive,session:pgSession,radio:pgRadio,events:pgEvents,event:pgEvent,playlists:pgPlaylists,playlist:pgPlaylist,smart:pgSmart,genres:pgGenres,history:pgHistory,about:pgAbout,library:pgLibrary,stats:pgStats,studio:pgStudio,membership:pgMembership};
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
 var links=[['discover','Discover'],['music','Music'],['artists','Artists'],['stories','Stories'],['live','Live'],['radio','Radio'],['events','Events'],['charts','Charts']];
 $('#nav').innerHTML='<button class="brand" data-a="nav" data-p="home"><i></i>SONORA</button><nav class="nav-c">'+links.map(function(l){return '<button class="'+(S.page===l[0]?'on':'')+'" data-a="nav" data-p="'+l[0]+'">'+l[1]+'</button>';}).join('')+'</nav><div class="nav-r"><button class="ib" data-a="search" aria-label="Search">'+ic('search',17)+'</button><button class="txt" data-a="nav" data-p="library">Library</button><button class="ib" data-a="nav" data-p="stats" aria-label="Profile">'+ic('user',17)+'</button></div>';
}
function renderMnav(){
 $('#mnav').innerHTML=[['home','home','Home'],['search','search','Search'],['library','lib','Library'],['radio','radio','Radio'],['stats','user','Profile']].map(function(x){return '<button class="'+(S.page===x[0]?'on':'')+'" data-a="'+(x[0]==='search'?'search':'nav')+'" data-p="'+x[0]+'">'+ic(x[1],18)+x[2]+'</button>';}).join('');
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
 +'<div class="art" data-a="player-open"><img src="'+nt.al.img+'" alt=""></div>'
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
 var nt=nowTrack();if(!nt){play('ms',0);nt=nowTrack();}
 var a=artist(nt.al.a);var P=$('#player');
 P.classList.add('open');P.classList.toggle('playing',S.playing.on);
 var tabs=['queue','lyrics','credits'];
 P.innerHTML='<div class="pbg"><img src="'+nt.al.img+'" alt=""></div><div class="pin">'
 +'<div class="top"><button class="ibtn" style="border:none" data-a="player-close" aria-label="Close">'+ic('down',20)+'</button><span class="mn">'+(S.playing.ctx==='radio'?'RADIO':'NOW PLAYING')+' — '+esc(nt.al.t).toUpperCase()+'</span><button class="ibtn '+(S.ambient?'fill':'')+'" style="'+(S.ambient?'':'border:none')+'" data-a="ambient" aria-label="Ambient mode">'+ic('glow',18)+'</button></div>'
 +'<div class="mid"><div class="art"><img src="'+nt.al.img+'" alt="'+esc(nt.al.t)+' artwork"></div>'
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
 +'<div class="tabbody" id="ptabBody">'+ptabHTML()+'</div></div>';
 startWave();setTimeout(function(){bindSeekBars();bindVolTrack();},80);
}
function ptabHTML(){
 if(S.ptab==='queue'){var nt=nowTrack();
  if(!nt)return '<p class="it" style="color:var(--mut)">Nothing playing.</p>';
  var up=nt.al.tracks.slice(S.playing.i+1,S.playing.i+6);
  var h='<div class="mn" style="margin-bottom:10px">UP NEXT — '+esc(nt.al.t).toUpperCase()+'</div>';
  if(!up.length) h+='<p class="it" style="color:var(--mut);margin-bottom:12px">End of album'+(S.repeat==='all'?' — will restart':'')+'.</p>';
  else h+=up.map(function(t,i){var idx=S.playing.i+1+i;var ref=nt.al.id+':'+idx;return '<div class="trow" data-a="play-ref" data-ref="'+ref+'" role="button" tabindex="0"><span class="n">'+(idx+1<10?'0':'')+(idx+1)+'</span><span><span class="tt">'+esc(t.t||'')+'</span></span><span></span><span class="d">'+(t.d||'')+'</span></div>';}).join('');
  if(S.queue.length){h+='<div class="mn" style="margin:14px 0 10px">FROM QUEUE</div>'+S.queue.map(function(r,i){var tr=trackRef(r);return '<div class="trow" data-a="play-ref" data-ref="'+r+'" role="button"><span class="n">'+ic('play',14)+'</span><span><span class="tt">'+esc(tr.t)+'</span></span><span class="acts" style="opacity:1"><button class="ibtn" style="width:30px;height:30px" data-a="queue-rm" data-i="'+i+'" aria-label="Remove" onclick="event.stopPropagation()">'+ic('x',13)+'</button></span><span class="d">'+tr.d+'</span></div>';}).join('');}
  else h+='<p class="it" style="color:var(--mut);margin-top:10px">Queue is empty — add tracks with the queue button.</p>';
  return h;}
 if(S.ptab==='lyrics'){var idx=Math.min(LYRICS_MS.length-1,Math.floor(S.playing.t/6));
  return '<div class="mn" style="margin-bottom:12px">LYRICS — SYNCED · EN</div>'+LYRICS_MS.map(function(l,i){return '<div class="lyr '+(i===idx?'on':(i<idx?'past':''))+'" data-a="lyr-jump" data-i="'+i+'">'+l[0]+',<br>'+l[1]+'</div>';}).join('')+'<p class="mn" style="margin-top:18px">ORIGINAL DEMO LYRICS — FICTIONAL</p>';}
 var a=artist(nowTrack().al.a);
 return '<div class="mn" style="margin-bottom:10px">CREDITS</div>'+[['Written by',a.name],['Produced by',a.name+' & J. Ribeiro'],['Performed by',a.name],['Publisher','Sonora Publishing'],['Label','Sonora Records'],['Copyright','℗ & © 2026 Sonora Records — fictional demo'],['Devices','This browser · Living-room speaker (demo)']].map(function(c){return '<div style="display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span style="color:var(--mut)">'+c[0]+'</span><span style="text-align:right">'+c[1]+'</span></div>';}).join('');
}
function closePlayer(){$('#player').classList.remove('open');cancelAnimationFrame(waveRaf);}
function startWave(){
 cancelAnimationFrame(waveRaf);
 var cv=$('#wave');if(!cv)return;
 var dpr=Math.min(2,devicePixelRatio||1);
 var r0=cv.getBoundingClientRect();cv.width=r0.width*dpr;cv.height=56*dpr;cv.getContext('2d').scale(dpr,dpr);
 function draw(now){
  var ctx=cv.getContext('2d');var w=cv.width/dpr,h=56;
  ctx.clearRect(0,0,w,h);
  var nt=nowTrack();var prog=nt?S.playing.t/durS(nt.d):0;
  var acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#D9A441';
  ctx.lineWidth=1.4;
  function path(){ctx.beginPath();for(var x=0;x<=w;x+=3){var p=x/w;var amp=(Math.sin(p*9+(S.playing.on?now/900:0))*0.5+Math.sin(p*23-(S.playing.on?now/1400:0))*0.3+Math.sin(p*47)*0.2);var env=0.35+0.65*Math.sin(p*Math.PI);var y=h/2+amp*env*(h*0.36)*(S.playing.on?1:0.5);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}}
  path();ctx.strokeStyle='rgba(242,238,230,.18)';ctx.stroke();
  ctx.save();ctx.beginPath();ctx.rect(0,0,w*prog,h);ctx.clip();path();ctx.strokeStyle=acc;ctx.stroke();ctx.restore();
  waveRaf=requestAnimationFrame(draw);
 }
 waveRaf=requestAnimationFrame(draw);
}
/* SEARCH */
function openSearch(){
 var ov=$('#searchOv');ov.classList.add('open');
 ov.innerHTML='<div class="in"><div style="display:flex;justify-content:space-between;align-items:center"><span class="mn"><span class="ac">SEARCH</span> — ⌘K</span><button class="ibtn" data-a="search-close" aria-label="Close">'+ic('x',18)+'</button></div><input id="sIn" placeholder="Artists, albums, tracks, stories…" autocomplete="off"><div id="sBody"></div></div>';
 setTimeout(function(){$('#sIn').focus();},80);
 sRender('');
 $('#sIn').addEventListener('input',function(e){sRender(e.target.value);});
}
function closeSearch(){$('#searchOv').classList.remove('open');}
function sRender(q){
 q=(q||'').toLowerCase();
 var B=$('#sBody');if(!B)return;
 if(!q){
  B.innerHTML='<div class="sres-g">Recent</div>'+S.recents.map(function(r){return '<button class="sres-i" data-a="s-set" data-v="'+r+'"><span style="color:var(--mut)">'+ic('clock',16)+'</span><span><span class="t">'+r+'</span></span></button>';}).join('')
  +'<div class="sres-g">Trending</div>'+['midnight signals','ambient','tokyo','jazz noir','new voices'].map(function(r){return '<button class="sres-i" data-a="s-set" data-v="'+r+'"><span style="color:var(--acc)">'+ic('wave',16)+'</span><span><span class="t">'+r+'</span></span></button>';}).join('');
  return;
 }
 var res={Artists:[],Albums:[],Tracks:[],Playlists:[],Stories:[],Events:[]};
 Object.keys(ARTISTS).forEach(function(k){var a=ARTISTS[k];if((a.name+a.g).toLowerCase().indexOf(q)>-1)res.Artists.push({t:a.name,s:a.g,img:a.img,go:function(){nav('artist',k);}});});
 ALBUMS.forEach(function(al){if((al.t+al.g).toLowerCase().indexOf(q)>-1)res.Albums.push({t:al.t,s:artist(al.a).name,img:al.img,go:function(){nav('album',al.id);}});
  al.tracks.forEach(function(tr,i){if((tr.t||'').toLowerCase().indexOf(q)>-1)res.Tracks.push({t:tr.t,s:artist(al.a).name+' — '+al.t,img:al.img,go:function(){play(al.id,i);}});});});
 PLAYLISTS.forEach(function(p){if(p.t.toLowerCase().indexOf(q)>-1)res.Playlists.push({t:p.t,s:p.cur,img:p.img,go:function(){nav('playlist',p.id);}});});
 STORIES.forEach(function(s){if((s.t+s.cat).toLowerCase().indexOf(q)>-1)res.Stories.push({t:s.t,s:s.cat,img:s.img,go:function(){nav('story',s.id);}});});
 EVENTS.forEach(function(e){if((e.t+e.c).toLowerCase().indexOf(q)>-1)res.Events.push({t:e.t,s:e.c+' · '+e.d,img:e.img,go:function(){nav('event',e.id);}});});
 var top=res.Artists[0]||res.Albums[0]||res.Tracks[0];
 var h=top?'<div class="sres-g">Top result</div><button class="sres-i" data-a="s-top" style="border:1px solid var(--line2);border-radius:14px;padding:16px"><img src="'+top.img+'" style="width:64px;height:64px"><span><span class="t" style="font-size:18px">'+esc(top.t)+'</span><span class="s">'+esc(top.s)+'</span></span><span style="margin-left:auto" class="ibtn fill">'+ic('play',16)+'</span></button>':'';
 Object.keys(res).forEach(function(g){if(res[g].length){h+='<div class="sres-g">'+g+'</div>'+res[g].slice(0,4).map(function(r,i){return '<button class="sres-i" data-a="s-go" data-g="'+g+'" data-i="'+i+'"><img src="'+r.img+'"><span><span class="t">'+esc(r.t)+'</span><span class="s">'+esc(r.s)+'</span></span></button>';}).join('');}});
 window._sres=res;
 B.innerHTML=h||'<p class="it" style="color:var(--mut);padding:30px 0">Nothing found for “'+esc(q)+'”. Try “midnight”, “ambient”, “tokyo”.</p>';
}
/* MODAL */
function openModal(html){$('#modal').classList.add('open');$('#modal').innerHTML='<div class="box">'+html+'</div>';}
function closeModal(){$('#modal').classList.remove('open');}
function uploadModal(){
 var steps=['Track','Artwork & metadata','Credits','Release','Preview'];
 openModal('<div style="display:flex;justify-content:space-between;align-items:center"><h3>Upload release</h3><button class="ibtn" data-a="mclose">'+ic('x',16)+'</button></div>'
 +'<div class="chips" style="margin:20px 0">'+steps.map(function(s,i){return '<span class="chip '+(S.upStep===i+1?'on':'')+'" style="pointer-events:none">'+(i+1)+'. '+s+'</span>';}).join('')+'</div>'
 +(S.upStep===1?'<div class="mn" style="margin-bottom:10px">AUDIO FILE</div><div style="border:1px dashed var(--line2);border-radius:12px;padding:40px;text-align:center;color:var(--ink2)"><div style="margin-bottom:10px">'+ic('up',22)+'</div>Drop WAV / AIFF · 24-bit preferred<br><button class="btn sm" style="margin-top:16px" data-a="up-demo">Choose file (demo)</button></div>'
 :S.upStep===2?'<div class="mn" style="margin-bottom:10px">TITLE</div><input class="chip" style="width:100%;border-radius:10px;padding:12px" value="Dawn Chorus"><div class="mn" style="margin:16px 0 10px">GENRE</div><div class="chips">'+['Electronic','Ambient','Alternative'].map(function(g){return '<span class="chip">'+g+'</span>';}).join('')+'</div><div class="mn" style="margin:16px 0 10px">ARTWORK</div><div style="border:1px dashed var(--line2);border-radius:12px;padding:26px;text-align:center;color:var(--ink2)">3000×3000 minimum (demo)</div>'
 :S.upStep===3?'<div class="mn" style="margin-bottom:10px">CREDITS</div>'+[['Writer','Aurora Vale'],['Producer','A. Vale & J. Ribeiro'],['Mastering','K. Brandt']].map(function(c){return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line);font-size:13px"><span style="color:var(--mut)">'+c[0]+'</span><span>'+c[1]+'</span></div>';}).join('')
 :S.upStep===4?'<div class="mn" style="margin-bottom:10px">RELEASE DATE</div><input class="chip" style="width:100%;border-radius:10px;padding:12px" value="2027-02-20"><div class="mn" style="margin:16px 0 10px">TERRITORIES</div><div class="chips"><span class="chip on" style="pointer-events:none">Worldwide</span><span class="chip" style="pointer-events:none">Exclude: —</span></div>'
 :'<div style="border:1px solid var(--line2);border-radius:12px;padding:20px;display:flex;gap:16px;align-items:center"><img src="'+IMG.STUDIO+'" style="width:64px;height:64px;border-radius:8px;object-fit:cover"><div><div style="font-weight:600">Dawn Chorus</div><div style="font-size:12px;color:var(--ink2)">Aurora Vale · Electronic · 20.02.2027 · Worldwide</div></div></div>')
 +'<div style="display:flex;justify-content:space-between;margin-top:24px"><button class="btn sm" data-a="up-back" '+(S.upStep===1?'disabled':'')+'>Back</button><button class="btn sm solid" data-a="up-next">'+(S.upStep===5?'Submit for release':'Next')+'</button></div>');
}
/* CURSOR + INTRO */
(function(){
 if(!FINE||RM)return;
 var cur=$('#cur'),x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;
 addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY;});
 (function loop(){x+=(tx-x)*.2;y+=(ty-y)*.2;cur.style.transform='translate('+x+'px,'+y+'px)';requestAnimationFrame(loop);})();
 document.addEventListener('mouseover',function(e){
  var t=e.target.closest('[data-cur]');
  if(t){cur.classList.add('view');$('#curT').textContent=t.getAttribute('data-cur');}
  else cur.classList.remove('view');});
})();
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
  case 'story':nav('story',t.getAttribute('data-id'));break;
  case 'event':nav('event',t.getAttribute('data-id'));break;
  case 'session':S.sessionPlay=false;nav('session',t.getAttribute('data-id'));break;
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
  case 'ambient':S.ambient=!S.ambient;renderPlayerIfOpen();toast(S.ambient?'Ambient mode on':'Ambient mode off');break;
  case 'sleep':S.sleep=+t.getAttribute('data-v');toast(S.sleep?'Sleep timer set':'Sleep timer off');break;
  case 'ptab':S.ptab=t.getAttribute('data-v');$('#ptabBody').innerHTML=ptabHTML();$$('#player .tabs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-v')===S.ptab);});break;
  case 'lyr-jump':S.playing.t=(+t.getAttribute('data-i'))*6;renderPlayerIfOpen();break;
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
  case 'save-pl-gen':toast('Saved as “Night selection”');break;
  case 'share':toast('Link copied — sonora.fm/share (demo)');break;
  case 'search':openSearch();break;
  case 'search-close':closeSearch();break;
  case 's-set':$('#sIn').value=t.getAttribute('data-v');sRender(t.getAttribute('data-v'));break;
  case 's-go':var g=t.getAttribute('data-g'),i=+t.getAttribute('data-i');closeSearch();window._sres[g][i].go();break;
  case 's-top':var top=(window._sres.Artists[0]||window._sres.Albums[0]||window._sres.Tracks[0]);closeSearch();if(top)top.go();break;
  case 'mfilter':S.tab=t.getAttribute('data-v');render();break;
  case 'sfilter':S.tab=t.getAttribute('data-v');render();break;
  case 'genre':S.genre=t.getAttribute('data-id');render();break;
  case 'decade':S.decade=+t.getAttribute('data-v');render();break;
  case 'evcity':S.evCity=t.getAttribute('data-v');render();break;
  case 'evg':S.evG=t.getAttribute('data-v');render();break;
  case 'libtab':S.libTab=t.getAttribute('data-v');render();break;
  case 'reltab':S.relTab=t.getAttribute('data-v');render();break;
  case 'radio-go':radioPlay(t.getAttribute('data-id'));render();break;
  case 'radio-stop':S.radio=null;try{audioEl.pause();}catch(e){}S.playing.on=false;toast('Radio stopped');renderMini();render();break;
  case 'session-play':S.sessionPlay=!S.sessionPlay;if(S.sessionPlay){play('ms',3,'session');}else{try{audioEl.pause();}catch(e){}S.playing.on=false;renderMini();}render();break;
  case 'clip':toast('Field recording — 0:15 (demo audio)');break;
  case 'tickets':toast('Tickets held — demo checkout');break;
  case 'smart':S.smart[t.getAttribute('data-k')]=t.getAttribute('data-v');render();break;
  case 'new-pl':openModal('<h3>New playlist</h3><div class="mn" style="margin:18px 0 10px">NAME</div><input class="chip" style="width:100%;border-radius:10px;padding:12px" placeholder="e.g. RAIN ON THE WINDOW"><div class="mn" style="margin:16px 0 10px">DESCRIPTION</div><input class="chip" style="width:100%;border-radius:10px;padding:12px" placeholder="What is this for?"><div class="mn" style="margin:16px 0 10px">COVER</div><div class="chips">'+[IMG.ORB,IMG.PC,IMG.TOKYO].map(function(x){return '<img src="'+x+'" style="width:56px;height:56px;border-radius:8px;object-fit:cover;cursor:pointer">';}).join('')+'</div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px"><button class="btn sm" data-a="mclose">Cancel</button><button class="btn sm solid" data-a="pl-create">Create</button></div>');break;
  case 'pl-create':closeModal();toast('Playlist created — add tracks from any album');break;
  case 'upload':S.upStep=1;uploadModal();break;
  case 'up-next':if(S.upStep<5){S.upStep++;uploadModal();}else{closeModal();toast('Submitted — scheduled for 20.02.2027');}break;
  case 'up-back':S.upStep--;uploadModal();break;
  case 'up-demo':toast('dawn_chorus_master_v3.wav attached (demo)');break;
  case 'mclose':closeModal();break;
  case 'mute':toggleMute();break;
  case 'vol-up':setVolume(S.volume+0.1);toast('Volume '+Math.round(S.volume*100)+'%');break;
  case 'vol-dn':setVolume(S.volume-0.1);toast('Volume '+Math.round(S.volume*100)+'%');break;
  case 'shuffle':toggleShuffle();break;
  case 'repeat':cycleRepeat();break;
  case 'shortcuts':shortcutsHelp();break;
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
 if(key==='ArrowUp'){e.preventDefault();setVolume((S.muted?0:S.volume)+0.05);if(S.muted){S.muted=false;audioEl.volume=S.volume;}toast('Volume '+Math.round(S.volume*100)+'%');return;}
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
 // Full player
 if(key==='f'||key==='F'){e.preventDefault();if($('#player').classList.contains('open'))closePlayer();else openPlayer();return;}
 // Help
 if(key==='?'||(e.shiftKey&&key==='/')){e.preventDefault();shortcutsHelp();return;}
 // Jump 0-9 → 0%..90%
 if(key>='0'&&key<='9'){e.preventDefault();seekToRatio(parseInt(key,10)/10);return;}
});
$('#modal').addEventListener('click',function(e){if(e.target.id==='modal')closeModal();});
render();
