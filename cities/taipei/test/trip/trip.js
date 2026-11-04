// Trip anticipation flow (build tr1a). State lives in localStorage 'teTrip'; album 'teAlbum'; passport 'tePassport'.
const $=id=>document.getElementById(id);const LS={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
window.__build='tr1a';
let whenV='tomorrow';
function sel(group,cb){group.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{group.querySelectorAll('.opt').forEach(x=>x.classList.remove('on'));o.classList.add('on');cb&&cb(o.dataset.v);});}
sel($('when'),v=>whenV=v);
$('name').oninput=()=>$('bookBtn').disabled=!$('name').value.trim();
function departTime(v){const n=new Date();if(v==='60')return Date.now()+60000;const d=new Date(n);d.setDate(d.getDate()+(v==='3d'?3:1));d.setHours(8,40,0,0);return d.getTime();}
$('bookBtn').onclick=()=>{const name=$('name').value.trim().replace(/[<>]/g,'');const r=Math.random;
 const t={name,dest:'TPE',flight:'TE '+(200+Math.floor(r()*700)),seat:(10+Math.floor(r()*30))+'ABCDEF'[Math.random()<.5?0:5],gate:'B'+(1+Math.floor(r()*9)),booked:Date.now(),depart:departTime(whenV),bag:[]};
 LS.set('teTrip',t);show();};
$('reset').onclick=()=>{localStorage.removeItem('teTrip');location.reload();};
// ---------- boarding pass (canvas) ----------
function rr(x,X,Y,W,H,R){x.beginPath();x.moveTo(X+R,Y);x.arcTo(X+W,Y,X+W,Y+H,R);x.arcTo(X+W,Y+H,X,Y+H,R);x.arcTo(X,Y+H,X,Y,R);x.arcTo(X,Y,X+W,Y,R);x.closePath();}
function drawPass(t){const W=900,H=1300,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#fbf6ee');g.addColorStop(1,'#f1e7d6');rr(x,0,0,W,H,48);x.fillStyle=g;x.fill();
 // header band
 x.save();rr(x,0,0,W,330,48);x.clip();const hg=x.createLinearGradient(0,0,W,330);hg.addColorStop(0,'#a3221a');hg.addColorStop(1,'#6e1410');x.fillStyle=hg;x.fillRect(0,0,W,330);
 x.globalAlpha=.12;x.fillStyle='#e8b55a';for(let i=0;i<9;i++){x.beginPath();x.arc(700+i*8,80,40+i*30,0,7);x.lineWidth=6;x.strokeStyle='#e8b55a';x.stroke();}x.restore();x.globalAlpha=1;
 x.fillStyle='#f6d58e';x.font='600 30px system-ui';x.fillText('BOARDING PASS · TRAVEL EXPERIENCE AIR',60,80);
 x.fillStyle='#fff';x.font='800 150px system-ui';x.fillText('LAX',60,250);x.textAlign='right';x.fillText('TPE',W-60,250);x.textAlign='left';
 x.font='400 70px system-ui';x.fillText('✈',W/2-38,225);x.font='500 28px system-ui';x.fillStyle='#f6d58e';x.fillText('Your city',60,300);x.textAlign='right';x.fillText('Taipei · Longshan',W-60,300);x.textAlign='left';
 const f=(k,v,X,Y,s=64)=>{x.fillStyle='#8a7f70';x.font='600 26px system-ui';x.fillText(k,X,Y);x.fillStyle='#1b1408';x.font=`800 ${s}px system-ui`;x.fillText(v,X,Y+s+8);};
 const d=new Date(t.depart),bt=new Date(t.depart-30*60000);const hm=z=>z.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
 f('PASSENGER',t.name.toUpperCase(),60,420,80);
 f('FLIGHT',t.flight,60,600);f('DATE',d.toLocaleDateString([], {month:'short',day:'numeric'}).toUpperCase(),470,600);
 f('GATE',t.gate,60,770);f('SEAT',t.seat,330,770);f('BOARDING',hm(bt),600,770);
 // perforation
 x.setLineDash([14,14]);x.strokeStyle='#c9bba5';x.lineWidth=4;x.beginPath();x.moveTo(40,940);x.lineTo(W-40,940);x.stroke();x.setLineDash([]);
 x.fillStyle='#0f1420';x.beginPath();x.arc(0,940,34,0,7);x.arc(W,940,34,0,7);x.fill();
 // barcode
 let bx=60;const seed=[...(t.name+t.flight)].reduce((a,ch)=>a*31+ch.charCodeAt(0)>>>0,7);let s=seed;while(bx<W-60){s=s*1103515245+12345>>>0;const w=2+(s>>>28)%5;x.fillStyle='#1b1408';x.fillRect(bx,1000,w,170);bx+=w+2+(s>>>24)%4;}
 x.fillStyle='#8a7f70';x.font='600 24px ui-monospace,monospace';x.textAlign='center';x.fillText(`${t.flight.replace(' ','')} ${t.seat} ${t.gate} ${t.name.toUpperCase()}`,W/2,1220);x.textAlign='left';
 return c;}
// ---------- teasers ----------
const TEASERS=[
 {at:0,ic:'🥟',t:'Food to try',b:'Hújiāo bǐng (胡椒餅): a pepper bun baked on the wall of a clay oven, sold near Longshan Temple. Crispy shell, juicy peppery pork.'},
 {at:.25,ic:'🗣️',t:'Phrase of the day',b:'謝謝 xièxie: "thank you". Say it at the incense stall.',say:'謝謝',lang:'zh-TW'},
 {at:.5,ic:'🔔',t:'Listen: temple courtyard',b:'Bells, a low chant and a busy courtyard. Headphones on.',sound:1},
 {at:.75,ic:'👀',t:'A peek at the courtyard',b:'Where you land: the bronze incense burner in front of the main hall.',img:'trip/peek.jpg'},
 {at:.95,ic:'🎒',t:'Last call',b:'Check your bag below. Tomorrow you walk in through the front hall.'}];
function teaserHTML(){const t=LS.get('teTrip');const p=progress(t);$('teasers').innerHTML=TEASERS.map((z,i)=>{const open=p>=z.at;
  const left=open?'':`<div class="k">Unlocks at ${Math.round(z.at*100)}% · ${fmtLeft(t.booked+(t.depart-t.booked)*z.at-Date.now())}</div>`;
  return `<div class="teaser ${open?'':'locked'}" data-i="${i}" data-open="${open?1:0}"><div class="ic">${open?z.ic:'🔒'}</div><div class="body"><b>${z.t}</b>${left}<p style="font-size:14px">${open?z.b:'Something good is waiting here.'}</p>${open&&z.img?`<img src="${z.img}" alt="">`:''}</div>${open&&(z.say||z.sound)?`<button data-a="${i}">▶︎ Play</button>`:''}</div>`;}).join('');
 $('teasers').querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>{const z=TEASERS[+b.dataset.a];if(z.say)speak(z.say,z.lang);if(z.sound)templeSound();});}
let lastUnlocked=-1;
function speak(s,l){try{const u=new SpeechSynthesisUtterance(s);u.lang=l;u.rate=.85;const v=speechSynthesis.getVoices().find(v=>/zh[-_](TW|HK|CN)/i.test(v.lang));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}}
let AC=null;function templeSound(){AC=AC||new (window.AudioContext||window.webkitAudioContext)();const a=AC,now=a.currentTime;const out=a.createGain();out.gain.value=.5;out.connect(a.destination);
 // bronze bell strikes: inharmonic partials with long decay
 [0,3.2,6.6].forEach((t0,k)=>{[220,220*2.76,220*5.4,220*8.9].forEach((f,j)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=f*(k===1?1.12:1);o.connect(g);g.connect(out);g.gain.setValueAtTime(0,now+t0);g.gain.linearRampToValueAtTime(.25/(j+1),now+t0+.01);g.gain.exponentialRampToValueAtTime(.0001,now+t0+4-j*.6);o.start(now+t0);o.stop(now+t0+4.2);});});
 // low chant drone + crowd murmur (filtered noise)
 const d=a.createOscillator(),dg=a.createGain();d.type='sawtooth';d.frequency.value=110;const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=380;d.connect(lp);lp.connect(dg);dg.connect(out);dg.gain.setValueAtTime(0,now);dg.gain.linearRampToValueAtTime(.06,now+2);dg.gain.linearRampToValueAtTime(0,now+10);d.start(now);d.stop(now+10);
 const nb=a.createBuffer(1,a.sampleRate*10,a.sampleRate),ch=nb.getChannelData(0);for(let i=0;i<ch.length;i++)ch[i]=(Math.random()*2-1)*(.5+.5*Math.sin(i/9000));const ns=a.createBufferSource();ns.buffer=nb;const bp=a.createBiquadFilter();bp.type='bandpass';bp.frequency.value=600;bp.Q.value=.7;const ng=a.createGain();ng.gain.value=.05;ns.connect(bp);bp.connect(ng);ng.connect(out);ns.start(now);}
// ---------- bag ----------
const BAG=[['camera','📷','Camera','photo mode in Taipei'],['fan','🪭','Hand fan','it is humid'],['snacks','🍪','Snacks','for the flight'],['umbrella','☂️','Umbrella',''],['passport','🛂','Passport','for your stamp'],['charger','🔌','Charger','']];
function bagHTML(){const t=LS.get('teTrip');$('bag').innerHTML=BAG.map(([k,e,n,s])=>`<div class="opt ${t.bag.includes(k)?'on':''}" data-k="${k}"><span>${e}</span><b>${n}</b><small class="k" style="font-size:9px">${s}</small></div>`).join('');
 $('bag').querySelectorAll('.opt').forEach(o=>o.onclick=()=>{const t=LS.get('teTrip');const k=o.dataset.k;t.bag=t.bag.includes(k)?t.bag.filter(z=>z!==k):[...t.bag,k];LS.set('teTrip',t);bagHTML();});}
// ---------- countdown ----------
const progress=t=>Math.max(0,Math.min(1,(Date.now()-t.booked)/(t.depart-t.booked)));
function fmtLeft(ms){if(ms<=0)return 'now';const s=Math.ceil(ms/1000);if(s<120)return s+' s';const m=Math.round(s/60);if(m<120)return m+' min';const h=Math.round(m/60);return h<48?h+' h':Math.round(h/24)+' days';}
const pad=n=>String(n).padStart(2,'0');
function tick(){const t=LS.get('teTrip');if(!t)return;const ms=Math.max(0,t.depart-Date.now());const s=Math.floor(ms/1000);
 $('cdD').textContent=Math.floor(s/86400);$('cdH').textContent=pad(Math.floor(s/3600)%24);$('cdM').textContent=pad(Math.floor(s/60)%60);$('cdS').textContent=pad(s%60);
 $('prog').style.width=(progress(t)*100).toFixed(1)+'%';
 const n=TEASERS.filter(z=>progress(t)>=z.at).length;if(n!==lastUnlocked){lastUnlocked=n;teaserHTML();}
 const ready=ms<=0;$('boardBtn').classList.toggle('hide',!ready);$('cdTitle').textContent=ready?'Your flight is boarding':s<3600?'Almost time to go':s<86400?'Tonight feels like the night before a flight':'Taipei is getting closer';
 if(ready&&!tick.fired){tick.fired=1;if(t.notif&&'Notification'in window&&Notification.permission==='granted'&&document.hidden){try{new Notification('Flight '+t.flight+' to Taipei is boarding',{body:'Gate '+t.gate+'. Tap to board.'});}catch(e){}}}}
$('notif').onclick=async()=>{const t=LS.get('teTrip');if(!('Notification'in window)){$('notifNote').textContent='This browser has no notifications (on iPhone: add to Home Screen first). Keep this page open and we will ping you.';return;}
 const p=await Notification.requestPermission();t.notif=p==='granted';LS.set('teTrip',t);$('notifNote').textContent=p==='granted'?'We will remind you at boarding time (while this page is open).':'Notifications are off; the countdown still works.';};
$('share').onclick=async()=>{const c=drawPass(LS.get('teTrip'));c.toBlob(async b=>{const f=new File([b],'boarding-pass-TPE.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:'I\'m going to Taipei!'});}catch(e){}}else{$('dl').click();}});};
function show(){const t=LS.get('teTrip');$('book').classList.toggle('hide',!!t);$('trip').classList.toggle('hide',!t);if(!t)return;
 $('hello').textContent='Bon voyage, '+t.name;const c=drawPass(t);const u=c.toDataURL('image/png');$('passImg').src=u;$('dl').href=u;bagHTML();lastUnlocked=-1;tick();
 const al=LS.get('teAlbum')||[];if(al.length){$('albumWrap').classList.remove('hide');$('album').innerHTML=al.map(a=>`<img src="${a.img}" alt="">`).join('');}
 const pp=LS.get('tePassport')||[];if(pp.length){$('stampWrap').classList.remove('hide');$('stamps').innerHTML=pp.map(s=>`<div class="teaser"><div class="ic">🏮</div><div class="body"><b>${s.place}</b><p class="k">${new Date(s.at).toLocaleString()}</p></div></div>`).join('');}}
setInterval(tick,250);show();
