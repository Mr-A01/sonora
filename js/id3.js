/* =========================================================
   SONORA — dependency-free ID3v2 tag reader (no libs, no CDN)
   Supports ID3v2.3 and ID3v2.4: TIT2, TPE1, TALB, TYER/TDRC, APIC.
   Handles sync-safe sizes, unsynchronisation, extended headers.

   window.ID3.read(fileUrl)         → Promise<{title,artist,album,year,cover,coverData}>
   window.ID3.readFromFile(File)    → Promise<same>
     cover     = object URL for display (memory friendly)
     coverData = data URL for the localStorage cache (survives reload)
   Never throws — missing/broken tags resolve with null fields.
   ========================================================= */
(function(){
'use strict';

function ss(b,o){ /* 4-byte syncsafe integer */
  return ((b[o]&0x7f)*2097152)+((b[o+1]&0x7f)*16384)+((b[o+2]&0x7f)*128)+(b[o+3]&0x7f);
}
function u32(b,o){return (b[o]*16777216)+(b[o+1]*65536)+(b[o+2]*256)+b[o+3];}

function utf8(b){
  var s='',i=0;
  while(i<b.length){
    var c=b[i++];
    if(c<128){s+=String.fromCharCode(c);}
    else if(c<224&&i<b.length){s+=String.fromCharCode(((c&31)<<6)|(b[i++]&63));}
    else if(c<240&&i+1<b.length){var c2=b[i++],c3=b[i++];s+=String.fromCharCode(((c&15)<<12)|((c2&63)<<6)|(c3&63));}
    else if(i+2<b.length){var d2=b[i++],d3=b[i++],d4=b[i++];var u=((c&7)<<18)|((d2&63)<<12)|((d3&63)<<6)|(d4&63);u-=0x10000;s+=String.fromCharCode(0xD800+(u>>10),0xDC00+(u&1023));}
  }
  return s;
}
function decodeText(bytes,enc){
  try{
    if(!bytes||!bytes.length)return '';
    var s='',i;
    if(enc===1||enc===2){ /* UTF-16 (with/without BOM) */
      var le=true,o=0;
      if(enc===1&&bytes.length>=2){
        if(bytes[0]===0xFF&&bytes[1]===0xFE){le=true;o=2;}
        else if(bytes[0]===0xFE&&bytes[1]===0xFF){le=false;o=2;}
      }
      for(i=o;i+1<bytes.length;i+=2){
        s+=String.fromCharCode(le?bytes[i]+bytes[i+1]*256:bytes[i]*256+bytes[i+1]);
      }
    } else if(enc===3){ /* UTF-8 */
      s=utf8(bytes);
    } else { /* ISO-8859-1 */
      for(i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);
    }
    return s.replace(/\0+$/,'').replace(/^\0+/,'');
  }catch(e){return '';}
}
function unsync(b){ /* remove 0x00 written after 0xFF */
  var out=[],i=0;
  while(i<b.length){
    out.push(b[i]);
    if(b[i]===0xFF&&i+1<b.length&&b[i+1]===0x00){i+=2;}
    else i++;
  }
  return new Uint8Array(out);
}
function nullTags(){
  return {title:null,artist:null,album:null,year:null,cover:null,coverData:null};
}
function parseApic(p){
  if(!p||p.length<5)return null;
  var enc=p[0],i=1,mime='';
  while(i<p.length&&p[i]!==0){mime+=String.fromCharCode(p[i]);i++;}
  i++; /* skip mime NUL */
  if(i>=p.length)return null;
  i++; /* picture type */
  var dataStart;
  if(enc===1||enc===2){
    var j=i;
    while(j+1<p.length){
      if(p[j]===0&&p[j+1]===0){j+=2;break;}
      j+=2;
    }
    dataStart=j;
  }else{
    var k=i;
    while(k<p.length&&p[k]!==0)k++;
    dataStart=k+1;
  }
  if(dataStart>=p.length-1)return null;
  var img=p.subarray(dataStart);
  mime=(mime||'').toLowerCase();
  if(mime==='image/jpg')mime='image/jpeg';
  if(!mime||mime.indexOf('image/')<0){
    if(img[0]===0x89&&img[1]===0x50)mime='image/png';
    else mime='image/jpeg';
  }
  return {mime:mime,bytes:img};
}
function coverUrls(apic){
  return new Promise(function(res){
    if(!apic||!apic.bytes||!apic.bytes.length){res(null);return;}
    try{
      var blob=new Blob([apic.bytes],{type:apic.mime});
      var url=URL.createObjectURL(blob);
      if(typeof FileReader==='undefined'){res({cover:url,coverData:null});return;}
      var fr=new FileReader();
      fr.onload=function(){res({cover:url,coverData:fr.result});};
      fr.onerror=function(){res({cover:url,coverData:null});};
      fr.readAsDataURL(blob);
    }catch(e){res(null);}
  });
}
function parseTag(bytes){
  try{
    if(!bytes||bytes.length<10)return null;
    if(bytes[0]!==0x49||bytes[1]!==0x44||bytes[2]!==0x33)return null; /* "ID3" */
    var ver=bytes[3];
    if(ver!==3&&ver!==4)return null; /* v2.3 / v2.4 only */
    var flags=bytes[5];
    var tagSize=ss(bytes,6);
    var tagEnd=Math.min(bytes.length,10+tagSize);
    var data=bytes.subarray(10,tagEnd),pos=0;
    if(flags&0x80){data=unsync(data);pos=0;} /* tag-level unsynchronisation */
    if(flags&0x40){ /* extended header */
      if(ver===4){var es4=ss(data,0);pos=(es4>0&&es4<data.length)?es4:0;}
      else{var es3=u32(data,0);pos=Math.min(data.length,4+es3);}
    }
    var out=nullTags(),found=0,apic=null;
    while(pos+10<=data.length&&found<40){
      var id=String.fromCharCode(data[pos],data[pos+1],data[pos+2],data[pos+3]);
      if(!/^[A-Z0-9]{4}$/.test(id))break;
      var fsize,fflags=(data[pos+8]*256)+data[pos+9];
      if(ver===4){
        fsize=ss(data,pos+4);
        if(fsize<=0)fsize=u32(data,pos+4); /* non-syncsafe writers */
      }else{
        fsize=u32(data,pos+4);
      }
      pos+=10;
      if(fsize<=0||pos+fsize>data.length)break;
      var payload=data.subarray(pos,pos+fsize);
      if(ver===4&&(fflags&0x02))payload=unsync(payload); /* frame unsync (v2.4) */
      if(id==='TIT2'){out.title=decodeText(payload.subarray(1),payload[0])||out.title;found++;}
      else if(id==='TPE1'){out.artist=decodeText(payload.subarray(1),payload[0])||out.artist;found++;}
      else if(id==='TALB'){out.album=decodeText(payload.subarray(1),payload[0])||out.album;found++;}
      else if(id==='TYER'||id==='TDRC'){
        var y=decodeText(payload.subarray(1),payload[0]);
        out.year=(y||'').slice(0,4)||out.year;found++;
      }
      else if(id==='APIC'&&!apic){apic=parseApic(payload);found++;}
      pos+=fsize;
    }
    return {tags:out,apic:apic,hasTags:found>0};
  }catch(e){return null;}
}
function readFirst(url){
  /* stream just enough of the file for the tag — mp3s can be huge */
  return fetch(url).then(function(r){
    if(!r.ok)throw new Error('http '+r.status);
    if(!r.body||!r.body.getReader)return r.arrayBuffer().then(function(ab){return new Uint8Array(ab);});
    var reader=r.body.getReader(),chunks=[],total=0,need=10,headerDone=false;
    function concat(){
      var out=new Uint8Array(total),o=0;
      for(var i=0;i<chunks.length;i++){out.set(chunks[i],o);o+=chunks[i].length;}
      return out;
    }
    function pump(){
      return reader.read().then(function(res){
        if(res.done){try{reader.cancel();}catch(e){}return concat();}
        chunks.push(res.value);total+=res.value.length;
        if(!headerDone&&total>=10){
          headerDone=true;
          var head=concat();
          if(head[0]===0x49&&head[1]===0x44&&head[2]===0x33){
            need=Math.min(10+ss(head,6),16*1024*1024);
          }else{need=total;} /* no ID3 header — first bytes are enough */
        }
        if(total>=need){try{reader.cancel();}catch(e){}return concat();}
        return pump();
      });
    }
    return pump();
  });
}
function finish(parsed){
  if(!parsed||(!parsed.hasTags&&!parsed.apic))return Promise.resolve(nullTags());
  if(!parsed.apic)return Promise.resolve(parsed.tags);
  return coverUrls(parsed.apic).then(function(cv){
    if(cv){parsed.tags.cover=cv.cover||null;parsed.tags.coverData=cv.coverData||null;}
    return parsed.tags;
  }).catch(function(){return parsed.tags;});
}
function read(url){
  return Promise.resolve()
    .then(function(){return readFirst(url);})
    .then(function(bytes){return finish(parseTag(bytes));})
    .catch(function(){return nullTags();}); /* 404 / CORS / parse failure — never throws */
}
function readFromFile(file){
  try{
    if(!file)return Promise.resolve(null);
    var size=Math.min(file.size,16*1024*1024);
    var blob=file.slice?file.slice(0,size):file;
    if(blob.arrayBuffer){
      return blob.arrayBuffer()
        .then(function(ab){return finish(parseTag(new Uint8Array(ab)));})
        .catch(function(){return null;});
    }
    return new Promise(function(res){
      var fr=new FileReader();
      fr.onload=function(){res(finish(parseTag(new Uint8Array(fr.result))));};
      fr.onerror=function(){res(null);};
      fr.readAsArrayBuffer(blob);
    });
  }catch(e){return Promise.resolve(null);}
}
window.ID3={read:read,readFromFile:readFromFile};
})();