// Departure-day sequence (build dp1a): gate -> jet bridge -> window seat takeoff -> clouds -> landing in Taipei -> world-ls.html?arrive=1
// All geometry/textures procedural; sound via WebAudio + speechSynthesis (no assets).
import * as THREE from 'three';
const BUILD='dp1c';window.__build=BUILD;
const T=(()=>{try{return JSON.parse(localStorage.getItem('teTrip'))}catch(e){return null}})()||{name:'Traveller',flight:'TE 287',gate:'B4',seat:'23A',bag:[]};
document.getElementById('stTitle').textContent=`${T.flight} to Taipei`;document.getElementById('stSub').textContent=`${T.name} · Gate ${T.gate} · Seat ${T.seat}`;
const DEST='world-ls.html?arrive=1';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.05,6000);scene.add(camera);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
const hemi=new THREE.HemisphereLight(0xdfe8ff,0x6a5a4a,1.4);scene.add(hemi);const sun=new THREE.DirectionalLight(0xfff0d8,2.2);sun.position.set(200,400,300);scene.add(sun);
function tex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(...rep);t.anisotropy=4;return t;}
const L=(c)=>new THREE.MeshLambertMaterial(typeof c==='number'?{color:c}:c);
const mesh=(g,m,p,parent)=>{const o=new THREE.Mesh(g,m);if(p)o.position.set(...p);(parent||scene).add(o);return o;};
// sky gradient sphere whose colours we animate
const skyG=new THREE.SphereGeometry(5000,24,12);const skyM=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x6f9fd8)},hor:{value:new THREE.Color(0xdfe6ee)}},
 vertexShader:'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 top,hor;varying float h;void main(){gl_FragColor=vec4(mix(hor,top,pow(clamp(h,0.,1.),.5)),1.);}'});
const sky=new THREE.Mesh(skyG,skyM);scene.add(sky);
// ---------- airplane model (procedural) ----------
function airplane(){const g=new THREE.Group();const white=new THREE.MeshStandardMaterial({color:0xf4f4f2,roughness:.4,metalness:.2}),red=L(0xa3221a),gold=L(0xe8b55a),dark=L(0x223040);
 const body=mesh(new THREE.CylinderGeometry(2,2,36,24,1),white,[0,0,0],g);body.rotation.z=Math.PI/2;
 const nose=mesh(new THREE.SphereGeometry(2,20,14,0,Math.PI*2,0,Math.PI/2),white,[18,0,0],g);nose.rotation.z=-Math.PI/2;nose.scale.set(1,1.6,1);
 const tail=mesh(new THREE.ConeGeometry(2,8,20),white,[-22,0.4,0],g);tail.rotation.z=Math.PI/2;
 const wing=mesh(new THREE.BoxGeometry(7,0.35,34),white,[1,-1,0],g);wing.rotation.y=0.25;
 mesh(new THREE.BoxGeometry(4,7,0.35),red,[-22,4,0],g).rotation.z=-0.4;mesh(new THREE.BoxGeometry(3,0.3,11),white,[-23,0.8,0],g);
 for(const s of[-1,1])mesh(new THREE.CylinderGeometry(1,1,4,16),dark,[3,-2.4,s*7],g).rotation.z=Math.PI/2;
 mesh(new THREE.BoxGeometry(30,0.5,4.05),red,[0,-0.6,0],g);mesh(new THREE.BoxGeometry(30,0.18,4.06),gold,[0,-0.1,0],g);
 for(let i=0;i<22;i++)for(const s of[-1,1])mesh(new THREE.BoxGeometry(0.4,0.5,0.05),dark,[13-i*1.3,0.7,s*2.0],g);
 mesh(new THREE.BoxGeometry(1.2,2.2,0.06),L(0xd8d8d8),[12,0.2,2.01],g);return g;}
// ================= A) GATE =================
const gate=new THREE.Group();scene.add(gate);
{const carpet=tex(256,256,(x,w,h)=>{x.fillStyle='#3a4660';x.fillRect(0,0,w,h);for(let i=0;i<400;i++){x.fillStyle=`rgba(${120+Math.random()*80|0},${120+Math.random()*60|0},180,.25)`;x.fillRect(Math.random()*w,Math.random()*h,3,3);}},[10,10]);
 mesh(new THREE.PlaneGeometry(40,30).rotateX(-Math.PI/2),L({map:carpet}),[0,0,0],gate);
 mesh(new THREE.PlaneGeometry(40,30).rotateX(Math.PI/2),L(0xe8e6e0),[0,6,0],gate);
 for(let i=-3;i<=3;i++)mesh(new THREE.BoxGeometry(5,0.08,0.4),new THREE.MeshBasicMaterial({color:0xffffff}),[i*5,5.95,-2],gate);
 mesh(new THREE.PlaneGeometry(40,6),L(0xcfc9bd),[0,3,15],gate).rotation.y=Math.PI;
 for(const s of[-1,1])mesh(new THREE.PlaneGeometry(30,6),L(0xd9d4ca),[s*20,3,0],gate).rotation.y=-s*Math.PI/2;
 // window wall frames (glass is open; mullions only)
 const fm=L(0x2a2e36);for(let i=-10;i<=10;i++)mesh(new THREE.BoxGeometry(0.15,6,0.15),fm,[i*2,3,-15],gate);mesh(new THREE.BoxGeometry(40,0.2,0.2),fm,[0,0.6,-15],gate);mesh(new THREE.BoxGeometry(40,0.2,0.2),fm,[0,5.9,-15],gate);
 // seats rows (instanced)
 const seatG=new THREE.BoxGeometry(0.6,0.5,0.6),backG=new THREE.BoxGeometry(0.6,0.7,0.12);const sm=L(0x1d5a8a),n=6*14;
 const si=new THREE.InstancedMesh(seatG,sm,n),bi=new THREE.InstancedMesh(backG,sm,n);const o=new THREE.Object3D();let k=0;
 for(let r=0;r<6;r++)for(let c=0;c<14;c++){const x=(c-6.5)*0.7+(c>6?1.2:-1.2),z=-8+r*3;o.position.set(x,0.45,z);o.updateMatrix();si.setMatrixAt(k,o.matrix);o.position.set(x,0.9,z+(r%2?0.28:-0.28));o.updateMatrix();bi.setMatrixAt(k,o.matrix);k++;}gate.add(si,bi);
 // gate sign
 const sign=tex(1024,256,(x,w,h)=>{x.fillStyle='#111722';x.fillRect(0,0,w,h);x.fillStyle='#e8b55a';x.font='800 120px system-ui';x.fillText(T.gate,40,170);x.fillStyle='#fff';x.font='700 64px system-ui';x.fillText(`${T.flight}  TAIPEI TPE`,300,110);x.fillStyle='#7be08a';x.font='700 54px system-ui';x.fillText('NOW BOARDING',300,200);});
 mesh(new THREE.PlaneGeometry(6,1.5),new THREE.MeshBasicMaterial({map:sign}),[-9,4.2,-14.7],gate);
 // apron + parked plane + tug
 const apron=tex(256,256,(x,w,h)=>{x.fillStyle='#7d7f82';x.fillRect(0,0,w,h);x.fillStyle='#e8c020';x.fillRect(120,0,10,h);},[20,20]);
 mesh(new THREE.PlaneGeometry(800,800).rotateX(-Math.PI/2),L({map:apron}),[0,-0.02,-300],gate);
 const p=airplane();p.position.set(0,4,-40);p.rotation.y=0;gate.add(p);
 mesh(new THREE.BoxGeometry(2.5,2.5,16),L(0xbfc3c8),[6,4.3,-25],gate);// jet bridge stub
 // a few people silhouettes waiting
 const pm=L(0x2b2b30);for(let i=0;i<10;i++){const g=new THREE.Group();mesh(new THREE.CapsuleGeometry(0.22,0.9,4,8),L([0x8a2b2b,0x2b3a55,0xe3c76a,0x3d5a3a][i%4]),[0,0.75,0],g);mesh(new THREE.SphereGeometry(0.15,10,8),L(0xd9a982),[0,1.42,0],g);g.position.set(-8+Math.random()*16,0,-12+Math.random()*12);gate.add(g);}
}
// ================= B) JET BRIDGE =================
const bridge=new THREE.Group();bridge.position.set(500,0,0);scene.add(bridge);
{const rib=L(0xb9bcc2),fl=L(0x45484f);mesh(new THREE.PlaneGeometry(3,30).rotateX(-Math.PI/2),fl,[0,0,-15],bridge);
 for(let i=0;i<16;i++){const z=-i*2;mesh(new THREE.BoxGeometry(3.2,0.15,0.3),rib,[0,2.6,z],bridge);for(const s of[-1,1])mesh(new THREE.BoxGeometry(0.15,2.6,0.3),rib,[s*1.55,1.3,z],bridge);}
 for(const s of[-1,1])mesh(new THREE.PlaneGeometry(30,2.6),L(0x9da2aa),[s*1.6,1.3,-15],bridge).rotation.y=-s*Math.PI/2;
 mesh(new THREE.PlaneGeometry(3,30).rotateX(Math.PI/2),L(0xd8dadd),[0,2.6,-15],bridge);
 mesh(new THREE.PlaneGeometry(1.1,2),new THREE.MeshBasicMaterial({color:0xfff3d6}),[0,1.05,-30],bridge);
 const lamp=new THREE.PointLight(0xfff0d0,3,12);lamp.position.set(0,2.2,-8);bridge.add(lamp);}
// ================= C/D) FLIGHT =================
const flight=new THREE.Group();scene.add(flight);flight.visible=false;
const fieldT=tex(512,512,(x,w,h)=>{const c=['#6b8a4a','#8a9a5a','#5a7a3a','#a49a6a','#7a8a4a'];for(let i=0;i<64;i++){x.fillStyle=c[i%5];x.fillRect((i%8)*64,(i>>3)*64,64,64);}for(let i=0;i<800;i++){x.fillStyle='rgba(0,0,0,.06)';x.fillRect(Math.random()*w,Math.random()*h,4,4);}},[40,40]);
const runT=tex(64,512,(x,w,h)=>{x.fillStyle='#3a3c40';x.fillRect(0,0,w,h);x.fillStyle='#f0f0f0';x.fillRect(30,0,4,120);x.fillRect(2,0,3,h);x.fillRect(w-5,0,3,h);},[1,40]);
function airport(parent,city){const g=new THREE.Group();parent.add(g);
 mesh(new THREE.PlaneGeometry(20000,20000).rotateX(-Math.PI/2),L({map:city?tex(512,512,(x,w,h)=>{x.fillStyle='#55605a';x.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=90+Math.random()*80|0;x.fillStyle=`rgb(${v},${v},${v-10})`;x.fillRect(Math.random()*w,Math.random()*h,6+Math.random()*10,6+Math.random()*10);}},[60,60]):fieldT}),[0,-0.05,0],g);
 const r=mesh(new THREE.PlaneGeometry(60,4000).rotateX(-Math.PI/2),L({map:runT}),[0,0,0],g);r.rotation.y=Math.PI/2;r.position.set(1500,0,-25);
 if(city){// Taipei: dense blocks + Taipei 101 + mountains
  const bg=new THREE.BoxGeometry(1,1,1);bg.translate(0,.5,0);const n=1400;const im=new THREE.InstancedMesh(bg,L(0xd7d3c9),n);const o=new THREE.Object3D();const col=new THREE.Color();
  for(let i=0;i<n;i++){let x,z;do{x=-1500+Math.random()*7000;z=-3500+Math.random()*3300;}while(z>-150);const h=8+Math.pow(Math.random(),3)*90;o.position.set(x,0,z);o.scale.set(18+Math.random()*30,h,18+Math.random()*30);o.updateMatrix();im.setMatrixAt(i,o.matrix);im.setColorAt(i,col.setHSL(0.08,0.08,0.55+Math.random()*0.3));}g.add(im);
  const t1=new THREE.Group();const gm=new THREE.MeshStandardMaterial({color:0x5f7d7a,metalness:.6,roughness:.3});let y=0;mesh(new THREE.BoxGeometry(70,60,70),gm,[0,30,0],t1);y=60;
  for(let i=0;i<8;i++){const s=mesh(new THREE.CylinderGeometry(26,20,42,4),gm,[0,y+21,0],t1);s.rotation.y=Math.PI/4;y+=42;}mesh(new THREE.CylinderGeometry(1.5,3,60,6),gm,[0,y+30,0],t1);t1.position.set(2600,0,-1600);g.add(t1);
  for(let i=0;i<9;i++){const m=mesh(new THREE.ConeGeometry(700+Math.random()*500,350+Math.random()*350,7),L(0x47604a),[-1500+i*900,0,-4300-Math.random()*600],g);}}
 return g;}
const home=airport(flight,false),taipei=airport(flight,true);taipei.visible=false;
// clouds: sprite puffs in a layer
const puff=tex(128,128,(x,w,h)=>{const gr=x.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.6,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,w,h);});
const clouds=new THREE.Group();flight.add(clouds);const cm=new THREE.SpriteMaterial({map:puff,transparent:true,depthWrite:false,fog:false});
for(let i=0;i<420;i++){const s=new THREE.Sprite(cm);s.position.set(Math.random()*14000-2000,320+Math.random()*260,-60-Math.random()*1500);const k=120+Math.random()*220;s.scale.set(k*1.6,k,1);clouds.add(s);}
const deck=mesh(new THREE.PlaneGeometry(30000,30000).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0xf4efe8,transparent:true,opacity:.92}),[0,600,0],flight);
// cabin window rig attached to camera (left-side window seat looking -z)
const cabin=new THREE.Group();camera.add(cabin);cabin.visible=false;
{const shape=new THREE.Shape();shape.moveTo(-3,-3);shape.lineTo(3,-3);shape.lineTo(3,3);shape.lineTo(-3,3);shape.lineTo(-3,-3);
 const hole=new THREE.Path();const w=0.36,h=0.5,r=0.17;hole.moveTo(-w+r,-h);hole.lineTo(w-r,-h);hole.quadraticCurveTo(w,-h,w,-h+r);hole.lineTo(w,h-r);hole.quadraticCurveTo(w,h,w-r,h);hole.lineTo(-w+r,h);hole.quadraticCurveTo(-w,h,-w,h-r);hole.lineTo(-w,-h+r);hole.quadraticCurveTo(-w,-h,-w+r,-h);shape.holes.push(hole);
 const wall=new THREE.Mesh(new THREE.ShapeGeometry(shape,24),new THREE.MeshBasicMaterial({color:0xe9e5dd,side:THREE.DoubleSide}));wall.position.z=-0.62;cabin.add(wall);
 const ring=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.08,bevelEnabled:false,curveSegments:24}),new THREE.MeshBasicMaterial({color:0xc9c3b8,side:THREE.DoubleSide}));ring.scale.set(1.08,1.08,1);ring.position.z=-0.7;cabin.add(ring);
 const shade=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.6),new THREE.MeshBasicMaterial({color:0xd8d3c8}));shade.position.set(0,0.72,-0.63);cabin.add(shade);
 const seat=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.2,0.2),new THREE.MeshBasicMaterial({color:0x1d3a5a}));seat.position.set(0.85,-0.75,-0.5);cabin.add(seat);
 cabin.userData.wall=wall;}
// ---------- sound ----------
let AC,eng,engG,mur;
function audioStart(){try{AC=new (window.AudioContext||window.webkitAudioContext)();const nb=AC.createBuffer(1,AC.sampleRate*4,AC.sampleRate),d=nb.getChannelData(0);let b=0;for(let i=0;i<d.length;i++){b=0.98*b+0.02*(Math.random()*2-1);d[i]=b*6;}
 eng=AC.createBufferSource();eng.buffer=nb;eng.loop=true;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=500;engG=AC.createGain();engG.gain.value=0.0;eng.connect(lp);lp.connect(engG);engG.connect(AC.destination);eng.start();engG.lp=lp;
 const mb=AC.createBufferSource();mb.buffer=nb;mb.loop=true;mb.playbackRate.value=2.2;const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=900;mur=AC.createGain();mur.gain.value=0.05;mb.connect(bp);bp.connect(mur);mur.connect(AC.destination);mb.start();}catch(e){}}
function chime(){if(!AC)return;const n=AC.currentTime;[[784,0],[659,0.45]].forEach(([f,t])=>{const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(0,n+t);g.gain.linearRampToValueAtTime(.18,n+t+.02);g.gain.exponentialRampToValueAtTime(.001,n+t+1.4);o.start(n+t);o.stop(n+t+1.5);});}
function say(s,lang='en-US'){try{const u=new SpeechSynthesisUtterance(s);u.lang=lang;u.rate=.95;speechSynthesis.speak(u);}catch(e){}}
// ---------- timeline ----------
const capK=document.getElementById('capK'),capT=document.getElementById('capT'),fade=document.getElementById('fade');
const SEG=[['gate',0,13],['bridge',13,21],['takeoff',21,36],['clouds',36,46],['landing',46,64],['arrive',64,68]];
const DUR=68;let t0=null,done=false,said={};
function caption(k,t){if(capT.textContent!==t){capK.textContent=k;capT.textContent=t;}}
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x);const lerp=(a,b,k)=>a+(b-a)*k;
function setFade(v){fade.style.opacity=v;}
function frame(t){let seg=SEG.find(s=>t>=s[1]&&t<s[2])||SEG[SEG.length-1];window.__dep={t,seg:seg[0],build:BUILD};
 gate.visible=seg[0]==='gate';bridge.visible=seg[0]==='bridge';flight.visible=['takeoff','clouds','landing','arrive'].includes(seg[0]);cabin.visible=flight.visible;
 camera.rotation.set(0,0,0);camera.fov=62;
 if(seg[0]==='gate'){const k=ease(t/13);camera.position.set(lerp(-0.4,0.4,k),1.7,lerp(11,-10.5,k));camera.lookAt(lerp(-3,3,k),3.2,-40);
  caption('GATE '+T.gate,t<6?`Good morning, ${T.name}`:`${T.flight} to Taipei is now boarding`);setFade(t>12?(t-12):0);
  skyM.uniforms.top.value.set(0x6f9fd8);skyM.uniforms.hor.value.set(0xf2dcc0);if(!said.a&&t>1.5){said.a=1;chime();setTimeout(()=>say(`Good morning. Flight ${T.flight.replace(' ',' ')} to Taipei is now boarding at gate ${T.gate}.`),1200);}}
 else if(seg[0]==='bridge'){const k=(t-13)/8;camera.position.set(500+Math.sin(t*6)*0.02,1.6+Math.abs(Math.sin(t*5))*0.03,lerp(0,-26,ease(k)));camera.lookAt(500,1.4,-40);
  caption('JET BRIDGE','Seat '+T.seat+' · window');setFade(k<0.12?1-k/0.12:k>0.85?(k-.85)/.15:0);}
 else{// flight path: x forward, y altitude; camera looks out left window (-z)
  let x,y,pitch=0,shake=0,ground=home;const tt=t;
  if(tt<36){const k=(tt-21)/15;const roll=Math.min(1,k/0.55);x=lerp(0,0,0)+1600*Math.pow(roll,2)*0.55+(k>0.55?(k-.55)*900:0);y=k<0.55?2.2:2.2+Math.pow((k-.55)/.45,1.6)*260;pitch=k<0.5?0:Math.min(0.22,(k-.5)*0.9);shake=k<0.6?0.012*roll:0.005;
   caption('TAKEOFF',k<0.2?'Engines spooling up…':k<0.55?'Rolling down the runway':'Wheels up. Next stop Taipei');if(engG){engG.gain.value=lerp(0.05,0.32,Math.min(1,k*2));engG.lp.frequency.value=lerp(300,900,Math.min(1,k*1.8));}
   setFade(k<0.08?1-k/0.08:0);skyM.uniforms.top.value.set(0x6f9fd8);skyM.uniforms.hor.value.set(0xe9e1d4);}
  else if(tt<46){const k=(tt-36)/10;x=1300+k*1400;y=262+k*480;pitch=0.12*(1-k);shake=0.004;caption('CRUISING',k<0.5?'Through the clouds':'13 hours over the Pacific…');
   const c1=new THREE.Color(0x6f9fd8).lerp(new THREE.Color(0x3a4f88),k),c2=new THREE.Color(0xe9e1d4).lerp(new THREE.Color(0xf6b27a),k);skyM.uniforms.top.value.copy(c1);skyM.uniforms.hor.value.copy(c2);
   if(engG)engG.gain.value=0.2;setFade(k>0.85?(k-.85)/.15:0);}
  else{ground=taipei;const k=Math.min(1,(tt-46)/16);x=lerp(-2600,1200,ease(k)*0.7+k*0.3);y=k<0.85?lerp(720,2.2,Math.pow(k/0.85,0.9)):2.2;pitch=k<0.85?-0.05+k*0.06:0;shake=k>0.83&&k<0.9?0.03:0.004;
   caption('TAIPEI',k<0.35?'Descending into Taipei':k<0.8?'Taipei 101 off the left wing':'Touchdown. 歡迎來到台北 · Welcome to Taipei');
   skyM.uniforms.top.value.set(0x7aa6d6);skyM.uniforms.hor.value.set(0xf0e2cf);if(engG)engG.gain.value=k<0.85?0.14:0.24*(1-(k-.85)/.15);
   setFade(tt<47?1-(tt-46):tt>62?Math.min(1,(tt-62)/2):0);if(!said.b&&k>0.9){said.b=1;chime();setTimeout(()=>say('Ladies and gentlemen, welcome to Taipei.'),900);}}
  home.visible=ground===home;taipei.visible=ground===taipei;clouds.visible=!(ground===taipei&&y<150);deck.visible=y>560||ground===taipei&&y>600;
  if(seg[0]==='arrive'){setFade(1);caption('','');}
  camera.position.set(x,y+(Math.random()-.5)*shake,0.4+(Math.random()-.5)*shake);camera.rotation.set(-0.12,0,pitch,'YXZ');}
 if(t>=DUR&&!done){done=true;go();}}
function go(){done=true;try{const tr=JSON.parse(localStorage.getItem('teTrip'));if(tr){tr.flown=Date.now();localStorage.setItem('teTrip',JSON.stringify(tr));}}catch(e){}location.href=DEST;}
document.getElementById('skip').onclick=go;
{const g=document.getElementById('go');g.disabled=false;g.style.opacity=1;g.textContent='Tap to board';}
document.getElementById('go').onclick=()=>{audioStart();document.getElementById('start').remove();t0=performance.now();};
if(new URLSearchParams(location.search).get('auto')){document.getElementById('start').remove();t0=performance.now();}
renderer.setAnimationLoop(()=>{const t=t0===null?0:(performance.now()-t0)/1000;frame(t);renderer.render(scene,camera);});
