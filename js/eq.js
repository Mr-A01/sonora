/* =========================================================
   SONORA — professional 10-band graphic equalizer (Web Audio)
   Pipeline: MediaElementSource → 10× BiquadFilter (peaking)
             → Preamp Gain → Analyser → Destination

   window.EQ.init(audioEl)        create ctx on first user gesture
   window.EQ.setBand(i, gainDb)   i = 0..9, −15..+15 dB
   window.EQ.setPreamp(db)        −12..+12 dB
   window.EQ.setPreset(name)      Flat…Night / custom presets
   window.EQ.getPreset()          { name, bands, preamp }
   window.EQ.getBands()           [10] current gains
   window.EQ.apply(state)         restore saved object
   window.EQ.analyser             AnalyserNode (visualizer)
   window.EQ.enabled              master bypass boolean
   ========================================================= */
(function(){
'use strict';
var FREQS=[31,62,125,250,500,1000,2000,4000,8000,16000];
var FLBL=['31','62','125','250','500','1k','2k','4k','8k','16k'];
var MIN_DB=-15,MAX_DB=15,PRE_MIN=-12,PRE_MAX=12;
var PRESETS={
 'Flat':[0,0,0,0,0,0,0,0,0,0],
 'Bass Boost':[7,6,4,2,0,0,0,0,0,0],
 'Deep Bass':[12,10,7,4,2,0,0,0,0,0],
 'Sub Bass':[14,12,9,5,2,0,0,0,0,0],
 'Treble':[0,0,0,0,0,0,2,4,6,7],
 'Bright':[0,0,0,0,0,1,3,5,7,9],
 'Vocal':[-3,-2,0,2,4,4,3,1,0,-1],
 'Rock':[5,4,2,0,-1,-1,0,2,4,5],
 'Jazz':[-2,-1,0,1,2,2,1,0,-1,-2],
 'Electronic':[6,5,3,1,0,-1,0,2,5,6],
 'Loudness':[8,7,4,0,-2,-1,0,3,6,8],
 'Vocal+':[-4,-3,-1,3,5,5,4,2,0,-2],
 'Night':[-6,-4,-2,0,1,2,2,1,0,-2]
};
var state={enabled:true,preset:'Flat',bands:[0,0,0,0,0,0,0,0,0,0],preamp:0};
var custom={};
var ctx=null,src=null,filters=[],preNode=null,analyserNode=null;
var audioEl=null,ready=false,open=false,host=null;
var onChange=null;

function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function db2g(db){return Math.pow(10,db/20);}
function loadCustom(){try{custom=JSON.parse(localStorage.getItem('sonora-eq-presets')||'{}')||{};}catch(e){custom={};}}
function saveCustom(){try{localStorage.setItem('sonora-eq-presets',JSON.stringify(custom));}catch(e){}}
function notify(){try{if(typeof onChange==='function')onChange();}catch(e){}}
loadCustom();

function init(el){
  if(ready||!el)return;
  audioEl=el;
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  try{
    ctx=new AC();
    try{src=ctx.createMediaElementSource(el);}catch(e){src=null;}
    if(!src){ctx=null;return;}
    var node=src;
    for(var i=0;i<FREQS.length;i++){
      var f=ctx.createBiquadFilter();
      f.type='peaking';
      f.frequency.value=FREQS[i];
      f.Q.value=1.0;
      f.gain.value=state.enabled?state.bands[i]:0;
      filters.push(f);
      node.connect(f);
      node=f;
    }
    preNode=ctx.createGain();
    preNode.gain.value=state.enabled?db2g(state.preamp):1;
    analyserNode=ctx.createAnalyser();
    analyserNode.fftSize=2048;
    analyserNode.smoothingTimeConstant=0.75;
    node.connect(preNode);
    preNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);
    ready=true;
    if(ctx.state==='suspended'&&ctx.resume)ctx.resume().catch(function(){});
    applyNodes();
  }catch(e){ready=false;}
}
function applyNodes(){
  if(!ready)return;
  var t=ctx.currentTime,on=state.enabled;
  for(var i=0;i<filters.length;i++){
    try{filters[i].gain.setTargetAtTime(on?state.bands[i]:0,t,0.02);}catch(e){filters[i].gain.value=on?state.bands[i]:0;}
  }
  try{preNode.gain.setTargetAtTime(on?db2g(state.preamp):1,t,0.02);}catch(e){preNode.gain.value=on?db2g(state.preamp):1;}
}
function arrEq(a){
  if(!a||a.length!==10)return false;
  for(var i=0;i<10;i++)if(Math.abs(a[i]-state.bands[i])>0.001)return false;
  return true;
}
function matchPreset(){
  var k;
  for(k in PRESETS)if(arrEq(PRESETS[k]))return k;
  for(k in custom)if(custom[k]&&arrEq(custom[k].bands)&&(custom[k].preamp||0)===state.preamp)return k;
  return 'Custom';
}
function setBand(i,gainDb){
  if(i<0||i>9)return;
  state.bands[i]=clamp((+gainDb)||0,MIN_DB,MAX_DB);
  state.preset=matchPreset();
  applyNodes();refreshUI();notify();
}
function setPreamp(db){
  state.preamp=clamp((+db)||0,PRE_MIN,PRE_MAX);
  state.preset=matchPreset();
  applyNodes();refreshUI();notify();
}
function setPreset(name){
  var p=PRESETS[name]||custom[name];
  if(!p)return;
  var bands=Object.prototype.toString.call(p)==='[object Array]'?p:p.bands;
  if(!bands||bands.length!==10)return;
  for(var i=0;i<10;i++)state.bands[i]=clamp((+bands[i])||0,MIN_DB,MAX_DB);
  state.preamp=clamp(p.bands?(+p.preamp||0):0,PRE_MIN,PRE_MAX);
  state.preset=name;
  applyNodes();refreshUI();notify();
}
function setEnabled(b){
  state.enabled=!!b;
  applyNodes();refreshUI();notify();
}
function saveAsPreset(){
  var name=window.prompt('Save preset as:','My Curve');
  if(!name)return;
  name=String(name).slice(0,40);
  custom[name]={bands:state.bands.slice(),preamp:state.preamp};
  state.preset=name;
  saveCustom();
  if(open&&host)host.innerHTML=panelHTML();
  notify();
}
function restore(o){
  if(!o)return;
  if(typeof o.enabled==='boolean')state.enabled=o.enabled;
  if(o.bands&&o.bands.length===10){
    for(var i=0;i<10;i++)state.bands[i]=clamp((+o.bands[i])||0,MIN_DB,MAX_DB);
  }
  if(typeof o.preamp==='number')state.preamp=clamp(o.preamp,PRE_MIN,PRE_MAX);
  if(o.preset)state.preset=o.preset;
  if(o.custom){for(var k in o.custom)custom[k]=o.custom[k];}
  applyNodes();
  if(open&&host)host.innerHTML=panelHTML();
}
function peakDbAt(gainDb,f0,Q,f,fs){
  var A=Math.pow(10,gainDb/40);
  var w0=2*Math.PI*f0/fs,alpha=Math.sin(w0)/(2*Q);
  var b0=1+alpha*A,b1=-2*Math.cos(w0),b2=1-alpha*A;
  var a0=1+alpha/A,a1=-2*Math.cos(w0),a2=1-alpha/A;
  var w=2*Math.PI*f/fs,cw=Math.cos(w),sw=Math.sin(w);
  var c2w=2*cw*cw-1,s2w=2*sw*cw;
  var nR=b0+b1*cw+b2*c2w,nI=-(b1*sw+b2*s2w);
  var dR=(a0+a1*cw+a2*c2w)/a0,dI=-(a1*sw+a2*s2w)/a0;
  var m=(nR*nR+nI*nI)/(dR*dR+dI*dI);
  if(!(m>0))m=1e-12;
  return 10*Math.log(m)/Math.LN10;
}
function curvePoints(){
  var W=600,H=120,N=120,pts=[],i,b;
  var bands=state.enabled?state.bands:[0,0,0,0,0,0,0,0,0,0];
  var pre=state.enabled?state.preamp:0;
  for(i=0;i<=N;i++){
    var f=20*Math.pow(1000,i/N);
    var db=pre;
    for(b=0;b<10;b++)if(bands[b])db+=peakDbAt(bands[b],FREQS[b],1.0,f,44100);
    var x=(i/N*W).toFixed(1);
    var y=(H/2-clamp(db,-18,18)/18*(H/2-3)).toFixed(1);
    pts.push(x+','+y);
  }
  return pts.join(' ');
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<').replace(/"/g,'"');}
function fmtDb(v){v=Math.round(v*10)/10;return (v>0?'+':'')+v;}
function panelHTML(){
  var h='',i,k,c,on;
  h+='<div class="eq-head">';
  h+='<span class="eq-title">EQUALIZER<span class="eq-sub">10-BAND GRAPHIC</span></span>';
  h+='<span class="sp"></span>';
  h+='<button type="button" class="eq-power'+(state.enabled?' on':'')+'" data-eq="enabled" aria-pressed="'+(state.enabled?'true':'false')+'" aria-label="Enable or bypass the equalizer">'+(state.enabled?'ENABLED':'BYPASS')+'</button>';
  h+='<button type="button" class="eq-close" data-eq="close" aria-label="Close equalizer" title="Close (Esc)">×</button>';
  h+='</div>';
  h+='<div class="eq-chips" role="group" aria-label="EQ presets">';
  var names=[];
  for(k in PRESETS)names.push(k);
  names.push('Custom');
  for(c in custom)if(names.indexOf(c)<0)names.push(c);
  for(i=0;i<names.length;i++){
    on=state.preset===names[i];
    h+='<button type="button" class="eq-chip'+(on?' on':'')+'" data-eq="preset" data-v="'+esc(names[i])+'" aria-pressed="'+(on?'true':'false')+'">'+esc(names[i])+'</button>';
  }
  h+='</div>';
  h+='<svg class="eq-curve" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="Frequency response preview">';
  h+='<line class="eq-zero" x1="0" y1="60" x2="600" y2="60"/><line class="eq-grid" x1="0" y1="4" x2="600" y2="4"/><line class="eq-grid" x1="0" y1="116" x2="600" y2="116"/>';
  h+='<polyline id="eqCurvePts" class="eq-line" points="'+curvePoints()+'"/></svg>';
  h+='<div class="eq-rack">';
  for(i=0;i<10;i++){
    h+='<div class="eq-band"><span class="eq-db'+(Math.abs(state.bands[i])>=2?' hot':'')+'" data-eq-db="'+i+'">'+fmtDb(state.bands[i])+'</span>';
    h+='<div class="eq-slider-wrap"><input type="range" class="eq-slider" min="-15" max="15" step="0.5" value="'+state.bands[i]+'" aria-label="'+FLBL[i]+' hertz gain in decibels" data-eq-band="'+i+'"></div>';
    h+='<span class="eq-fq">'+FLBL[i]+'</span></div>';
  }
  h+='</div>';
  h+='<div class="eq-preamp"><label class="eq-pre-lab" for="eqPre">PREAMP</label><input id="eqPre" class="eq-slider h" type="range" min="-12" max="12" step="0.5" value="'+state.preamp+'" data-eq-preamp aria-label="Preamp gain in decibels"><span class="eq-val" id="eqPreVal">'+fmtDb(state.preamp)+'</span></div>';
  h+='<div class="eq-actions"><button type="button" class="eq-btn" data-eq="reset">RESET</button><button type="button" class="eq-btn solid" data-eq="save">SAVE AS PRESET</button></div>';
  return h;
}
function refreshUI(){
  if(!open||!host)return;
  var i,e;
  for(i=0;i<10;i++){
    e=host.querySelector('[data-eq-band="'+i+'"]');
    if(e&&+e.value!==state.bands[i])e.value=state.bands[i];
    e=host.querySelector('[data-eq-db="'+i+'"]');
    if(e)e.textContent=fmtDb(state.bands[i]);
  }
  e=host.querySelector('[data-eq-preamp]');
  if(e&&+e.value!==state.preamp)e.value=state.preamp;
  e=host.querySelector('#eqPreVal');
  if(e)e.textContent=fmtDb(state.preamp);
  e=host.querySelector('#eqCurvePts');
  if(e)e.setAttribute('points',curvePoints());
  var chips=host.querySelectorAll('.eq-chip');
  for(i=0;i<chips.length;i++){
    var ion=chips[i].getAttribute('data-v')===state.preset;
    chips[i].classList.toggle('on',ion);
    chips[i].setAttribute('aria-pressed',ion?'true':'false');
  }
  var pw=host.querySelector('.eq-power');
  if(pw){
    pw.classList.toggle('on',state.enabled);
    pw.textContent=state.enabled?'ENABLED':'BYPASS';
    pw.setAttribute('aria-pressed',state.enabled?'true':'false');
  }
  host.classList.toggle('eq-off',!state.enabled);
}
function applyOpen(){
  if(!host)return;
  if(open){
    host.hidden=false;
    host.innerHTML=panelHTML();
    host.classList.toggle('eq-off',!state.enabled);
  }else{
    host.hidden=true;
  }
  var eb=document.getElementById('eqBtn');
  if(eb){
    eb.setAttribute('aria-pressed',open?'true':'false');
    eb.style.color=open?'#D9A441':'';
  }
}
function mount(container){
  if(!container)return;
  host=container;
  applyOpen();
}
function toggle(){
  var player=document.getElementById('player');
  var needOpen=player&&!player.classList.contains('open');
  if(needOpen&&window.openPlayer){try{openPlayer();}catch(e){}}
  var panel=document.getElementById('eqPanel')||host;
  if(!panel)return;
  host=panel;
  open=!open;
  applyOpen();
}
function close(){
  if(!open)return;
  open=false;
  applyOpen();
}
document.addEventListener('input',function(e){
  var t=e.target;
  if(!t||!t.getAttribute)return;
  if(t.hasAttribute('data-eq-band'))setBand(+t.getAttribute('data-eq-band'),+t.value);
  else if(t.hasAttribute('data-eq-preamp'))setPreamp(+t.value);
},false);
document.addEventListener('click',function(e){
  var t=e.target;
  if(!t||!t.closest)return;
  t=t.closest('[data-eq]');
  if(!t)return;
  var a=t.getAttribute('data-eq');
  if(a==='preset')setPreset(t.getAttribute('data-v'));
  else if(a==='enabled')setEnabled(!state.enabled);
  else if(a==='reset'){setPreset('Flat');setEnabled(true);}
  else if(a==='save')saveAsPreset();
  else if(a==='close')close();
},false);
window.EQ={
  init:init,
  setBand:setBand,
  setPreamp:setPreamp,
  setPreset:setPreset,
  setEnabled:setEnabled,
  getPreset:function(){return {name:state.preset,bands:state.bands.slice(),preamp:state.preamp};},
  getBands:function(){return state.bands.slice();},
  apply:function(o){restore(o);},
  serialize:function(){return {enabled:state.enabled,preset:state.preset,bands:state.bands.slice(),preamp:state.preamp,custom:custom};},
  restore:function(o){restore(o);},
  mount:mount,
  toggle:toggle,
  close:close,
  isOpen:function(){return open;},
  get enabled(){return state.enabled;},
  set enabled(v){setEnabled(!!v);},
  get analyser(){return analyserNode;},
  get ready(){return ready;},
  onChange:null
};
Object.defineProperty(window.EQ,'onChange',{
  get:function(){return onChange;},
  set:function(fn){onChange=fn;}
});
})();
