// Sakura Lantern Garden — fictional Japanese garden, walk-around prototype (build g2a).
// Engine adapted from cities/taipei/test/world/world-ls3.js. Models: Fab/Sketchfab (CC-BY / Fab Standard), people: Microsoft Rocketbox (MIT),
// Tripo AI people, Sketchfab "Alina Ip" (CC-BY). AI video backdrops: Grok Imagine. See CREDITS.md.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const BUILD='g2a'; window.__build=BUILD;
const Q=new URLSearchParams(location.search);
const PEOPLE_DIR='../../taipei/test/world/';
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
const R=rng(20261105);
const pick=(a,r=R)=>a[Math.floor(r()*a.length)];
// ---------- renderer ----------
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,Q.get('dpr')?+Q.get('dpr'):1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const SHADOWS=Q.get('shadows')!=='0';if(SHADOWS){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;}
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();window.__scene=scene;window.__THREE=THREE;
{const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;scene.environmentIntensity=0.5;}
scene.fog=new THREE.Fog(0xe9b98e,30,150);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.1,420);
let composer=null;
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);if(composer)composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
{const g=new THREE.SphereGeometry(320,24,12);const c=[];const p=g.attributes.position;const top=new THREE.Color(0x5d76a8),hor=new THREE.Color(0xf7b27a);
 for(let i=0;i<p.count;i++){const t=Math.max(0,p.getY(i)/320);const k=top.clone().lerp(hor,1-Math.pow(t,0.5));c.push(k.r,k.g,k.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
 scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})));}
scene.add(new THREE.HemisphereLight(0xffd8b8,0x4a5038,1.0));
const sun=new THREE.DirectionalLight(0xffa868,3.2);sun.position.set(-50,22,30);sun.target.position.set(0,0,0);scene.add(sun,sun.target);
if(SHADOWS){sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=-45;sc.right=45;sc.top=45;sc.bottom=-45;sc.near=10;sc.far=160;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;}
function canvasTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=8;return t;}
const nr=rng(7);
function noise(x,w,h,a){const d=x.getImageData(0,0,w,h);for(let i=0;i<d.data.length;i+=4){const n=(nr()-.5)*a;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n;}x.putImageData(d,0,0);}
// ---------- layout (north = -z, entrance gate on the south, +z) ----------
const BOUND={x0:-28,x1:28,z0:-37.5,z1:38};
const POND={x:13,z:0,rx:7,rz:6.5};
const BRIDGE={x0:5.2,x1:20.8,z:0,hw:0.75};
const TEA={x:-19,z:-2,hx:5.0,hz:7.3};
const RAKE={x0:-12.5,x1:-5,z0:-12,z1:-2};
const PAG={z:-34,y:5.4};
const boxes=[],circles=[],ellipses=[];
const solid=(x0,z0,x1,z1)=>boxes.push([Math.min(x0,x1),Math.min(z0,z1),Math.max(x0,x1),Math.max(z0,z1)]);
const inPond=(x,z,m=0)=>((x-POND.x)/(POND.rx+m))**2+((z-POND.z)/(POND.rz+m))**2<1;
const onBridge=(x,z,m=0)=>x>BRIDGE.x0&&x<BRIDGE.x1&&Math.abs(z-BRIDGE.z)<BRIDGE.hw-m;
function blocked(x,z,m){if(x<BOUND.x0+m||x>BOUND.x1-m||z<BOUND.z0+m||z>BOUND.z1-m)return true;
 for(const b of boxes)if(x>b[0]-m&&x<b[2]+m&&z>b[1]-m&&z<b[3]+m)return true;
 for(const c of circles)if((x-c[0])**2+(z-c[1])**2<(c[2]+m)**2)return true;
 if(inPond(x,z,m)&&!onBridge(x,z,m*0.5))return true;return false;}
function resolve(x,z,r){
 // keep on the bridge deck: if inside pond rim and was on bridge corridor, clamp z to corridor
 for(let it=0;it<4;it++){let moved=false;
  for(const b of boxes){if(x>b[0]-r&&x<b[2]+r&&z>b[1]-r&&z<b[3]+r){const dl=x-(b[0]-r),dr=(b[2]+r)-x,dt=z-(b[1]-r),db=(b[3]+r)-z;const m=Math.min(dl,dr,dt,db);
    if(m===dl)x=b[0]-r;else if(m===dr)x=b[2]+r;else if(m===dt)z=b[1]-r;else z=b[3]+r;moved=true;}}
  for(const c of circles){const dx=x-c[0],dz=z-c[1],d=Math.hypot(dx,dz),rr=c[2]+r;if(d<rr){if(d<1e-4){x+=rr;}else{x=c[0]+dx/d*rr;z=c[1]+dz/d*rr;}moved=true;}}
  if(inPond(x,z,r)&&!onBridge(x,z,r*0.5)){
   if(x>BRIDGE.x0&&x<BRIDGE.x1&&Math.abs(z-BRIDGE.z)<BRIDGE.hw+r){z=BRIDGE.z+Math.sign(z-BRIDGE.z||1)*(BRIDGE.hw-r*0.5-0.01);}
   else{const dx=(x-POND.x)/(POND.rx+r),dz=(z-POND.z)/(POND.rz+r);const d=Math.hypot(dx,dz)||1e-3;x=POND.x+dx/d*(POND.rx+r)*1.001;z=POND.z+dz/d*(POND.rz+r)*1.001;}moved=true;}
  x=Math.min(BOUND.x1-r,Math.max(BOUND.x0+r,x));z=Math.min(BOUND.z1-r,Math.max(BOUND.z0+r,z));if(!moved)break;}
 return [x,z];}
// teahouse, pagoda mound (only the stair corridor and the summit are walkable)
solid(TEA.x-TEA.hx,TEA.z-TEA.hz,TEA.x+TEA.hx,TEA.z+TEA.hz);
solid(-14,-36,-1.25,-29.5);solid(1.25,-36,14,-29.5);solid(-14,-29.5,-1.25,-15.2);solid(1.25,-29.5,14,-15.2);
// summit: open |x|<5 between z -38..-29.5 except the pagoda itself
boxes.splice(boxes.length-4,2);solid(-14,-38,-5,-29.5);solid(5,-38,14,-29.5);
circles.push([0,PAG.z,3.9],[3.2,-30.5,0.55],[-3.2,-30.5,0.55]);
// ---------- ground: painted moss + gravel paths + raked karesansui ----------
const GW=BOUND.x1-BOUND.x0+8,GD=BOUND.z1-BOUND.z0+8,GX0=BOUND.x0-4,GZ0=BOUND.z0-4;
const PATHS=[[[0,40],[0,-15.5]],[[0,4],[-13,4]],[[0,0],[5.4,0]],[[20.6,0],[24,0],[24,14],[18,20],[6,20],[0,20]],[[24,0],[24,-12],[14,-16],[2,-15.5]],[[-13,4],[-13,14],[-6,22],[0,24]]];
const groundTex=canvasTex(2048,2048,(x,w,h)=>{const sx=w/GW,sz=h/GD;const X=v=>(v-GX0)*sx,Z=v=>(v-GZ0)*sz;
 x.fillStyle='#5d6b3a';x.fillRect(0,0,w,h);
 for(let i=0;i<9000;i++){const v=nr();x.fillStyle=`rgba(${60+v*60|0},${80+v*50|0},${30+v*30|0},${0.25+nr()*0.3})`;const r=2+nr()*14;x.beginPath();x.arc(nr()*w,nr()*h,r,0,7);x.fill();}
 // raked gravel
 x.fillStyle='#d8d0bd';x.fillRect(X(RAKE.x0),Z(RAKE.z0),(RAKE.x1-RAKE.x0)*sx,(RAKE.z1-RAKE.z0)*sz);
 x.strokeStyle='rgba(120,110,95,.55)';x.lineWidth=2;for(let zz=RAKE.z0+0.25;zz<RAKE.z1;zz+=0.3){x.beginPath();x.moveTo(X(RAKE.x0),Z(zz));x.lineTo(X(RAKE.x1),Z(zz));x.stroke();}
 for(const [rx,rz,rr] of [[-9.5,-8,0.9],[-7,-4.5,0.6]]){x.fillStyle='#d8d0bd';x.beginPath();x.arc(X(rx),Z(rz),rr*3*sx,0,7);x.fill();for(let k=1;k<=4;k++){x.beginPath();x.arc(X(rx),Z(rz),(rr+k*0.3)*sx,0,7);x.stroke();}}
 // gravel paths
 x.lineCap='round';x.lineJoin='round';
 for(const [col,wid] of [['#8f8770',3.6],['#c9bfa6',3.0]]){x.strokeStyle=col;x.lineWidth=wid*sx;for(const pth of PATHS){x.beginPath();pth.forEach(([a,b],i)=>i?x.lineTo(X(a),Z(b)):x.moveTo(X(a),Z(b)));x.stroke();}}
 for(let i=0;i<60000;i++){const v=nr();x.fillStyle=`rgba(${150+v*90|0},${140+v*85|0},${120+v*80|0},.5)`;const px=nr()*w,pz=nr()*h;const d=x.getImageData?0:0;x.fillRect(px,pz,2,2);}
 // stepping stones over moss to the teahouse
 for(let k=0;k<6;k++){x.fillStyle='#8b8578';x.beginPath();x.ellipse(X(-13.3-k*0.0),Z(-1+k*-1.3),0.5*sx,0.38*sz,nr(),0,7);x.fill();}
 // pond bed
 x.fillStyle='#2d3a2c';x.beginPath();x.ellipse(X(POND.x),Z(POND.z),(POND.rx+0.2)*sx,(POND.rz+0.2)*sz,0,0,7);x.fill();
 noise(x,w,h,16);});
{const gg=new THREE.PlaneGeometry(GW,GD);gg.rotateX(-Math.PI/2);const g=new THREE.Mesh(gg,new THREE.MeshStandardMaterial({map:groundTex,roughness:0.95}));g.position.set(GX0+GW/2,0,GZ0+GD/2);g.receiveShadow=true;scene.add(g);
 const far=new THREE.Mesh(new THREE.PlaneGeometry(600,600).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x4c5532}));far.position.y=-0.05;scene.add(far);}
// ---------- outer wall: white plaster, dark tile cap, gate gap ----------
const wallMat=new THREE.MeshStandardMaterial({color:0xe8e0d0,roughness:0.95}),capMat=new THREE.MeshStandardMaterial({color:0x3a3a3e,roughness:0.6}),woodMat=new THREE.MeshStandardMaterial({color:0x5a3a26,roughness:0.8});
function box(w,h,d,mat,x,y,z,ry=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=m.receiveShadow=true;scene.add(m);return m;}
function wall(x0,z0,x1,z1,h=2.3){const w=Math.abs(x1-x0)||0.6,d=Math.abs(z1-z0)||0.6;box(w,h,d,wallMat,(x0+x1)/2,h/2,(z0+z1)/2);box(w+0.7,0.12,d+0.7,woodMat,(x0+x1)/2,h-0.3,(z0+z1)/2);
 const cap=box(w+0.8,0.35,d+0.8,capMat,(x0+x1)/2,h+0.15,(z0+z1)/2);}
wall(BOUND.x0-0.3,BOUND.z0-4,BOUND.x0-0.3,BOUND.z1);wall(BOUND.x1+0.3,BOUND.z0-4,BOUND.x1+0.3,BOUND.z1);wall(BOUND.x0,BOUND.z0-4.3,BOUND.x1,BOUND.z0-4.3);
wall(BOUND.x0,BOUND.z1+0.3,-3,BOUND.z1+0.3);wall(3,BOUND.z1+0.3,BOUND.x1,BOUND.z1+0.3);
// gate posts + roof beam (kabukimon-like)
for(const s of[-1,1])box(0.45,3.6,0.45,woodMat,s*3,1.8,38.3);box(7.4,0.35,1.4,capMat,0,3.75,38.3);box(6.6,0.25,0.4,woodMat,0,3.3,38.3);
// ---------- pond: water, stone rim ----------
const waterMat=new THREE.MeshStandardMaterial({color:0x2f5552,roughness:0.06,metalness:0.35,transparent:true,opacity:0.92});
{const g=new THREE.CircleGeometry(1,64);g.rotateX(-Math.PI/2);const w=new THREE.Mesh(g,waterMat);w.scale.set(POND.rx,1,POND.rz);w.position.set(POND.x,0.04,POND.z);w.receiveShadow=true;scene.add(w);
 const sg=new THREE.DodecahedronGeometry(0.5,0);const n=70;const sm=new THREE.InstancedMesh(sg,new THREE.MeshStandardMaterial({color:0x8a857a,roughness:0.9}),n);const o=new THREE.Object3D();
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const x=POND.x+Math.cos(a)*(POND.rx+0.15),z=POND.z+Math.sin(a)*(POND.rz+0.15);if(onBridge(x,z,-0.6)){o.scale.set(0,0,0);}else o.scale.set(0.8+R()*0.7,0.35+R()*0.35,0.7+R()*0.6);
  o.position.set(x,0.08,z);o.rotation.set(R(),R()*6,R());o.updateMatrix();sm.setMatrixAt(i,o.matrix);}sm.castShadow=sm.receiveShadow=true;scene.add(sm);}
// rocks in the raked garden
for(const [rx,rz,rr] of [[-9.5,-8,0.9],[-7,-4.5,0.6]]){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(rr,1),new THREE.MeshStandardMaterial({color:0x6d6a63,roughness:0.95}));m.scale.y=0.8;m.position.set(rx,rr*0.45,rz);m.castShadow=true;scene.add(m);circles.push([rx,rz,rr]);}
// benches (wood plank on stone feet)
const benches=[[10,9.2,Math.PI],[15.5,9.2,Math.PI],[19,20.8,Math.PI],[-6,14,Math.PI/2]];
for(const [x,z,ry] of benches){const g=new THREE.Group();const s=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.1,0.55),woodMat);s.position.y=0.45;g.add(s);for(const k of[-0.8,0.8]){const f=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.4,0.45),capMat);f.position.set(k,0.2,0);g.add(f);}
 g.position.set(x,0,z);g.rotation.y=ry;g.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});scene.add(g);const c=Math.cos(ry),s2=Math.sin(ry);
 if(Math.abs(s2)>0.5)solid(x-0.3,z-1.1,x+0.3,z+1.1);else solid(x-1.1,z-0.3,x+1.1,z+0.3);}
// ---------- procedural cherry trees (instanced blossom clusters) ----------
const TREES=[[-8,30],[8,30],[-9,18],[9,15],[-16,12],[17,27],[23,-20],[-23,24],[-4,-10],[6,-21],[-24,-14],[22,8],[-17,33],[14,-24]];
{const bark=new THREE.MeshStandardMaterial({color:0x3d2c24,roughness:0.9});const trunks=[];
 const blossomTex=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#f6c6d3';x.fillRect(0,0,w,h);for(let i=0;i<500;i++){const v=nr();x.fillStyle=v<0.3?'#fbe3ea':v<0.6?'#e89bb0':v<0.8?'#ffffff':'#c97a92';x.beginPath();x.arc(nr()*w,nr()*h,1.5+nr()*3,0,7);x.fill();}});
 const bm=new THREE.MeshStandardMaterial({map:blossomTex,roughness:0.85,color:0xffffff,emissive:0x3a1a20,emissiveIntensity:0.25});
 const bg=new THREE.IcosahedronGeometry(1,1);const per=14;const im=new THREE.InstancedMesh(bg,bm,TREES.length*per);const o=new THREE.Object3D();let k=0;
 const tr=rng(99);
 for(const [x,z] of TREES){const H=3+tr()*1.4;const pts=[];let px=0,pz=0;for(let i=0;i<=6;i++){pts.push(new THREE.Vector3(x+px,i/6*H,z+pz));px+=(tr()-.5)*0.5;pz+=(tr()-.5)*0.5;}
  const t=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,0.22,6),bark);t.castShadow=true;scene.add(t);
  for(let b=0;b<4;b++){const a=tr()*6.28;const bp=[pts[4].clone(),pts[4].clone().add(new THREE.Vector3(Math.cos(a)*2.2,1.2+tr(),Math.sin(a)*2.2))];scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp),3,0.09,5),bark));}
  for(let i=0;i<per;i++){const a=tr()*6.28,r=tr()*2.6;o.position.set(x+px+Math.cos(a)*r,H+0.4+tr()*1.8-r*0.25,z+pz+Math.sin(a)*r);o.scale.set(1.1+tr()*0.9,0.7+tr()*0.5,1.1+tr()*0.9);o.rotation.set(tr(),tr()*6,0);o.updateMatrix();im.setMatrixAt(k++,o.matrix);}
  circles.push([x,z,0.4]);}
 im.castShadow=true;scene.add(im);}
// ---------- AI-video backdrops (Grok Imagine), crossfade-looped, muted+playsinline for iOS ----------
const BGV=[];
{const edge=canvasTex(256,128,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#000');g.addColorStop(0.2,'#fff');g.addColorStop(1,'#fff');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.globalCompositeOperation='multiply';const s=x.createLinearGradient(0,0,w,0);s.addColorStop(0,'#000');s.addColorStop(0.12,'#fff');s.addColorStop(0.88,'#fff');s.addColorStop(1,'#000');x.fillStyle=s;x.fillRect(0,0,w,h);});
 const vids={};function vid(name){if(vids[name])return vids[name];const v=document.createElement('video');v.src=`garden/vid/${name}.mp4?v=${BUILD}`;v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;
  v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.setAttribute('muted','');v.autoplay=true;v.preload='auto';v.crossOrigin='anonymous';
  const t=new THREE.VideoTexture(v);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;vids[name]={v,t};BGV.push(vids[name]);return vids[name];}
 const P=[['hills',0,24,-110,0,150],['hills',-95,20,-10,Math.PI/2,130],['town',0,9,78,Math.PI,60],['town',72,12,10,-Math.PI/2,90]];
 for(const [n,x,y,z,ry,w] of P){const {t}=vid(n);const h=w*9/16;const g=new THREE.PlaneGeometry(w,h,24,1);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)/(w/2);p.setZ(i,-u*u*w*0.12);}
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:t,alphaMap:edge,transparent:true,depthWrite:false,fog:false,color:0xfff0e0,toneMapped:false}));
  m.position.set(x,y,z);m.rotation.y=ry;m.renderOrder=-1;scene.add(m);}
 const tryPlay=()=>Promise.all(BGV.map(o=>o.v.play().catch(()=>{throw 0;}))).then(()=>true,()=>false);
 tryPlay().then(ok=>{if(ok)return;const go=()=>{tryPlay().then(ok2=>{if(ok2){removeEventListener('pointerdown',go,true);removeEventListener('touchend',go,true);}});};
  addEventListener('pointerdown',go,true);addEventListener('touchend',go,true);});
 window.__bgvState=()=>BGV.map(o=>({src:o.v.currentSrc.split('/').pop(),paused:o.v.paused,t:+o.v.currentTime.toFixed(2),ready:o.v.readyState}));}
// ---------- models ----------
const LD=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loadM=n=>new Promise(res=>LD.load(`garden/m/${n}.glb?v=${BUILD}`,g=>res(g),undefined,e=>{console.warn('model failed',n,e);res(null);}));
const walkMeshes=[];const glows=[];
const PROPS=[];window.__props=PROPS;
function fit(src,{h,s,x,z,y=0,ry=0,cast=true,col=0}){const o=src.clone(true);o.rotation.y=ry;const b=new THREE.Box3().setFromObject(src);const sz=b.getSize(new THREE.Vector3());
 const k=s??(h/sz.y);o.scale.multiplyScalar(k);o.updateMatrixWorld(true);const b2=new THREE.Box3().setFromObject(o);const c=b2.getCenter(new THREE.Vector3());
 o.position.set(x-c.x,y-b2.min.y,z-c.z);o.traverse(m=>{if(m.isMesh){m.castShadow=cast;m.receiveShadow=true;}});scene.add(o);
 if(col){const hx=(b2.max.x-b2.min.x)/2,hz=(b2.max.z-b2.min.z)/2;const r=Math.max(hx,hz)*col;circles.push([x,z,r]);PROPS.push([x,z,r]);}return o;}
function addGlow(x,y,z,s=1.2,c=0xffb050){glows.push([x,y,z,s,c]);}
const lanternLights=[];
const MODELS=['pagoda','torii','komainu','toro','stone_lantern','ishi_doro','teahouse','bridge','pergola','bamboo','bamboo2','bonsai_pine','bonsai','lanterns','koi'];
const koi=[];
const modelsReady=Promise.all(MODELS.map(loadM)).then(arr=>{const G={};MODELS.forEach((n,i)=>G[n]=arr[i]&&arr[i].scene);window.__koiAnims=arr[MODELS.indexOf('koi')]?arr[MODELS.indexOf('koi')].animations:[];window.__models=Object.keys(G).filter(k=>G[k]);
 // pagoda hill scene: rotate so its stairs come down toward the visitor (+z)
 if(G.pagoda){const s=G.pagoda;s.traverse(m=>{if(m.isMesh&&/^(Sphere|Cube)$/.test(m.name))m.visible=false;});
  s.traverse(m=>{if(m.isMesh&&m.visible){m.castShadow=true;m.receiveShadow=true;if(/Stairs|Grass/.test(m.name))walkMeshes.push(m);const mt=m.material;if(mt&&mt.emissiveMap&&/Lantern/i.test(m.name))mt.emissiveIntensity=2.2;}});
  s.rotation.y=Math.PI;s.position.set(0,PAG.y,PAG.z);scene.add(s);
  for(const zo of[-6.15,-9.45,-11.85,-14.25,-18.05])for(const xo of[-1.55,1.55]){addGlow(-xo,PAG.y+(zo>-7?0:zo>-10?-1.6:zo>-12.5?-2.7:zo>-15?-3.7:-3.85),PAG.z-zo,0.7,0xffa040);}}
 if(G.torii){const t=fit(G.torii,{h:6.6,x:0,z:26});const b=new THREE.Box3().setFromObject(t);const w=b.max.x-b.min.x;circles.push([-w*0.36,26,0.45],[w*0.36,26,0.45]);}
 if(G.komainu)for(const s of[-1,1]){box(1.3,0.9,1.3,capMat,s*4.6,0.45,27.5);fit(G.komainu,{h:1.6,x:s*4.6,z:27.5,y:0.9,ry:s>0?-Math.PI/2:Math.PI/2});circles.push([s*4.6,27.5,0.95]);PROPS.push([s*4.6,27.5,0.95]);}
 const LAMPS=[[-2.9,20],[2.9,20],[-2.9,12],[2.9,12],[-2.9,6.5],[2.9,-6],[-2.9,-12]];
 LAMPS.forEach(([x,z],i)=>{const src=i%3===2&&G.ishi_doro?G.ishi_doro:G.stone_lantern;if(!src)return;fit(src,{h:i%3===2?1.6:2.0,x,z,ry:x<0?Math.PI/2:-Math.PI/2,col:0.95});addGlow(x,i%3===2?1.1:1.35,z,1.0);});
 if(G.toro){fit(G.toro,{h:2.6,x:5.2,z:7,ry:-0.6,col:0.95});addGlow(5.2,1.9,7,1.6);}
 if(G.teahouse){const t=fit(G.teahouse,{h:11.2,x:TEA.x,z:TEA.z});t.traverse(m=>{if(m.isMesh&&/lantern|cloth/i.test(m.name+(m.material&&m.material.name))){m.material=m.material.clone();m.material.emissive=new THREE.Color(0xff8a3a);m.material.emissiveIntensity=0.9;if(m.material.map)m.material.emissiveMap=m.material.map;}});}
 if(G.bridge){const b=fit(G.bridge,{s:(BRIDGE.x1-BRIDGE.x0+0.6)/20.2,x:(BRIDGE.x0+BRIDGE.x1)/2,z:BRIDGE.z});b.traverse(m=>{if(m.isMesh)walkMeshes.push(m);});}
 if(G.pergola){fit(G.pergola,{h:3.2,x:24,z:7});for(const sx of[-1.75,1.75])for(const sz of[-1.75,1.75])circles.push([24+sx,7+sz,0.25]);}
 if(G.bamboo){const br=rng(3);for(const [x0,z0,x1,z1,n] of [[-26.5,10,-26.5,34,9],[26.5,-30,26.5,-6,8],[-26.5,-34,-26.5,-14,7],[26.5,24,26.5,36,4]])for(let i=0;i<n;i++){const t=i/(n-1);const x=x0+(x1-x0)*t+(br()-.5)*1.5,z=z0+(z1-z0)*t+(br()-.5)*1.5;
  fit(i%3===1&&G.bamboo2?G.bamboo2:G.bamboo,{h:7+br()*3,x,z,ry:br()*6.28,cast:i%2===0});circles.push([x,z,0.9]);}}
 if(G.bonsai_pine)for(const z of[-6.2,2.2]){box(0.8,0.7,0.8,woodMat,-12.9,0.35,z);fit(G.bonsai_pine,{h:1.0,x:-12.9,z,y:0.7});circles.push([-12.9,z,0.6]);}
 if(G.bonsai){box(0.9,0.7,0.9,woodMat,-4.2,0.35,-15.6);fit(G.bonsai,{h:1.1,x:-4.2,z:-15.6,y:0.7});circles.push([-4.2,-15.6,0.65]);PROPS.push([-4.2,-15.6,0.65]);}
 if(G.lanterns){fit(G.lanterns,{h:1.5,x:-11.8,z:-11.6,ry:Math.PI/2});solid(-12.4,-13.4,-11.2,-9.8);addGlow(-11.8,1.0,-11.6,1.6,0xff6a30);}
 if(G.koi){const KA=window.__koiAnims||[];
  // skinned fish: SkeletonUtils.clone so each copy gets its own skeleton (plain clone() kept the original bones at the world origin -> one giant fish)
  const probe=SkeletonUtils.clone(G.koi);probe.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(probe,true);const sz=b.getSize(new THREE.Vector3());const L=Math.max(sz.x,sz.y,sz.z)||1;
  for(let i=0;i<9;i++){const o=SkeletonUtils.clone(G.koi);const len=0.32+R()*0.26;o.scale.multiplyScalar(len/L);const holder=new THREE.Group();const inner=new THREE.Group();inner.add(o);
   if(sz.y>=sz.x&&sz.y>=sz.z)o.rotation.x=-Math.PI/2;else if(sz.x>=sz.z)o.rotation.y=Math.PI/2;
   o.traverse(m=>{if(m.isMesh){m.frustumCulled=false;m.castShadow=false;}});
   let mixer=null;if(KA.length){mixer=new THREE.AnimationMixer(o);const a=mixer.clipAction(KA.find(c=>/swim/i.test(c.name))||KA[0]);a.play();a.time=R()*a.getClip().duration;}
   holder.add(inner);scene.add(holder);koi.push({o:holder,len,mixer,a:R()*6.28,r:0.3+R()*0.5,sp:(0.08+R()*0.08)*(R()<0.5?-1:1),ph:R()*6});}}
 // glow sprites + a few real lights
 const spr=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,240,210,1)');g.addColorStop(0.25,'rgba(255,170,80,.6)');g.addColorStop(1,'rgba(255,120,40,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
 for(const [x,y,z,s,c] of glows){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:spr,color:c,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.45,fog:false}));m.position.set(x,y,z);m.scale.setScalar(s*0.55);m.userData.ph=R()*6;scene.add(m);lanternLights.push(m);}
 for(const [x,y,z] of [[0,1.5,12],[5.2,2,7],[-11.8,1.2,-11.6],[0,PAG.y+1.2,-30]]){const l=new THREE.PointLight(0xff9a48,8,12,1.6);l.position.set(x,y,z);scene.add(l);}
 buildHeight();if(SHADOWS){renderer.shadowMap.needsUpdate=true;setTimeout(()=>renderer.shadowMap.needsUpdate=true,3000);}});
// ---------- walkable height field (stairs to the pagoda, the arched bridge) sampled by ray casts ----------
const HF={res:0.25,x0:BOUND.x0,z0:BOUND.z0,nx:0,nz:0,d:null};
function buildHeight(){HF.nx=Math.ceil((BOUND.x1-BOUND.x0)/HF.res)+1;HF.nz=Math.ceil((BOUND.z1-BOUND.z0)/HF.res)+1;HF.d=new Float32Array(HF.nx*HF.nz);
 scene.updateMatrixWorld(true);const rc=new THREE.Raycaster();const dn=new THREE.Vector3(0,-1,0);const o=new THREE.Vector3();
 const regions=[[-1.6,-38,1.6,-14.5,'p'],[-5,-38,5,-29.5,'p'],[BRIDGE.x0-0.6,-1.2,BRIDGE.x1+0.6,1.2,'b']];
 for(const [x0,z0,x1,z1] of regions)for(let x=x0;x<=x1+1e-6;x+=HF.res)for(let z=z0;z<=z1+1e-6;z+=HF.res){
  o.set(x,30,z);rc.set(o,dn);const hits=rc.intersectObjects(walkMeshes,false);let y=0;
  for(const h of hits){if(h.face&&h.object){const nrm=h.face.normal.clone().transformDirection(h.object.matrixWorld);if(nrm.y<0.35)continue;}
   // on the bridge take the deck (lowest upward-facing surface that is above water), elsewhere the highest
   if(x>=BRIDGE.x0-0.6&&x<=BRIDGE.x1+0.6&&Math.abs(z)<=1.2){if(h.point.y>0.05&&h.point.y<2.2){y=y?Math.min(y,h.point.y):h.point.y;}}else y=Math.max(y,h.point.y);}
  const i=Math.round((x-HF.x0)/HF.res),j=Math.round((z-HF.z0)/HF.res);if(i>=0&&j>=0&&i<HF.nx&&j<HF.nz)HF.d[j*HF.nx+i]=Math.max(0,y);}
 window.__hf=true;}
function groundH(x,z){if(!HF.d)return z<-29.5&&Math.abs(x)<5?PAG.y:0;const fx=(x-HF.x0)/HF.res,fz=(z-HF.z0)/HF.res;const i=Math.floor(fx),j=Math.floor(fz);if(i<0||j<0||i>=HF.nx-1||j>=HF.nz-1)return 0;
 const a=HF.d[j*HF.nx+i],b=HF.d[j*HF.nx+i+1],c=HF.d[(j+1)*HF.nx+i],d=HF.d[(j+1)*HF.nx+i+1];const u=fx-i,v=fz-j;return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;}
// ---------- falling sakura petals ----------
const PET_N=Q.get('petals')?+Q.get('petals'):700;const pet={p:new Float32Array(PET_N*3),v:new Float32Array(PET_N*3),ph:new Float32Array(PET_N)};
{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pet.p,3));g.setAttribute('ph',new THREE.BufferAttribute(pet.ph,1));
 const tex=canvasTex(32,32,(x,w,h)=>{x.fillStyle='rgba(0,0,0,0)';x.clearRect(0,0,w,h);x.fillStyle='#ffd6e2';x.beginPath();x.ellipse(16,16,12,7,0.6,0,7);x.fill();x.fillStyle='#f3a3b9';x.beginPath();x.ellipse(18,15,5,3,0.6,0,7);x.fill();});
 const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:tex},t:{value:0},scale:{value:innerHeight*renderer.getPixelRatio()}},
  vertexShader:'attribute float ph;varying float vr;uniform float scale;uniform float t;void main(){vr=ph+t*(1.5+fract(ph)*2.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(0.09*scale/(-mv.z),1.,28.);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform sampler2D map;varying float vr;void main(){vec2 c=gl_PointCoord-.5;float s=sin(vr),k=cos(vr);c=vec2(c.x*k-c.y*s,(c.x*s+c.y*k)*(.4+.6*abs(sin(vr*.7))))+.5;vec4 col=texture2D(map,c);if(col.a<.4)discard;gl_FragColor=vec4(col.rgb*vec3(1.,.93,.9),col.a);}'});
 pet.pts=new THREE.Points(g,m);pet.pts.frustumCulled=false;scene.add(pet.pts);
 const seed=i=>{const t=TREES[i%TREES.length];pet.p[i*3]=t[0]+(R()-.5)*6;pet.p[i*3+1]=1+R()*5;pet.p[i*3+2]=t[1]+(R()-.5)*6;pet.v[i*3]=0.25+R()*0.3;pet.v[i*3+1]=-(0.25+R()*0.35);pet.v[i*3+2]=(R()-.5)*0.3;pet.ph[i]=R()*100;};
 pet.seed=seed;for(let i=0;i<PET_N;i++)seed(i);}
function stepPetals(dt,t){pet.pts.material.uniforms.t.value=t;for(let i=0;i<PET_N;i++){const k=i*3;const ph=pet.ph[i];
  pet.p[k]+=(pet.v[k]+Math.sin(t*0.9+ph)*0.35)*dt;pet.p[k+1]+=(pet.v[k+1]+Math.sin(t*2.1+ph)*0.12)*dt;pet.p[k+2]+=(pet.v[k+2]+Math.cos(t*0.7+ph)*0.3)*dt;
  if(pet.p[k+1]<0.03){if(R()<0.02||inPond(pet.p[k],pet.p[k+2])){pet.seed(i);pet.p[k+1]=4+R()*2.5;}else pet.p[k+1]=0.03;}}
 pet.pts.geometry.attributes.position.needsUpdate=true;}
// ---------- koi ripples ----------
const RIP_N=10;const ripples=[];
{const tex=canvasTex(128,128,(x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='rgba(255,245,230,.9)';x.lineWidth=5;x.beginPath();x.arc(64,64,54,0,7);x.stroke();x.lineWidth=2;x.beginPath();x.arc(64,64,40,0,7);x.stroke();});
 for(let i=0;i<RIP_N;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:0}));m.position.y=0.06;scene.add(m);ripples.push({m,life:1+R()});}}
function stepRipples(dt){for(const r of ripples){r.life+=dt/2.6;if(r.life>=1){r.life=0;const a=R()*6.28,d=Math.sqrt(R())*0.8;const kf=koi.length&&R()<0.6?pick(koi):null;
   if(kf){r.m.position.x=kf.o.position.x;r.m.position.z=kf.o.position.z;}else{r.m.position.x=POND.x+Math.cos(a)*POND.rx*d;r.m.position.z=POND.z+Math.sin(a)*POND.rz*d;}if(onBridge(r.m.position.x,r.m.position.z,-0.5)){r.life=0.99;}}
  r.m.scale.setScalar(0.2+r.life*1.8);r.m.material.opacity=(1-r.life)*0.55;}}
function stepKoi(dt,t){for(const f of koi){f.a+=f.sp*dt*3;const rr=f.r+Math.sin(t*0.3+f.ph)*0.12;const x=POND.x+Math.cos(f.a)*POND.rx*rr,z=POND.z+Math.sin(f.a)*POND.rz*rr;
  const dx=x-f.o.position.x,dz=z-f.o.position.z;f.o.position.set(x,-0.1,z);if(f.mixer)f.mixer.update(dt);if(Math.hypot(dx,dz)>1e-5)f.o.rotation.y=Math.atan2(dx,dz);f.o.children[0].rotation.y=Math.sin(t*5+f.ph)*0.18;}}
// ---------- navigation graph ----------
const nodes=[],adj=[],slots=[];
// test hook: smallest clearance between any nav edge / live route segment and a prop collider
function navClear(){let w=99;const seg=(a,b)=>{for(const [x,z,r] of PROPS){const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz||1e-9;let t=((x-a[0])*dx+(z-a[1])*dz)/L;t=Math.max(0,Math.min(1,t));w=Math.min(w,Math.hypot(a[0]+dx*t-x,a[1]+dz*t-z)-r);}};
 for(let i=0;i<adj.length;i++)for(const [j] of adj[i])seg(nodes[i],nodes[j]);for(const p of people)if(p.state==='walk'&&p.route){let c=[p.x,p.z];for(const q of p.route){seg(c,q);c=q;}}return +w.toFixed(3);}
const faceTo=(x,z,tx,tz)=>Math.atan2(tx-x,tz-z);
// built after the models load, so every prop collider (lanterns, torii, komainu, bamboo...) is in the graph
function initNav(){for(let x=BOUND.x0+1.5;x<=BOUND.x1-1.5;x+=2.5)for(let z=BOUND.z0+1.5;z<=BOUND.z1-1.5;z+=2.5)if(!blocked(x,z,0.7))nodes.push([x,z]);
for(let x=BRIDGE.x0+0.5;x<BRIDGE.x1;x+=1.5)nodes.push([x,BRIDGE.z]);for(let z=-15;z>-30;z-=1.5)nodes.push([0,z]);for(const [x,z] of [[0,-30.2],[-2,-31.5],[2,-31.5],[-4,-34],[4,-34]])nodes.push([x,z]);
nodes.forEach(()=>adj.push([]));for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const d=Math.hypot(nodes[i][0]-nodes[j][0],nodes[i][1]-nodes[j][1]);if(d<3.8&&clearSeg(nodes[i],nodes[j],0.42)){adj[i].push([j,d]);adj[j].push([i,d]);}}
// ---------- activity slots ----------
const S=(kind,x,z,face,clip,extra={})=>slots.push({kind,x,z,face,clip,busy:null,...extra});
for(let k=0;k<10;k++){const a=k/10*Math.PI*2;const x=POND.x+Math.cos(a)*(POND.rx+0.7),z=POND.z+Math.sin(a)*(POND.rz+0.7);if(Math.abs(z)<1.5||blocked(x,z,0.3))continue;S('feed',x,z,faceTo(x,z,POND.x,POND.z),k%2?'Fixing_Kneeling':'Idle_Look');}
for(const x of[8,10.5,15.5,18])S('bridge',x,BRIDGE.z+(x%2?0.3:-0.3),x<13?Math.PI:0,pick(['Idle_Look','Spell_Simple_Idle_Loop','Phone']));
for(const [x,z,tx,tz] of [[0,31,0,26],[-2,22,0,26],[3,32,0,26],[0,-31,0,-34],[-3,-32.5,0,-34],[2.5,-31,0,-34],[-8,-1,-19,-2],[-14,8,-19,-2],[22,3,24,7],[6,12,5.2,7],[0,-13,0,-30]])S('photo',x,z,faceTo(x,z,tx,tz),'Spell_Simple_Idle_Loop',{prop:'phone'});
for(const [x,z] of [[-1.5,-31],[1.5,-31],[0,-30.5]])S('bow',x,z,Math.PI,'Interact');
for(const[cx,cz]of [[-5,16],[6,24],[-10,-14],[18,-12],[22,16],[-8,8],[4,-8],[-20,16]]){for(let k=0;k<3;k++){const a=k/3*Math.PI*2+0.4;const x=cx+Math.cos(a)*0.8,z=cz+Math.sin(a)*0.8;if(blocked(x,z,0.3))continue;S('chat',x,z,faceTo(x,z,cx,cz),pick(['Idle_Talking_Loop','Idle_Listen','Idle_Talking_Loop','Idle_Look']),{group:cx+','+cz});}}
for(const [x,z,ry] of benches){const c=Math.cos(ry),s=Math.sin(ry);for(const k of[-0.5,0.5]){const px=x+(Math.abs(s)>0.5?0:k),pz=z+(Math.abs(s)>0.5?k:0);S('sit',px,pz,ry,'Sitting_Idle_Loop',{sx:px,sz:pz});}}
}
function clearSeg(a,b,m=0.45){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.ceil(d/0.3);for(let i=1;i<n;i++){const t=i/n;if(blocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,m))return false;}return true;}
function nearestNode(p){let bi=0,bd=1e9;for(let i=0;i<nodes.length;i++){const d=(nodes[i][0]-p[0])**2+(nodes[i][1]-p[1])**2;if(d<bd){bd=d;bi=i;}}return bi;}
function path(a,b){if(clearSeg(a,b,0.42))return[b];const s=nearestNode(a),t=nearestNode(b);const dist=new Float32Array(nodes.length).fill(1e9),prev=new Int32Array(nodes.length).fill(-1),done=new Uint8Array(nodes.length);dist[s]=0;
 for(;;){let u=-1,bd=1e9;for(let i=0;i<nodes.length;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}if(u<0||u===t)break;done[u]=1;for(const[v,w]of adj[u])if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;}}
 if(prev[t]<0&&s!==t)return[nodes[s]];
 const out=[];let c=t;while(c>=0){out.unshift(nodes[c]);c=prev[c];}out.push(b);
 const sm=[];let cur=a;let i=0;while(i<out.length){let j=out.length-1;while(j>i&&!clearSeg(cur,out[j],0.42))j--;sm.push(out[j]);cur=out[j];i=j+1;}return sm;}
// ---------- people (shared engine with world-ls) ----------
const people=[];let clipsByName={};
function makeProp(kind){const g=new THREE.Group();const p=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.15,0.01),new THREE.MeshBasicMaterial({color:0x111111}));g.add(p);return g;}
function play(p,name,fade=0.35){const a=p.actions[name]||p.actions.Idle_Loop;if(!a)return;if(p.cur===a){p.clip=name;return;}a.reset().setEffectiveWeight(1).fadeIn(fade).play();a.time=R()*a.getClip().duration;if(p.cur)p.cur.fadeOut(fade);p.cur=a;p.clip=name;}
function setProp(p,kind){for(const k in p.props)p.props[k].visible=(k===kind);}
function freeSlot(kinds,p){const c=slots.filter(s=>!s.busy&&kinds.includes(s.kind)&&(s.kind!=='sit'||p.canSit));return c.length?pick(c,R):null;}
function chooseNext(p){if(p.slot){p.slot.busy=null;p.slot=null;}setProp(p,null);if(p.fixed){p.state='do';p.doUntil=1e9;return;}
 const roll=R();let target,slot=null;
 if(roll<0.14)slot=freeSlot(['feed'],p);else if(roll<0.26)slot=freeSlot(['bridge'],p);else if(roll<0.42)slot=freeSlot(['photo'],p);else if(roll<0.5)slot=freeSlot(['bow'],p);else if(roll<0.7)slot=freeSlot(['chat'],p);else if(roll<0.8)slot=freeSlot(['sit'],p);
 if(slot){slot.busy=p;p.slot=slot;target=[slot.x,slot.z];}else target=pick(nodes);
 p.route=path([p.x,p.z],target);p.state='walk';p.speed=0.9+R()*0.4;play(p,R()<0.4?'Walk_Formal_Loop':'Walk_Loop');}
function arrive(p,t){const s=p.slot;p.state='do';
 if(s){p.faceTo=s.face;p.doUntil=t+(s.kind==='chat'?20+R()*40:s.kind==='sit'?25+R()*50:s.kind==='feed'?12+R()*15:10+R()*18);
  play(p,s.clip);setProp(p,s.prop||(s.clip==='Phone'?'phone':null));}
 else{p.faceTo=p.yaw+(R()-.5)*2;p.doUntil=t+3+R()*8;play(p,R()<0.5?'Idle_Look':'Idle_Loop');}}
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
function updatePerson(p,dt,t){
 if(p.state==='walk'){const w=p.route&&p.route[0];if(!w){arrive(p,t);}else{const dx=w[0]-p.x,dz=w[1]-p.z,d=Math.hypot(dx,dz);
  if(d<0.15){p.route.shift();if(!p.route.length)arrive(p,t);}else{const st=Math.min(d,p.speed*dt);p.x+=dx/d*st;p.z+=dz/d*st;const ty=Math.atan2(dx,dz);p.yaw+=angDiff(ty,p.yaw)*Math.min(1,dt*6);}}}
 else{p.yaw+=angDiff(p.faceTo,p.yaw)*Math.min(1,dt*4);if(t>p.doUntil)chooseNext(p);}
 p.y+=(groundH(p.x,p.z)-p.y)*Math.min(1,dt*10);p.obj.position.set(p.x,p.y,p.z);p.obj.rotation.y=p.yaw;}
const CLIPMAP={Walk_Loop:{m:'m_walk_neutral_01',f:'f_walk_neutral_01'},Walk_Formal_Loop:{m:'m_walk_slow_01',f:'f_walk_stroll_01'},
 Idle_Loop:{m:'m_idle_neutral_01',f:'f_idle_neutral_01'},Idle_Look:{m:'m_idle_look_around_01',f:'f_idle_look_around_01'},
 Idle_Talking_Loop:{m:'m_gestic_talk_neutral_01',f:'f_gestic_talk_neutral_01'},Idle_Listen:{m:'m_gestic_listen_neutral_01',f:'f_gestic_listen_neutral_01'},
 Sitting_Idle_Loop:{m:'m_sit_chair_idle_neutral_01',f:'f_sit_chair_idle_neutral_01'},
 Fixing_Kneeling:{m:'m_crouch_idle',f:'f_crouch_idle'},Interact:{m:'m_idle_neutral_01',f:'f_idle_neutral_01'},
 Spell_Simple_Idle_Loop:{m:'m_take_picture',f:'m_take_picture'},Phone:{m:'m_cell_phone_textmessage',f:'f_cell_phone_textmessage'}};
function prepClip(c){for(const t of c.tracks)t.name=t.name.replace(/^Bip01\./,'RBRoot.');c.tracks=c.tracks.filter(t=>{if(t.name.endsWith('.scale'))return false;if(t.name.endsWith('.position'))return /^(RBRoot|Bip01_Pelvis)\.position$/.test(t.name);return true;});
 if(/walk/.test(c.name))for(const t of c.tracks)if(t.name.endsWith('.position')){const v=t.values,n=t.times.length,T=t.times[n-1]-t.times[0]||1;
  for(const k of[0,1,2]){const d=v[(n-1)*3+k]-v[k];for(let i=0;i<n;i++)v[i*3+k]-=d*(t.times[i]-t.times[0])/T;}}
 return c;}
// procedural bow at the pagoda (no free mocap): spine + head bend layered on the idle
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_v=new THREE.Vector3(),_ax=new THREE.Vector3();
function rotW(b,axis,ang){if(!b)return;b.parent.getWorldQuaternion(_q);_v.copy(axis).applyQuaternion(_q.invert());_q2.setFromAxisAngle(_v.normalize(),ang);b.quaternion.premultiply(_q2);b.updateMatrixWorld(true);}
function applyPose(p,t){if(p.clip!=='Interact'||p.state!=='do'||!p.B||!p.B.sp)return;p.obj.updateMatrixWorld(true);_ax.set(Math.cos(p.yaw),0,-Math.sin(p.yaw));const ax=_ax.clone();
 const bow=0.15+0.35*Math.max(0,Math.sin((t+p.ph)*1.4));rotW(p.B.sp,ax,bow*0.5);rotW(p.B.sp2,ax,bow*0.5);rotW(p.B.head,ax,bow*0.4);
 for(const[s,ua,fa]of[[1,p.B.ual,p.B.fal],[-1,p.B.uar,p.B.far]]){rotW(ua,ax,-0.5);rotW(ua,new THREE.Vector3(0,1,0),-s*0.35);rotW(fa,ax,-1.25);rotW(fa,new THREE.Vector3(0,1,0),-s*0.55);}}
const P={x:0,z:34,yaw:0,pitch:-0.02,vx:0,vz:0,r:0.35,eye:1.62,y:0};
if(Q.get('x'))P.x=+Q.get('x');if(Q.get('z'))P.z=+Q.get('z');
const AV=['Female_Adult_01','Male_Adult_02','Female_Adult_04','Male_Adult_05','Female_Adult_02','Male_Adult_08','Female_Child_01','Female_Adult_05','Male_Adult_03','Female_Adult_07','Female_Adult_11','Female_Adult_13'];
const TP=[['elder',1.56],['young',1.73],['tourist',1.63]];
const KIM=[0xf3d6de,0xd7e3f0,0xe9e2cc,0xf0dccb,0xffffff,0xdfe8d8];
let ready=false;
function spawnAll(){const N=+(Q.get('n')||30);
 const blob=new THREE.Mesh(new THREE.CircleGeometry(0.34,16).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.22,depthWrite:false}));
 const far=nodes.filter(q=>Math.hypot(q[0]-P.x,q[1]-P.z)>10&&q[1]>-29);
 const mk=(o,actions,mixer,av,extra={})=>{const holder=new THREE.Group();holder.add(o.parent?o.parent:o);const sh=blob.clone();sh.position.y=0.02;holder.add(sh);scene.add(holder);
  const n=pick(far.length?far:nodes);const p={obj:holder,mixer,actions,props:{},B:extra.B||null,av,ph:R()*10,x:n[0],z:n[1],y:0,yaw:R()*6.28,state:'do',doUntil:R()*4,faceTo:0,cur:null,canSit:!!extra.canSit,fixed:extra.fixed};
  if(extra.props)p.props=extra.props;p.faceTo=p.yaw;play(p,'Idle_Loop',0);people.push(p);return p;};
 const rb=new Promise(res=>LD.load(PEOPLE_DIR+'rb/anims.glb',ag=>{for(const c of ag.animations)clipsByName[c.name]=prepClip(c);res(true);},undefined,()=>res(false)));
 const loadP=u=>new Promise(res=>LD.load(u,g=>res(g),undefined,()=>res(null)));
 Promise.all([rb,Promise.all(AV.map(n=>loadP(PEOPLE_DIR+'rb2/'+n+'.glb'))),Promise.all(TP.map(t=>loadP(PEOPLE_DIR+'tp/'+t[0]+'.glb'))),Promise.resolve(null)]).then(([okA,rbs,tps,alina])=>{
  const refY=g=>{const c=clipsByName[g+'_idle_neutral_01'];const t=c&&c.tracks.find(t=>t.name==='RBRoot.position');return t?t.values[1]:0.9;};const REFY={m:refY('m'),f:refY('f')};
  const cache={};function clipFor(nm,f,c,ry){const key=nm+'|'+c.name;if(cache[key])return cache[key];const k=ry/REFY[f];
   const tr=c.tracks.map(t=>{if(t.name!=='RBRoot.position')return t;const u=t.clone();for(let i=0;i<u.values.length;i++)u.values[i]*=k;return u;});return cache[key]=new THREE.AnimationClip(c.name+'|'+nm,c.duration,tr);}
  const bases=[];AV.forEach((nm,i)=>{const g=rbs[i];if(!g||!okA)return;g.scene.traverse(n=>{if(n.name==='Bip01'||(n.children.some(k=>/Pelvis$/.test(k.name))&&!n.isBone)){n.name='RBRoot';g.scene.userData.ry=n.position.y;}});
   g.scene.traverse(m=>{if(m.isMesh){const mt=m.material;if(mt.transparent||/opacity/.test(mt.name)){mt.transparent=false;mt.alphaTest=0.5;mt.depthWrite=true;}mt.side=/opacity/.test(mt.name)?THREE.DoubleSide:THREE.FrontSide;mt.envMapIntensity=0.7;}});bases.push([nm,g.scene]);});
  const TPC={};const tbases=[];TP.forEach(([nm,h],i)=>{const g=tps[i];if(!g)return;for(const a of g.animations){const c=a.clone();c.tracks=c.tracks.filter(t=>t.name.endsWith('.quaternion')||/^Hip\.position$/.test(t.name));TPC[a.name]=c;}tbases.push([nm,h,g.scene]);});
  const tintMats={};
  const nTP=tbases.length&&TPC.walk?Math.round(N*0.2):0,nAL=alina?2:0,nRB=bases.length?N-nTP-nAL:0;
  for(let i=0;i<nRB;i++){const [nm,base]=bases[i%bases.length];const f=/^Female/.test(nm)?'f':'m';const o=SkeletonUtils.clone(base);o.scale.setScalar(0.94+R()*0.1);
   const ti=i%KIM.length;o.traverse(m=>{if(m.isMesh){m.frustumCulled=false;m.castShadow=false;if(ti&&!/skin|head|hair|eye/i.test(m.material.name)){const k=m.material.uuid+ti;if(!tintMats[k]){const c=m.material.clone();c.color.multiply(new THREE.Color(KIM[ti]));tintMats[k]=c;}m.material=tintMats[k];}}});
   const mixer=new THREE.AnimationMixer(o);const actions={};for(const n in CLIPMAP){const c=clipsByName[CLIPMAP[n][f]];if(c)actions[n]=mixer.clipAction(clipFor(nm,f,c,base.userData.ry||REFY[f]));}
   const ts=0.9+R()*0.2;for(const k in actions)actions[k].timeScale=ts;
   const bn=r=>{let x=null;o.traverse(b=>{if(!x&&b.isBone&&r.test(b.name))x=b;});return x;};
   const B={sp:bn(/Spine1$/),sp2:bn(/Spine2$/),head:bn(/_Head$/),ual:bn(/L_UpperArm$/),uar:bn(/R_UpperArm$/),fal:bn(/L_Forearm$/),far:bn(/R_Forearm$/)};
   const hand=bn(/R_Hand$/);const props={};if(hand){o.updateMatrixWorld(true);const ws=new THREE.Vector3();hand.getWorldScale(ws);const pr=makeProp('phone');pr.scale.setScalar(1/ws.x);pr.position.set(0.08/ws.x,0,0);pr.visible=false;hand.add(pr);props.phone=pr;}
   mk(o,actions,mixer,nm,{B,props,canSit:true});}
  const TURN=-Math.PI/2;
  for(let i=0;i<nTP;i++){const [nm,h,base]=tbases[i%tbases.length];const o=SkeletonUtils.clone(base);o.scale.setScalar(h*(0.92+R()*0.12));const ti=(i+2)%KIM.length;
   o.traverse(m=>{if(m.isMesh){m.frustumCulled=false;m.castShadow=false;const k=m.material.uuid+'t'+ti;if(!tintMats[k]){const c=m.material.clone();if(c.color)c.color.multiply(new THREE.Color(KIM[ti]));tintMats[k]=c;}m.material=tintMats[k];}});
   const turn=new THREE.Group();turn.rotation.y=TURN;turn.add(o);const mixer=new THREE.AnimationMixer(o);const actions={};
   for(const n of Object.keys(CLIPMAP))actions[n]=mixer.clipAction(/^Walk/.test(n)?TPC.walk:TPC.idle);const ts=0.88+R()*0.24;for(const k in actions)actions[k].timeScale=ts;
   mk(turn,actions,mixer,'tripo_'+nm,{});}
  for(let i=0;i<nAL;i++){const o=SkeletonUtils.clone(alina.scene);const b=new THREE.Box3().setFromObject(alina.scene);const k=1.6/(b.max.y-b.min.y);o.scale.setScalar(k);o.traverse(m=>{if(m.isMesh){m.frustumCulled=false;m.castShadow=false;}});
   const mixer=new THREE.AnimationMixer(o);const a=alina.animations[0]?mixer.clipAction(alina.animations[0]):null;const actions={};if(a){actions.Idle_Loop=a;a.timeScale=0.9+i*0.15;}
   const p=mk(o,actions,mixer,'alina',{fixed:true});const spot=i?[10.2,-0.25,Math.PI*0.5]:[-2.5,23.5,Math.PI*0.9];p.x=spot[0];p.z=spot[1];p.yaw=p.faceTo=spot[2];}
  ready=true;document.getElementById('load').style.opacity=0;setTimeout(()=>{const l=document.getElementById('load');if(l)l.remove();},700);});}
modelsReady.then(()=>{initNav();spawnAll();});
// ---------- player ----------
const joy={x:0,y:0,id:null};const keys={};
const J=document.getElementById('joy'),K=document.getElementById('knob');
J.addEventListener('pointerdown',e=>{joy.id=e.pointerId;J.setPointerCapture(e.pointerId);jmove(e);e.preventDefault();});
J.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)jmove(e);});
const jend=e=>{if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;K.style.transform='';}};J.addEventListener('pointerup',jend);J.addEventListener('pointercancel',jend);
function jmove(e){const b=J.getBoundingClientRect();let dx=(e.clientX-(b.left+b.width/2))/(b.width*0.4),dy=(e.clientY-(b.top+b.height/2))/(b.height*0.4);const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}joy.x=dx;joy.y=dy;K.style.transform=`translate(${dx*b.width*0.4}px,${dy*b.height*0.4}px)`;}
const look={id:null,lx:0,ly:0};const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{if(look.id!==null)return;look.id=e.pointerId;look.lx=e.clientX;look.ly=e.clientY;cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{if(e.pointerId!==look.id)return;P.yaw+=(e.clientX-look.lx)*0.0055;P.pitch=Math.max(-1.1,Math.min(1.0,P.pitch-(e.clientY-look.ly)*0.0045));look.lx=e.clientX;look.ly=e.clientY;hideTip();});
const lend=e=>{if(e.pointerId===look.id)look.id=null;};cv.addEventListener('pointerup',lend);cv.addEventListener('pointercancel',lend);
addEventListener('keydown',e=>{keys[e.code]=1;});addEventListener('keyup',e=>{keys[e.code]=0;});
// no pinch / double-tap zoom
for(const ev of['gesturestart','gesturechange','dblclick'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
let tipHidden=false;function hideTip(){if(!tipHidden){tipHidden=true;document.getElementById('tip').style.opacity=0;}}
let stuckFrames=0,maxStuck=0;
function updatePlayer(dt){let f=-joy.y,s=joy.x;if(keys.KeyW||keys.ArrowUp)f=1;if(keys.KeyS||keys.ArrowDown)f=-1;if(keys.KeyA)s=-1;if(keys.KeyD)s=1;if(keys.ArrowLeft)P.yaw-=dt*1.8;if(keys.ArrowRight)P.yaw+=dt*1.8;
 const m=Math.hypot(f,s);if(m>1){f/=m;s/=m;}const sp=2.4;
 const fx=Math.sin(P.yaw),fz=-Math.cos(P.yaw);const rx=Math.cos(P.yaw),rz=Math.sin(P.yaw);
 const tvx=(fx*f+rx*s)*sp,tvz=(fz*f+rz*s)*sp;const k=Math.min(1,dt*10);P.vx+=(tvx-P.vx)*k;P.vz+=(tvz-P.vz)*k;
 const ox=P.x,oz=P.z;let [nx,nz]=resolve(P.x+P.vx*dt,P.z+P.vz*dt,P.r);
 const want=m>0.2,moved=Math.hypot(nx-ox,nz-oz);if(want&&moved<0.002)stuckFrames++;else stuckFrames=0;maxStuck=Math.max(maxStuck,stuckFrames);
 if(stuckFrames>90&&nodes.length){const n=nodes[nearestNode([nx,nz])];nx+=(n[0]-nx)*0.1;nz+=(n[1]-nz)*0.1;}
 if(blocked(nx,nz,P.r*0.5)&&nodes.length){const n=nodes[nearestNode([nx,nz])];nx=n[0];nz=n[1];}
 P.x=nx;P.z=nz;document.body.classList.toggle('walking',m>0.2);if(m>0.2)hideTip();
 P.y+=(groundH(P.x,P.z)-P.y)*Math.min(1,dt*8);
 const bob=Math.sin(performance.now()/1000*8)*0.025*Math.min(1,Math.hypot(P.vx,P.vz)/sp);
 camera.position.set(P.x,P.y+P.eye+bob,P.z);camera.rotation.set(P.pitch,-P.yaw,0,'YXZ');}
// ---------- post ----------
const POST=Q.get('post')!=='0';
if(POST){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bl=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.38,0.5,0.92);bl.resolution.set(innerWidth/2,innerHeight/2);composer.addPass(bl);
 composer.addPass(new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);vec3 x=c.rgb*vec3(1.04,1.0,.94);vec2 d=vUv-.5;x*=1.-dot(d,d)*.5;gl_FragColor=vec4(x,c.a);}'}));
 composer.addPass(new OutputPass());}
// ---------- loop ----------
const clock=new THREE.Clock();let lastNow=performance.now(),frames=0,fpsAvg=0,simT=0;const fpsHist=[];
renderer.setAnimationLoop(()=>{const dt=Math.min(0.1,clock.getDelta());simT+=dt;frames++;
 const now=performance.now();fpsHist.push(Math.max(1e-3,(now-lastNow)/1000));lastNow=now;if(fpsHist.length>60)fpsHist.shift();fpsAvg=fpsHist.length/fpsHist.reduce((a,b)=>a+b,0);
 updatePlayer(dt);stepPetals(dt,simT);stepRipples(dt);stepKoi(dt,simT);
 for(const l of lanternLights){l.material.opacity=0.7+0.2*Math.sin(simT*3+l.userData.ph)+0.08*Math.sin(simT*11+l.userData.ph*3);}
 waterMat.color.setHSL(0.47,0.3,0.24+0.01*Math.sin(simT*0.5));
 for(let i=0;i<people.length;i++){const p=people[i];updatePerson(p,dt,simT);const d=Math.hypot(p.x-P.x,p.z-P.z);
  const every=d>30?4:d>16?2:1;p.acc=(p.acc||0)+dt;if((frames+i)%every===0){p.mixer.update(p.acc);p.acc=0;if(d<30)applyPose(p,simT);}}
 if(window.__w&&window.__w.cam){const c=window.__w.cam;camera.position.set(c[0],c[1],c[2]);camera.lookAt(c[3],c[5]??0,c[4]);}
 if(composer)composer.render();else renderer.render(scene,camera);});
window.__w={state:()=>({ready,build:BUILD,x:P.x,z:P.z,y:P.y,yaw:P.yaw,fps:fpsAvg,frames,people:people.length,maxStuck,blocked:blocked(P.x,P.z,0.01),models:window.__models||[],
 sample:people.slice(0,6).map(p=>({x:+p.x.toFixed(3),z:+p.z.toFixed(3),clip:p.clip,state:p.state})),clips:people.reduce((m,p)=>{m[p.clip]=(m[p.clip]||0)+1;return m;},{}),
 avatars:[...new Set(people.map(p=>p.av))].length,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,petals:PET_N,koi:koi.length}),
 _people:()=>people,navClear:()=>navClear(),bgv:()=>window.__bgvState?window.__bgvState():[],cam:null,set:(x,z,yaw)=>{P.x=x;P.z=z;if(yaw!==undefined)P.yaw=yaw;P.vx=P.vz=0;}};
// ---------- ambient sound: procedural water, wind and birds (Web Audio) + CC0/PD temple bell and soft crowd; starts on first tap, mute toggle ----------
{const AU={started:false,muted:localStorage.getItem('teMute')==='1',src:{}};window.__aud=()=>({started:AU.started,muted:AU.muted,ctx:AU.ctx?AU.ctx.state:'none',playing:Object.fromEntries(Object.entries(AU.src).map(([k,v])=>[k,!!v.isPlaying]))});
 const btn=document.createElement('button');btn.id='mute';btn.setAttribute('aria-label','Sound');
 btn.style.cssText='position:fixed;z-index:7;top:calc(var(--sa-t) + 10px);right:calc(var(--sa-r) + 12px);width:44px;height:44px;border-radius:50%;border:.5px solid rgba(255,255,255,.18);background:rgba(22,18,14,.42);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);color:#fbf6ee;font-size:19px;padding:0';
 const paint=()=>{btn.textContent=(!AU.started||AU.muted)?'🔇':'🔊';};paint();document.body.append(btn);
 function start(){if(AU.started)return;AU.started=true;const L=new THREE.AudioListener();AU.L=L;const ctx=L.context;AU.ctx=ctx;camera.add(L);if(camera.parent!==scene)scene.add(camera);
  L.setMasterVolume(AU.muted?0:1);if(ctx.state!=='running')ctx.resume();
  const noiseBuf=(()=>{const b=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);const d=b.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;last=(last+0.02*w)/1.02;d[i]=last*3.5;}return b;})();
  const posSrc=(k,pos,ref,make)=>{const a=new THREE.PositionalAudio(L);a.setRefDistance(ref);a.setRolloffFactor(1.3);const o=new THREE.Object3D();o.position.set(...pos);scene.add(o);o.add(a);make(a);AU.src[k]=a;return a;};
  // water trickle near the pond (filtered brown noise, gently modulated)
  posSrc('water',[POND.x-POND.rx,0.5,POND.z],5,a=>{const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=900;bp.Q.value=0.6;
   const lfo=ctx.createOscillator();lfo.frequency.value=3.1;const lg=ctx.createGain();lg.gain.value=350;lfo.connect(lg);lg.connect(bp.frequency);lfo.start();a.setNodeSource(s);a.setFilter(bp);a.setVolume(1.4);s.start();a.isPlaying=true;});
  // wind in the trees (global)
  {const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;const g=ctx.createGain();g.gain.value=0.08;
   const lfo=ctx.createOscillator();lfo.frequency.value=0.09;const lg=ctx.createGain();lg.gain.value=0.05;lfo.connect(lg);lg.connect(g.gain);lfo.start();s.connect(lp);lp.connect(g);g.connect(L.getInput());s.start();AU.src.wind={isPlaying:true};}
  // birds: short synthesized chirps from random trees
  const birds={isPlaying:true};AU.src.birds=birds;const chirp=()=>{const t0=ctx.currentTime;const n=2+Math.floor(Math.random()*4);const base=2400+Math.random()*1800;
   for(let i=0;i<n;i++){const o=ctx.createOscillator();const g=ctx.createGain();o.type='sine';const st=t0+i*0.13;o.frequency.setValueAtTime(base,st);o.frequency.exponentialRampToValueAtTime(base*(1.3+Math.random()*0.5),st+0.08);
    g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(0.05,st+0.01);g.gain.exponentialRampToValueAtTime(0.0008,st+0.1);const pn=ctx.createStereoPanner?ctx.createStereoPanner():null;
    o.connect(g);if(pn){pn.pan.value=Math.random()*2-1;g.connect(pn);pn.connect(L.getInput());}else g.connect(L.getInput());o.start(st);o.stop(st+0.12);}
   setTimeout(chirp,1500+Math.random()*5000);};setTimeout(chirp,800);
  const AL=new THREE.AudioLoader();
  const crowd=new THREE.Audio(L);crowd.setLoop(true);crowd.setVolume(0.12);AU.src.crowd=crowd;AL.load(`garden/aud/crowd.m4a?v=${BUILD}`,b=>{crowd.setBuffer(b);crowd.play();});
  const bell=posSrc('bell',[0,PAG.y+3,PAG.z],12,a=>{a.setVolume(0.7);});AL.load(`garden/aud/gong.m4a?v=${BUILD}`,b=>{bell.setBuffer(b);});
  const ring=()=>{if(bell.buffer&&!bell.isPlaying)bell.play();setTimeout(ring,40000+Math.random()*30000);};setTimeout(ring,5000);paint();}
 const first=e=>{if(e.target===btn)return;start();removeEventListener('pointerdown',first,true);};addEventListener('pointerdown',first,true);
 btn.addEventListener('pointerdown',e=>{e.stopPropagation();if(!AU.started){AU.muted=false;start();}else{AU.muted=!AU.muted;AU.L.setMasterVolume(AU.muted?0:1);if(!AU.muted)AU.ctx.resume();}
  localStorage.setItem('teMute',AU.muted?'1':'0');paint();},true);}
