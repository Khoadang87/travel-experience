// Longshan Temple courtyard — walk-around prototype (build w2a).
// Geometry procedural; PBR textures + HDRI sky from Poly Haven (CC0); people: Microsoft Rocketbox avatars + mocap (MIT). See CREDITS.md.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const BUILD='s1a'; window.__build=BUILD;
const Q=new URLSearchParams(location.search);
// ---------- seeded RNG ----------
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
const R=rng(20261104);
const pick=(a,r=R)=>a[Math.floor(r()*a.length)];
// ---------- renderer ----------
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,Q.get('dpr')?+Q.get('dpr'):1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const SHADOWS=Q.get('shadows')!=='0';if(SHADOWS){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;}
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
{const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;scene.environmentIntensity=0.6;}
scene.fog=new THREE.Fog(0xe2b48a,28,125);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.1,400);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);if(composer)composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
// sky dome (vertex gradient)
{const g=new THREE.SphereGeometry(300,24,12);const c=[];const p=g.attributes.position;const top=new THREE.Color(0x6f86b8),hor=new THREE.Color(0xf6b878);
 for(let i=0;i<p.count;i++){const t=Math.max(0,p.getY(i)/300);const k=top.clone().lerp(hor,1-Math.pow(t,0.55));c.push(k.r,k.g,k.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
 const dome=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));scene.add(dome);
 // Poly Haven HDRI (CC0): real sky as background + image-based lighting
 new RGBELoader().load('world/tex/sky_1k.hdr',t=>{t.mapping=THREE.EquirectangularReflectionMapping;
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(t).texture;scene.environmentIntensity=0.45;});}
scene.add(new THREE.HemisphereLight(0xffd6b0,0x5a4038,0.95));
const sun=new THREE.DirectionalLight(0xffa860,3.4);sun.position.set(-52,24,34);sun.target.position.set(0,0,-2);scene.add(sun,sun.target);
if(SHADOWS){sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=-48;sc.right=48;sc.top=48;sc.bottom=-48;sc.near=10;sc.far=160;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.03;sun.shadow.radius=3;}
// ---------- procedural textures ----------
function canvasTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=4;return t;}
const nr=rng(7);
function noise(x,w,h,a){const d=x.getImageData(0,0,w,h);for(let i=0;i<d.data.length;i+=4){const n=(nr()-.5)*a;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n;}x.putImageData(d,0,0);}
const stoneTex=canvasTex(512,512,(x,w,h)=>{x.fillStyle='#8d8778';x.fillRect(0,0,w,h);
 const rows=8;for(let r=0;r<rows;r++){let cx=(r%2)*32;const ry=r*h/rows;while(cx<w+64){const sw=48+nr()*48;const v=120+nr()*30|0;x.fillStyle=`rgb(${v+8},${v+3},${v-8})`;x.fillRect(cx+2,ry+2,sw-4,h/rows-4);cx+=sw;}}
 noise(x,w,h,26);},[18,24]);
const roofTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#8a3a1c';x.fillRect(0,0,w,h);for(let i=0;i<16;i++){const g=x.createLinearGradient(i*16,0,i*16+16,0);g.addColorStop(0,'#5e2410');g.addColorStop(.5,'#c0602c');g.addColorStop(1,'#5e2410');x.fillStyle=g;x.fillRect(i*16+2,0,12,h);}
 for(let j=0;j<16;j++){x.fillStyle='rgba(40,15,5,.35)';x.fillRect(0,j*16,w,2);}noise(x,w,h,20);},[8,4]);
const latticeTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#5a1410';x.fillRect(0,0,w,h);x.strokeStyle='#a8261c';x.lineWidth=6;
 for(let i=0;i<=8;i++){x.beginPath();x.moveTo(i*32,0);x.lineTo(i*32,h);x.stroke();x.beginPath();x.moveTo(0,i*32);x.lineTo(w,i*32);x.stroke();}
 x.strokeStyle='#d9a441';x.lineWidth=10;x.strokeRect(5,5,w-10,h-10);x.fillStyle='#d9a441';x.fillRect(0,h*.7,w,8);noise(x,w,h,14);},[1,1]);
const beamTex=canvasTex(512,64,(x,w,h)=>{const cols=['#1f5e8c','#2f8a5a','#d9a441','#b8241c'];for(let i=0;i<16;i++){x.fillStyle=cols[i%4];x.fillRect(i*32,0,32,h);}
 x.fillStyle='#d9a441';x.fillRect(0,0,w,6);x.fillRect(0,h-6,w,6);for(let i=0;i<16;i++){x.beginPath();x.arc(i*32+16,h/2,9,0,7);x.fillStyle='#f3e3b0';x.fill();}noise(x,w,h,12);},[6,1]);
const brickTex=canvasTex(256,128,(x,w,h)=>{x.fillStyle='#6b3a2a';x.fillRect(0,0,w,h);for(let r=0;r<8;r++)for(let c=0;c<9;c++){const v=nr()*30|0;x.fillStyle=`rgb(${150+v},${70+v/2},${50})`;x.fillRect(c*32-(r%2)*16+1,r*16+1,30,14);}noise(x,w,h,18);},[10,1]);
// ---------- PBR texture sets (Poly Haven, CC0) ----------
const TL=new THREE.TextureLoader();
function pbr(name,opt={}){const ld=(k,srgb)=>{const t=TL.load(`world/tex/${name}_${k}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const arm=ld('arm');const m=new THREE.MeshStandardMaterial({map:ld('diff',true),normalMap:ld('nor'),aoMap:arm,roughnessMap:arm,aoMapIntensity:1,metalness:0,roughness:opt.rough??1,color:opt.color??0xffffff,side:opt.side??THREE.FrontSide});
 if(opt.nomap)m.map=null;m.normalScale.set(opt.ns??1,opt.ns??1);m.userData.uvScale=opt.uv??1;return m;}
// ---------- materials ----------
const M={stone:pbr('large_grey_tiles',{uv:1/3}),
 plinth:pbr('granite_tile',{uv:1/1.6,color:0xe6e2da}),
 red:pbr('lacquered_cherry_wood',{uv:1/1.5,color:0xa8281c,rough:0.8,nomap:1}),
 lattice:new THREE.MeshLambertMaterial({map:latticeTex}),
 roof:pbr('clay_roof_tiles_02',{uv:1/1.4,color:0xffb090,side:THREE.DoubleSide}),
 roofUnder:new THREE.MeshLambertMaterial({color:0x4f8a74,side:THREE.BackSide}),
 gold:new THREE.MeshStandardMaterial({color:0xd9a441,metalness:.7,roughness:.35,emissive:0x2a1800}),
 bronze:new THREE.MeshStandardMaterial({color:0x6e5434,metalness:.6,roughness:.42}),
 beam:new THREE.MeshLambertMaterial({map:beamTex}),
 brick:pbr('red_brick',{uv:1/1.2,color:0xffd6c8}),
 wood:pbr('lacquered_cherry_wood',{uv:1/1.2,color:0xb08070}),
 lantern:new THREE.MeshStandardMaterial({color:0xd8261a,emissive:0xff4a18,emissiveIntensity:1.5,roughness:.6}),
 green:new THREE.MeshLambertMaterial({color:0x3f6b3a})};
// ---------- collision world (2D, x/z) ----------
const boxes=[];  // [x0,z0,x1,z1]
const circles=[]; // [x,z,r]
const BOUND={x0:-29,x1:29,z0:-40,z1:38};
const solid=(x0,z0,x1,z1)=>boxes.push([Math.min(x0,x1),Math.min(z0,z1),Math.max(x0,x1),Math.max(z0,z1)]);
function blocked(x,z,m){if(x<BOUND.x0+m||x>BOUND.x1-m||z<BOUND.z0+m||z>BOUND.z1-m)return true;
 for(const b of boxes)if(x>b[0]-m&&x<b[2]+m&&z>b[1]-m&&z<b[3]+m)return true;
 for(const c of circles)if((x-c[0])**2+(z-c[1])**2<(c[2]+m)**2)return true;return false;}
// push a circle of radius r out of all obstacles; returns corrected [x,z]
function resolve(x,z,r){for(let it=0;it<4;it++){let moved=false;
  for(const b of boxes){if(x>b[0]-r&&x<b[2]+r&&z>b[1]-r&&z<b[3]+r){const dl=x-(b[0]-r),dr=(b[2]+r)-x,dt=z-(b[1]-r),db=(b[3]+r)-z;const m=Math.min(dl,dr,dt,db);
    if(m===dl)x=b[0]-r;else if(m===dr)x=b[2]+r;else if(m===dt)z=b[1]-r;else z=b[3]+r;moved=true;}}
  for(const c of circles){const dx=x-c[0],dz=z-c[1],d=Math.hypot(dx,dz),rr=c[2]+r;if(d<rr){if(d<1e-4){x+=rr;}else{x=c[0]+dx/d*rr;z=c[1]+dz/d*rr;}moved=true;}}
  x=Math.min(BOUND.x1-r,Math.max(BOUND.x0+r,x));z=Math.min(BOUND.z1-r,Math.max(BOUND.z0+r,z));if(!moved)break;}
 return [x,z];}
// ---------- builders ----------
const g0=new THREE.Group();scene.add(g0);
function box(w,h,d,mat,x,y,z,ry=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.y=ry;g0.add(m);return m;}
// curved hip roof with upturned corners (swallowtail-ish); centred at (x,y,z)
function roof(W,D,H,x,y,z,lift=1.2,over=1.6){const rot=D>W;if(rot){const t=W;W=D;D=t;}const w=W/2+over,d=D/2+over;const geo=new THREE.PlaneGeometry(w*2,d*2,48,24);geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position;const ridge=Math.max(0,w-d);
 for(let i=0;i<p.count;i++){const px=p.getX(i),pz=p.getZ(i);const mz=Math.abs(pz)/d,mx=Math.max(0,Math.abs(px)-ridge)/(w-ridge);const m=Math.min(1,Math.max(mz,mx));
  let yy=H*Math.pow(1-m,1.7);const ax=Math.abs(px)/w,az=mz;yy+=lift*Math.pow(Math.min(1,ax),6)*Math.pow(az,1.2)+lift*0.6*Math.pow(az,6)*Math.pow(ax,1.2);p.setY(i,yy);}
 if(rot)geo.rotateY(Math.PI/2);geo.computeVertexNormals();const top=new THREE.Mesh(geo,M.roof);top.position.set(x,y,z);g0.add(top);
 const under=new THREE.Mesh(geo,M.roofUnder);under.position.set(x,y-0.05,z);g0.add(under);
 // ridge: gold curved bar with upturned swallowtail ends + flaming pearl
 const pts=[];for(let i=0;i<=20;i++){const t=i/20*2-1;pts.push(new THREE.Vector3(t*(ridge+0.8),H+0.35+1.4*Math.pow(Math.abs(t),5),0));}
 const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,0.22,6),M.gold);tube.position.set(x,y,z);if(rot)tube.rotation.y=Math.PI/2;g0.add(tube);
 const ridgeBase=new THREE.Mesh(new THREE.BoxGeometry(ridge*2+1.4,0.5,0.45),M.beam);ridgeBase.position.set(x,y+H+0.1,z);if(rot)ridgeBase.rotation.y=Math.PI/2;g0.add(ridgeBase);
 // two dragons facing a pearl: coiled tubes
 for(const s of[-1,1]){const dp=[];for(let i=0;i<=30;i++){const t=i/30;dp.push(new THREE.Vector3(s*(0.6+t*Math.min(ridge*.7,5)),H+0.6+Math.sin(t*Math.PI*3)*0.45+t*0.4,Math.cos(t*Math.PI*3)*0.25));}
  const dr=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dp),40,0.13,5),M.gold);dr.position.set(x,y,z);if(rot)dr.rotation.y=Math.PI/2;g0.add(dr);}
 const pearl=new THREE.Mesh(new THREE.SphereGeometry(0.35,10,8),M.gold);pearl.position.set(x,y+H+1.0,z);g0.add(pearl);
 return top;}
const colGeo=new THREE.CylinderGeometry(0.32,0.36,1,12);colGeo.translate(0,.5,0);
const baseGeo=new THREE.CylinderGeometry(0.55,0.6,0.5,8);baseGeo.translate(0,.25,0);
const cols=[];const dragonCols=[];
function column(x,z,h,dragon=false,collide=true){cols.push([x,z,h,dragon]);if(dragon)dragonCols.push([x,z,h]);if(collide)circles.push([x,z,0.45]);}
const lanterns=[];const benches=[];const lantern=(x,y,z)=>lanterns.push([x,y,z]);
// hall: platform, columns around, lattice core, painted beams, roof(s)
function hall({x,z,W,D,colH,core,double,dragons,porch=2.2,step=0.35,ry=0,front=1}){
 const plat=box(W+porch*2+1,step,D+porch*2+1,M.plinth,x,step/2,z);
 const cw=core?core[0]:W,cd=core?core[1]:D;
 const coreM=box(cw,colH,cd,M.lattice,x,step+colH/2,z);coreM.material=M.lattice;
 // beam band
 box(W+porch*2+.4,0.7,D+porch*2+.4,M.beam,x,step+colH+0.35,z);
 const ox=W/2+porch,oz=D/2+porch;const nx=Math.round(W/3.2)+1;
 for(let i=0;i<=nx;i++){const cx=x-ox+i*(2*ox/nx);column(cx,z+oz,colH,dragons&&(i===Math.floor(nx/2)||i===Math.ceil(nx/2)||i===Math.floor(nx/2)-1||i===Math.ceil(nx/2)+1));column(cx,z-oz,colH);
  lantern(cx+ox/nx,step+colH-0.4,z+oz);}
 const nz=Math.max(1,Math.round(D/3.2));for(let j=1;j<nz;j++){const cz=z-oz+j*(2*oz/nz);column(x-ox,cz,colH);column(x+ox,cz,colH);}
 solid(x-cw/2,z-cd/2,x+cw/2,z+cd/2);
 const ry0=step+colH+0.7;roof(W+porch*2,D+porch*2,double?2.2:3.2,x,ry0,z,1.3,1.8);
 if(double){box(W*0.75,1.6,D*0.6,M.beam,x,ry0+2.4,z);roof(W*0.75,D*0.6,2.8,x,ry0+3.0,z,1.1,1.4);}
}
// ---------- the site (north = -z; entrance on south, +z) ----------
// ground
{const gg=new THREE.PlaneGeometry(BOUND.x1-BOUND.x0+60,BOUND.z1-BOUND.z0+60);gg.rotateX(-Math.PI/2);const g=new THREE.Mesh(gg,M.stone);g.position.set(0,0,(BOUND.z0+BOUND.z1)/2);g0.add(g);}
// outer red brick walls with tiled caps (around everything except south plaza edge which gets a low wall + gate gap)
function wall(x0,z0,x1,z1,h=4.2){const w=Math.abs(x1-x0)||0.8,d=Math.abs(z1-z0)||0.8;box(w,h,d,M.brick,(x0+x1)/2,h/2,(z0+z1)/2);box(w+0.6,0.4,d+0.6,M.roof,(x0+x1)/2,h+0.2,(z0+z1)/2);}
wall(BOUND.x0-0.4,BOUND.z0,BOUND.x0-0.4,BOUND.z1);wall(BOUND.x1+0.4,BOUND.z0,BOUND.x1+0.4,BOUND.z1);wall(BOUND.x0,BOUND.z0-0.4,BOUND.x1,BOUND.z0-0.4);
wall(BOUND.x0,BOUND.z1+0.4,-5,BOUND.z1+0.4,2.2);wall(5,BOUND.z1+0.4,BOUND.x1,BOUND.z1+0.4,2.2);
// Front Hall (San-chuan) at z=20 — passable through three doorways
{const z=20,colH=4.6,step=0.35;box(54,step,10,M.plinth,0,step/2,z);
 const segs=[[-26,-15],[-11,-3],[3,11],[15,26]];for(const[a,b]of segs){box(b-a,colH,1,M.lattice,(a+b)/2,step+colH/2,z);solid(a,z-0.5,b,z+0.5);}
 for(const[a,b]of[[-15,-11],[-3,3],[11,15]]){box(b-a,1.2,1,M.beam,(a+b)/2,step+colH-0.6,z);}
 box(54,0.8,10,M.beam,0,step+colH+0.4,z);
 for(let i=-6;i<=5;i++){const cx=(i+0.5)*4.2;const d=i===0||i===-1||i===1||i===-2;column(cx,z+4.2,colH,d);column(cx,z-4.2,colH);lantern(cx+2.1,step+colH-0.3,z+4.2);lantern(cx+2.1,step+colH-0.3,z-4.2);}
 // three-part stepped roof: central higher
 roof(16,10,2.6,0,step+colH+0.8,z,1.4,1.6);roof(15,9,2.2,-17,step+colH+0.3,z,1.2,1.4);roof(15,9,2.2,17,step+colH+0.3,z,1.2,1.4);
 {const pt=canvasTex(512,128,(x,w,h)=>{x.fillStyle='#1d3f6e';x.fillRect(0,0,w,h);x.strokeStyle='#d9a441';x.lineWidth=12;x.strokeRect(6,6,w-12,h-12);x.fillStyle='#e9c46a';x.font='bold 84px serif';x.textAlign='center';x.textBaseline='middle';x.fillText('龍山寺',w/2,h/2+4);});box(4,1,0.3,new THREE.MeshBasicMaterial({map:pt}),0,step+colH+0.4,z+5.05);}
}
// Main Hall (centre, double eaves, dragon columns)
hall({x:0,z:-14,W:16,D:12,colH:5,core:[14,11],double:true,dragons:true,porch:2.4,step:0.6});
// Rear Hall
hall({x:0,z:-33,W:40,D:5,colH:4.4,core:[40,5],porch:1.6,step:0.35});
// East/west corridor wings (covered walkways) — walls at the outside, open colonnade inside
for(const s of[-1,1]){const xo=s*26.5,xi=s*22;box(1,4,58,M.lattice,xo,2,-8);solid(xo-0.5,-37,xo+0.5,21);
 for(let z=-34;z<=16;z+=4.2){column(xi,z,4);lantern(xi,3.6,z+2.1);}
 box(5,0.6,56,M.beam,(xo+xi)/2,4.3,-8);
 const rg=roof(3.4,54,1.4,(xo+xi)/2,4.6,-8,0.6,1.2);
 // benches along the inner wall
 for(let z=-30;z<=12;z+=7){box(0.5,0.45,2.2,M.wood,xo-s*1.1,0.225,z);benches.push([xo-s*1.1,z,s]);}
}
// Bronze incense burner (Tian-gong lu) in the front courtyard
const BURNER=[0,4];
{const [bx,bz]=BURNER;box(4.2,0.5,4.2,M.plinth,bx,0.25,bz);
 const prof=[[0,0],[1.1,0],[1.3,.2],[1.5,.7],[1.55,1.2],[1.3,1.35],[1.0,1.4],[1.0,1.5],[1.7,1.55],[1.2,1.75],[0.9,2.2],[0.7,2.4],[0.5,2.9],[0.25,3.3],[0,3.6]].map(p=>new THREE.Vector2(p[0],p[1]));
 const lb=new THREE.Mesh(new THREE.LatheGeometry(prof,20),M.bronze);lb.position.set(bx,0.5,bz);g0.add(lb);
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const leg=box(0.25,0.7,0.25,M.bronze,bx+Math.cos(a)*1.15,0.6,bz+Math.sin(a)*1.15);}
 const top=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,8),M.gold);top.position.set(bx,4.2,bz);g0.add(top);
 roof(1.6,1.6,0.7,bx,2.95,bz,0.35,0.3);
 circles.push([bx,bz,2.3]);}
// small incense urns in front of the main hall
const URNS=[[-5,-4.6],[5,-4.6]];
for(const [ux,uz] of URNS){const u=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.5,0.9,14),M.bronze);u.position.set(ux,0.45,uz);g0.add(u);circles.push([ux,uz,0.9]);}
// offering tables in front of main hall
const offerBox=box(6,0.9,1.2,M.red,0,0.45,-2.9);solid(-3,-3.5,3,-2.3);
for(let i=0;i<10;i++){const f=new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),new THREE.MeshLambertMaterial({color:pick([0xe8a020,0xc23a1c,0x7aa03a,0xf0d040])}));f.position.set(-2.6+i*0.58,1.0,-2.9);g0.add(f);}
// front plaza: small trees and a pool by the gate (like the waterfall pond)
{const pool=box(9,0.6,5,M.plinth,-18,0.3,30);const w=box(8.4,0.05,4.4,new THREE.MeshStandardMaterial({color:0x2c5a66,roughness:.1,metalness:.3}),-18,0.62,30);solid(-22.5,27.5,-13.5,32.5);
 for(const [tx,tz] of [[18,28],[22,33],[12,34],[-26,24],[24,24]]){box(0.3,2.4,0.3,M.wood,tx,1.2,tz);const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,1),M.green);c.position.set(tx,3.4,tz);g0.add(c);circles.push([tx,tz,0.5]);}}
// skyline beyond walls
for(let i=0;i<26;i++){const a=i/26*Math.PI*2;const r=70+R()*30;const h=12+R()*30;const b=box(10+R()*10,h,10+R()*10,new THREE.MeshLambertMaterial({color:0x9a958c}),Math.cos(a)*r,h/2,Math.sin(a)*r-5);}
// columns (instanced) + dragon coils
{const n=cols.length;const cm=new THREE.InstancedMesh(colGeo,M.red,n),bm=new THREE.InstancedMesh(baseGeo,M.plinth,n);const o=new THREE.Object3D();
 cols.forEach(([x,z,h,d],i)=>{o.position.set(x,0.3,z);o.scale.set(1,h,1);o.updateMatrix();cm.setMatrixAt(i,o.matrix);o.scale.set(1,1,1);o.updateMatrix();bm.setMatrixAt(i,o.matrix);
  cm.setColorAt(i,new THREE.Color(d?0x5a4434:0xffffff));});
 g0.add(cm,bm);
 const pts=[];for(let i=0;i<=80;i++){const t=i/80;pts.push(new THREE.Vector3(Math.cos(t*Math.PI*6)*0.42,t,Math.sin(t*Math.PI*6)*0.42));}
 const coil=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),160,0.12,6);
 const dm=new THREE.InstancedMesh(coil,M.bronze,dragonCols.length);dragonCols.forEach(([x,z,h],i)=>{o.position.set(x,0.8,z);o.scale.set(1,h-1.2,1);o.updateMatrix();dm.setMatrixAt(i,o.matrix);});g0.add(dm);}
// lanterns (instanced): red body + gold caps + tassel
{const n=lanterns.length;const bodyG=new THREE.SphereGeometry(0.34,12,10);bodyG.scale(1,1.15,1);const lm=new THREE.InstancedMesh(bodyG,M.lantern,n);
 const capG=new THREE.CylinderGeometry(0.16,0.16,0.9,8);const km=new THREE.InstancedMesh(capG,M.gold,n);const o=new THREE.Object3D();
 lanterns.forEach(([x,y,z],i)=>{o.position.set(x,y-0.3,z);o.updateMatrix();lm.setMatrixAt(i,o.matrix);o.position.set(x,y-0.3,z);o.scale.set(1,1,1);o.updateMatrix();km.setMatrixAt(i,o.matrix);});g0.add(lm,km);
 // strings of lanterns across the courtyard
 const sn=60;const sm=new THREE.InstancedMesh(bodyG,M.lantern,sn);for(let i=0;i<sn;i++){const row=Math.floor(i/20),t=(i%20)/19;const x=-20+t*40,z=12-row*6;const y=5.4-Math.sin(t*Math.PI)*1.0;o.position.set(x,y,z);o.scale.setScalar(0.7);o.updateMatrix();sm.setMatrixAt(i,o.matrix);}g0.add(sm);
 const wm=new THREE.LineBasicMaterial({color:0x2a1a10});for(let row=0;row<3;row++){const pts=[];for(let k=0;k<=20;k++){const t=k/20;pts.push(new THREE.Vector3(-21+t*42,5.4-Math.sin(t*Math.PI)*1.0+0.28,12-row*6));}g0.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),wm));}}
// ---------- world-space box-projected UVs for PBR materials, shadow flags ----------
{const done=new Set();g0.traverse(m=>{if(!m.isMesh)return;m.receiveShadow=m.material!==M.roof&&m.material!==M.roofUnder;m.castShadow=!m.isInstancedMesh||true;
  const mat=m.material;if(!mat||!mat.userData||!mat.userData.uvScale||done.has(m.geometry))return;done.add(m.geometry);
  const g=m.geometry,p=g.attributes.position,n=g.attributes.normal,k=mat.userData.uvScale;if(!n)return;const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));let u,v;
   if(ay>=ax&&ay>=az){u=p.getX(i);v=p.getZ(i);}else if(ax>=az){u=p.getZ(i);v=p.getY(i);}else{u=p.getX(i);v=p.getY(i);}uv[i*2]=u*k;uv[i*2+1]=v*k;}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));});
 if(SHADOWS){renderer.shadowMap.needsUpdate=true;setTimeout(()=>renderer.shadowMap.needsUpdate=true,4000);}}
// ---------- s1a: warm glow + real carved props (Poly Haven, CC0) ----------
{const gl=new THREE.PointLight(0xff8a3a,14,14,1.6);gl.position.set(BURNER[0],2.2,BURNER[1]);scene.add(gl);
 const hl=new THREE.PointLight(0xffa050,18,22,1.4);hl.position.set(0,4,-10.5);scene.add(hl);
 const pl=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 pl.load('world/ph/chinese_console_table.glb?v='+BUILD,g=>{const b=new THREE.Box3().setFromObject(g.scene),sz=b.getSize(new THREE.Vector3());const k=0.95/sz.y;g.scene.updateMatrixWorld(true);
  const n=Math.max(1,Math.round(6/(sz.x*k)));offerBox.visible=false;
  for(let i=0;i<n;i++){const t=g.scene.clone();t.scale.setScalar(k);const w=sz.x*k;t.position.set(-((n-1)*w)/2+i*w-(b.min.x+sz.x/2)*k,-b.min.y*k,-2.9-(b.min.z+sz.z/2)*k);t.traverse(m=>{if(m.isMesh){m.castShadow=m.receiveShadow=true;}});scene.add(t);}
  if(SHADOWS)renderer.shadowMap.needsUpdate=true;});
 pl.load('world/ph/chinese_chandelier.glb?v='+BUILD,g=>{const b=new THREE.Box3().setFromObject(g.scene),sz=b.getSize(new THREE.Vector3());const k=1.1/Math.max(sz.x,sz.z);
  g.scene.traverse(m=>{if(m.isMesh){m.material.emissive=new THREE.Color(0xffa040);m.material.emissiveIntensity=0.6;if(m.material.map)m.material.emissiveMap=m.material.map;}});
  for(const x of[-8.4,-4.2,0,4.2,8.4]){const t=g.scene.clone();t.scale.setScalar(k);t.position.set(x,5.2-b.max.y*k,-10.3);scene.add(t);}});}
// ---------- smoke particles ----------
const SMOKE_N=260;const smoke={pos:new Float32Array(SMOKE_N*3),life:new Float32Array(SMOKE_N),src:new Uint8Array(SMOKE_N)};
const smokeSrc=[[BURNER[0],3.7,BURNER[1]],[URNS[0][0],1.0,URNS[0][1]],[URNS[1][0],1.0,URNS[1][1]]];
{const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(smoke.pos,3));sg.setAttribute('alpha',new THREE.BufferAttribute(new Float32Array(SMOKE_N),1));
 const spr=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:spr},scale:{value:innerHeight*renderer.getPixelRatio()}},
  vertexShader:'attribute float alpha;varying float va;uniform float scale;void main(){va=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=(1.2+ (1.-alpha)*2.5)*scale/(-mv.z)*0.6;gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform sampler2D map;varying float va;void main(){vec4 c=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vec3(.82,.76,.7),c.a*va*.3);}'});
 smoke.points=new THREE.Points(sg,mat);smoke.points.frustumCulled=false;scene.add(smoke.points);
 for(let i=0;i<SMOKE_N;i++){smoke.life[i]=R();smoke.src[i]=i%5===0?1+(i%2):0;}}
function stepSmoke(dt,t){const a=smoke.points.geometry.attributes.alpha.array;for(let i=0;i<SMOKE_N;i++){let l=smoke.life[i]+dt/(smoke.src[i]?5:8);if(l>=1){l-=1;}smoke.life[i]=l;const s=smokeSrc[smoke.src[i]];
  const ph=i*12.9898;const sway=Math.sin(t*0.6+ph)*l*1.4;smoke.pos[i*3]=s[0]+Math.sin(ph)*0.5*(0.3+l)+sway;smoke.pos[i*3+1]=s[1]+l*(smoke.src[i]?3:6);smoke.pos[i*3+2]=s[2]+Math.cos(ph)*0.5*(0.3+l)+l*1.2;
  a[i]=Math.sin(Math.min(1,l*4)*Math.PI/2)*(1-l);}
 smoke.points.geometry.attributes.position.needsUpdate=true;smoke.points.geometry.attributes.alpha.needsUpdate=true;}
// ---------- navigation graph for people ----------
const nodes=[];for(let x=BOUND.x0+2;x<=BOUND.x1-2;x+=3)for(let z=BOUND.z0+2;z<=BOUND.z1-2;z+=3)if(!blocked(x,z,0.9))nodes.push([x,z]);
function clearSeg(a,b,m=0.6){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.ceil(d/0.4);for(let i=1;i<n;i++){const t=i/n;if(blocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,m))return false;}return true;}
const adj=nodes.map(()=>[]);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const d=Math.hypot(nodes[i][0]-nodes[j][0],nodes[i][1]-nodes[j][1]);if(d<4.5&&clearSeg(nodes[i],nodes[j])){adj[i].push([j,d]);adj[j].push([i,d]);}}
function nearestNode(p){let bi=0,bd=1e9;for(let i=0;i<nodes.length;i++){const d=(nodes[i][0]-p[0])**2+(nodes[i][1]-p[1])**2;if(d<bd&&(d<20||true)){if(d<bd){bd=d;bi=i;}}}return bi;}
function path(a,b){if(clearSeg(a,b))return[b];const s=nearestNode(a),t=nearestNode(b);const dist=new Float32Array(nodes.length).fill(1e9),prev=new Int32Array(nodes.length).fill(-1),done=new Uint8Array(nodes.length);dist[s]=0;
 for(;;){let u=-1,bd=1e9;for(let i=0;i<nodes.length;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}if(u<0||u===t)break;done[u]=1;for(const[v,w]of adj[u])if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;}}
 const out=[];let c=t;while(c>=0){out.unshift(nodes[c]);c=prev[c];}out.push(b);
 // string-pull smoothing
 const sm=[];let cur=a;let i=0;while(i<out.length){let j=out.length-1;while(j>i&&!clearSeg(cur,out[j]))j--;sm.push(out[j]);cur=out[j];i=j+1;}return sm;}
// ---------- activity slots ----------
const slots=[];const S=(kind,x,z,face,clip,extra={})=>slots.push({kind,x,z,face,clip,busy:null,...extra});
for(let k=0;k<10;k++){const a=k/10*Math.PI*2;const x=BURNER[0]+Math.cos(a)*2.9,z=BURNER[1]+Math.sin(a)*2.9;S('incense',x,z,Math.atan2(BURNER[0]-x,BURNER[1]-z),'Idle_Torch_Loop',{prop:'incense',then:'Interact'});}
for(let k=0;k<7;k++){S('kneel',-4.5+k*1.5,-1.4,Math.PI,'Fixing_Kneeling');}
for(let k=0;k<5;k++){S('bow',-6+k*3,0.6,Math.PI,'Interact',{prop:'incense'});}
for(const[x,z,f] of [[-8,10,Math.PI],[9,12,Math.PI],[-12,-2,Math.PI*0.9],[12,-1,-Math.PI*0.85],[0,30,Math.PI],[-6,33,Math.PI],[8,31,Math.PI*1.05],[-15,6,Math.PI*0.8],[15,8,-Math.PI*0.8],[3,14,0]])S('photo',x,z,f,'Spell_Simple_Idle_Loop',{prop:'phone'});
for(const[cx,cz]of [[-10,4],[11,3],[-4,12],[14,-8],[-15,-12],[5,27],[-8,26],[16,14],[0,-25],[-12,-24]]){for(let k=0;k<3;k++){const a=k/3*Math.PI*2+0.4;const x=cx+Math.cos(a)*0.8,z=cz+Math.sin(a)*0.8;S('chat',x,z,Math.atan2(cx-x,cz-z),pick(['Idle_Talking_Loop','Idle_Listen','Idle_Talking_Loop','Idle_Look']),{group:cx+','+cz});}}
// ---------- people ----------
const people=[];const mixers=[];let clipsByName={};
const SHIRTS=[0xd8d2c4,0x2b3a55,0x8a2b2b,0x3d5a3a,0xe3c76a,0x5a4a3a,0xf0ece2,0x6b5b8a,0x1f1f22,0xc77a52,0x7fa0b8,0xb89f80];
const SKIN=[0xe9c5a2,0xd9a982,0xc08a60,0xf1d3b6,0xa8754c];
function makeProp(kind){const g=new THREE.Group();if(kind==='incense'){for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.32,4),new THREE.MeshBasicMaterial({color:0xb5421c}));s.position.set((i-1)*0.02,0.16,0);g.add(s);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.012,5,4),new THREE.MeshBasicMaterial({color:0xff6a20}));tip.position.set((i-1)*0.02,0.32,0);g.add(tip);}}
 else{const p=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.15,0.01),new THREE.MeshBasicMaterial({color:0x111111}));g.add(p);}return g;}
function play(p,name,fade=0.35){const a=p.actions[name]||p.actions.Idle_Loop;if(p.cur===a){p.clip=name;return;}a.reset().setEffectiveWeight(1).fadeIn(fade).play();a.time=R()*a.getClip().duration;if(p.cur)p.cur.fadeOut(fade);p.cur=a;p.clip=name;}
function setProp(p,kind){for(const k in p.props)p.props[k].visible=(k===kind);}
const hidePropsFar=(p,far)=>{if(far&&p.props.incense)p.props.incense.visible=false;};
function freeSlot(kinds){const c=slots.filter(s=>!s.busy&&kinds.includes(s.kind));return c.length?pick(c,R):null;}
function chooseNext(p){if(p.slot){p.slot.busy=null;p.slot=null;}setProp(p,null);
 const roll=R();let target,slot=null;
 if(roll<0.22)slot=freeSlot(['incense']);else if(roll<0.34)slot=freeSlot(['kneel','bow']);else if(roll<0.48)slot=freeSlot(['photo']);else if(roll<0.7)slot=freeSlot(['chat']);else if(roll<0.8)slot=freeSlot(['sit']);
 if(slot){slot.busy=p;p.slot=slot;target=[slot.x,slot.z];}
 else{for(let k=0;k<20;k++){const n=pick(nodes);target=n;break;}}
 p.route=path([p.x,p.z],target);p.state='walk';p.speed=1.0+R()*0.45;play(p,R()<0.3?'Walk_Formal_Loop':'Walk_Loop');}
function arrive(p,t){const s=p.slot;p.state='do';
 if(s){p.faceTo=s.face;p.doUntil=t+(s.kind==='chat'?20+R()*40:s.kind==='sit'?25+R()*50:s.kind==='kneel'?12+R()*15:10+R()*18);
  if(s.kind==='sit'){p.x=s.x;p.z=s.z;}play(p,s.clip);setProp(p,s.prop||null);p.thenClip=s.then;p.thenAt=t+5+R()*4;}
 else{p.faceTo=p.yaw+(R()-.5)*2;p.doUntil=t+3+R()*8;play(p,'Idle_Loop');}}
function updatePerson(p,dt,t){
 if(p.state==='walk'){const w=p.route[0];if(!w){arrive(p,t);return;}const dx=w[0]-p.x,dz=w[1]-p.z,d=Math.hypot(dx,dz);
  if(d<0.15){p.route.shift();if(!p.route.length)arrive(p,t);return;}
  const st=Math.min(d,p.speed*dt);p.x+=dx/d*st;p.z+=dz/d*st;const ty=Math.atan2(dx,dz);p.yaw+=angDiff(ty,p.yaw)*Math.min(1,dt*6);}
 else{p.yaw+=angDiff(p.faceTo,p.yaw)*Math.min(1,dt*4);if(p.thenClip&&t>p.thenAt){play(p,p.thenClip);p.thenClip=null;}if(t>p.doUntil)chooseNext(p);}
 p.obj.position.set(p.x,p.slot&&p.slot.kind==='sit'&&p.state==='do'?0.0:0,p.z);p.obj.rotation.y=p.yaw;}
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
// ---------- player ----------
const P={x:0,z:15.5,yaw:0,pitch:-0.02,vx:0,vz:0,r:0.35,eye:1.62};
if(Q.get('arrive')){P.x=0;P.z=35;P.yaw=0;}
if(Q.get('x'))P.x=+Q.get('x');if(Q.get('z'))P.z=+Q.get('z');
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
let tipHidden=false;function hideTip(){if(!tipHidden){tipHidden=true;document.getElementById('tip').style.opacity=0;}}
let stuckFrames=0,maxStuck=0;
function updatePlayer(dt){let f=-joy.y,s=joy.x;if(keys.KeyW||keys.ArrowUp)f=1;if(keys.KeyS||keys.ArrowDown)f=-1;if(keys.KeyA)s=-1;if(keys.KeyD)s=1;if(keys.ArrowLeft)P.yaw-=dt*1.8;if(keys.ArrowRight)P.yaw+=dt*1.8;
 const m=Math.hypot(f,s);if(m>1){f/=m;s/=m;}const sp=2.4;
 const fx=Math.sin(P.yaw),fz=-Math.cos(P.yaw);const rx=Math.cos(P.yaw),rz=Math.sin(P.yaw);
 const tvx=(fx*f+rx*s)*sp,tvz=(fz*f+rz*s)*sp;const k=Math.min(1,dt*10);P.vx+=(tvx-P.vx)*k;P.vz+=(tvz-P.vz)*k;
 const ox=P.x,oz=P.z;let [nx,nz]=resolve(P.x+P.vx*dt,P.z+P.vz*dt,P.r);
 // anti-stuck: if wanting to move but nothing changes for long, nudge toward nearest free nav node
 const want=m>0.2,moved=Math.hypot(nx-ox,nz-oz);if(want&&moved<0.002)stuckFrames++;else stuckFrames=0;maxStuck=Math.max(maxStuck,stuckFrames);
 if(stuckFrames>90){const n=nodes[nearestNode([nx,nz])];nx+=(n[0]-nx)*0.1;nz+=(n[1]-nz)*0.1;}
 if(blocked(nx,nz,P.r*0.5)){const n=nodes[nearestNode([nx,nz])];nx=n[0];nz=n[1];}
 P.x=nx;P.z=nz;document.body.classList.toggle('walking',m>0.2);if(m>0.2)hideTip();
 const bob=Math.sin(performance.now()/1000*8)*0.025*Math.min(1,Math.hypot(P.vx,P.vz)/sp);
 camera.position.set(P.x,P.eye+bob+(Math.abs(P.x)<11.5&&P.z<-3&&P.z>-25?0.6:0),P.z);camera.rotation.set(P.pitch,-P.yaw,0,'YXZ');}
// ---------- load people & loop ----------
let ready=false,frames=0,fpsAvg=0,simT=0;const fpsHist=[];
// Microsoft Rocketbox avatars (MIT): realistic textured humans + motion-captured clips, shared Biped skeleton.
const AV=['Male_Adult_02','Female_Adult_01','Male_Adult_05','Female_Adult_04','Male_Adult_08','Female_Adult_02','Male_Child_01','Female_Adult_05','Male_Adult_03',
 'Female_Adult_07','Male_Adult_11','Female_Adult_11','Male_Adult_09','Female_Child_01','Male_Adult_14','Female_Adult_13'];
// logical activity name -> Rocketbox clip (per gender)
const CLIPMAP={Walk_Loop:{m:'m_walk_neutral_01',f:'f_walk_neutral_01'},Walk_Formal_Loop:{m:'m_walk_slow_01',f:'f_walk_stroll_01'},
 Idle_Loop:{m:'m_idle_neutral_01',f:'f_idle_neutral_01'},Idle_Look:{m:'m_idle_look_around_01',f:'f_idle_look_around_01'},
 Idle_Talking_Loop:{m:'m_gestic_talk_neutral_01',f:'f_gestic_talk_neutral_01'},Idle_Listen:{m:'m_gestic_listen_neutral_01',f:'f_gestic_listen_neutral_01'},
 Sitting_Idle_Loop:{m:'m_sit_chair_idle_neutral_01',f:'f_sit_chair_idle_neutral_01'},Sitting_Talking_Loop:{m:'m_sit_chair_idle_neutral_01',f:'f_sit_chair_idle_neutral_01'},
 Fixing_Kneeling:{m:'m_crouch_idle',f:'f_crouch_idle'},Interact:{m:'m_idle_neutral_01',f:'f_idle_neutral_01'},Idle_Torch_Loop:{m:'m_idle_neutral_01',f:'f_idle_neutral_01'},
 Spell_Simple_Idle_Loop:{m:'m_take_picture',f:'m_take_picture'},Phone:{m:'m_cell_phone_textmessage',f:'f_cell_phone_textmessage'}};
// ---------- s1a: soft painterly shading for people (ramp + warm rim), avoids the plastic PBR look ----------
const TOON=Q.get('toon')!=='0';
const RAMP=(()=>{const d=new Uint8Array([70,120,175,215,240,255]);const t=new THREE.DataTexture(d,d.length,1,THREE.RedFormat);t.minFilter=t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;})();
const toonCache=new Map();
function toonify(mt){if(toonCache.has(mt))return toonCache.get(mt);
 const m=new THREE.MeshToonMaterial({map:mt.map,color:mt.color.clone().multiplyScalar(1.04),gradientMap:RAMP,alphaTest:mt.alphaTest,transparent:false,side:mt.side});
 m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <lights_fragment_begin>',`
  {float fr=pow(1.0-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.0,1.0),2.6);totalEmissiveRadiance+=vec3(1.0,0.72,0.48)*fr*0.42*diffuseColor.rgb+vec3(0.06,0.035,0.02);}
  #include <lights_fragment_begin>`);};
 toonCache.set(mt,m);return m;}
// procedural overlays where no free mocap exists: bow with incense, hands together (pray), kneel-bow
const POSE={Interact:'bow',Idle_Torch_Loop:'hold',Fixing_Kneeling:'kbow'};
function prepClip(c){for(const t of c.tracks)t.name=t.name.replace(/^Bip01\./,'RBRoot.');c.tracks=c.tracks.filter(t=>{if(t.name.endsWith('.scale'))return false;if(t.name.endsWith('.position'))return /^(RBRoot|Bip01_Pelvis)\.position$/.test(t.name);return true;});
 if(/walk/.test(c.name))for(const t of c.tracks)if(t.name.endsWith('.position')){const v=t.values,n=t.times.length,T=t.times[n-1]-t.times[0]||1;
  for(const k of[0,1,2]){const d=v[(n-1)*3+k]-v[k];for(let i=0;i<n;i++)v[i*3+k]-=d*(t.times[i]-t.times[0])/T;}}
 return c;}
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_v=new THREE.Vector3(),_ax=new THREE.Vector3();
function rotW(b,axis,ang){if(!b)return;b.parent.getWorldQuaternion(_q);_v.copy(axis).applyQuaternion(_q.invert());_q2.setFromAxisAngle(_v.normalize(),ang);b.quaternion.premultiply(_q2);b.updateMatrixWorld(true);}
function applyPose(p,t){const k=POSE[p.clip];if(!k||p.state!=='do')return;const B=p.B;p.obj.updateMatrixWorld(true);
 const lat=_ax.set(Math.cos(p.yaw),0,-Math.sin(p.yaw)).clone(),up=new THREE.Vector3(0,1,0);
 let bow=0;if(k==='bow')bow=0.18+0.32*Math.max(0,Math.sin((t+p.ph)*2.1));else if(k==='kbow')bow=0.25+0.2*Math.max(0,Math.sin((t+p.ph)*1.6));else bow=0.06;
 rotW(B.sp,lat,bow*0.5);rotW(B.sp2,lat,bow*0.5);rotW(B.head,lat,bow*0.4);
 // both hands together in front of the chest
 for(const[s,ua,fa]of[[1,B.ual,B.fal],[-1,B.uar,B.far]]){rotW(ua,lat,-0.55);rotW(ua,up,-s*0.35);rotW(fa,lat,-1.25);rotW(fa,up,-s*0.55);}
 const pr=p.props.incense;if(pr&&pr.visible&&B.hl&&B.hr){B.hl.getWorldPosition(_v);B.hr.getWorldPosition(pr.position);pr.position.add(_v).multiplyScalar(0.5);pr.position.y-=0.03;pr.rotation.set(-bow*0.8*Math.cos(p.yaw)*0,p.yaw,0);pr.rotateX(bow*0.9);}}
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('world/rb/anims.glb?v='+BUILD,ag=>{
 for(const c of ag.animations)clipsByName[c.name]=prepClip(c);
 for(const sb of benches){S('sit',sb[0],sb[1],sb[2]<0?Math.PI/2:-Math.PI/2,pick(['Sitting_Idle_Loop','Sitting_Talking_Loop']));}
 const N=+(Q.get('n')||24);const blob=new THREE.Mesh(new THREE.CircleGeometry(0.38,16).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.22,depthWrite:false}));
 const ld=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);let got=0;const bases={};
 const refY=g=>{const c=clipsByName[g+'_idle_neutral_01'];const t=c&&c.tracks.find(t=>t.name==='RBRoot.position');return t?t.values[1]:0.9;};
 const REFY={m:refY('m'),f:refY('f')};
 function clipFor(nm,f,c,ry){const key=nm+'|'+c.name;if(clipFor[key])return clipFor[key];const k=ry/REFY[f];
  const tr=c.tracks.map(t=>{if(t.name!=='RBRoot.position')return t;const u=t.clone();for(let i=0;i<u.values.length;i++)u.values[i]*=k;return u;});
  return clipFor[key]=new THREE.AnimationClip(c.name+'|'+nm,c.duration,tr);}
 AV.forEach(nm=>ld.load('world/rb2/'+nm+'.glb?v='+BUILD,g=>{bases[nm]=g.scene;g.scene.traverse(n=>{if(n.name==='Bip01'||(n.children.some(k=>/Pelvis$/.test(k.name))&&!n.isBone)){n.name='RBRoot';bases[nm].userData.ry=n.position.y;}});g.scene.traverse(m=>{if(m.isMesh){const mt=m.material;if(mt.transparent||mt.alphaMode==='BLEND'||/opacity/.test(mt.name)){mt.transparent=false;mt.alphaTest=0.5;mt.depthWrite=true;}mt.side=THREE.FrontSide;if(/opacity/.test(mt.name))mt.side=THREE.DoubleSide;mt.envMapIntensity=0.7;if(TOON)m.material=toonify(mt);}});
  if(++got===AV.length)spawn();},undefined,()=>{if(++got===AV.length)spawn();}));
 function spawn(){const names=AV.filter(n=>bases[n]);
 for(let i=0;i<N;i++){const nm=names[i%names.length];const f=/^Female/.test(nm)?'f':'m';const o=SkeletonUtils.clone(bases[nm]);o.scale.setScalar(0.96+R()*0.08);
  o.traverse(m=>{if(m.isMesh){m.frustumCulled=false;m.castShadow=false;}});
  const holder=new THREE.Group();holder.add(o);const sh=blob.clone();sh.position.y=0.02;holder.add(sh);scene.add(holder);
  const mixer=new THREE.AnimationMixer(o);const actions={};for(const n in CLIPMAP){const c=clipsByName[CLIPMAP[n][f]];if(c)actions[n]=mixer.clipAction(clipFor(nm,f,c,bases[nm].userData.ry||REFY[f]));}
  const bn=r=>{let x=null;o.traverse(b=>{if(!x&&b.isBone&&r.test(b.name))x=b;});return x;};
  const B={sp:bn(/Spine1$/),sp2:bn(/Spine2$/),head:bn(/_Head$/),ual:bn(/L_UpperArm$/),uar:bn(/R_UpperArm$/),fal:bn(/L_Forearm$/),far:bn(/R_Forearm$/)};
  const hand=bn(/R_Hand$/);
  const props={};if(hand){o.updateMatrixWorld(true);const ws=new THREE.Vector3();hand.getWorldScale(ws);for(const k of['phone']){const pr=makeProp(k);pr.scale.setScalar(1/ws.x);pr.position.set(0.08/ws.x,0,0);pr.visible=false;hand.add(pr);props[k]=pr;}}
  {const pr=makeProp('incense');pr.visible=false;pr.userData.world=true;scene.add(pr);props.incense=pr;B.hl=bn(/L_Hand$/);B.hr=hand;}
  const n=pick(nodes);const p={obj:holder,mixer,actions,props,B,av:nm,ph:R()*10,x:n[0],z:n[1],yaw:R()*6.28,state:'do',doUntil:R()*4,faceTo:0,cur:null};p.faceTo=p.yaw;play(p,'Idle_Loop',0);people.push(p);}
 ready=true;document.getElementById('load').style.opacity=0;setTimeout(()=>document.getElementById('load').remove(),700);}
},undefined,e=>{document.getElementById('load').textContent='Could not load people: '+e;});
const POST=Q.get('post')!=='0';let composer=null;
if(POST){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bl=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.32,0.5,0.97);bl.resolution.set(innerWidth/2,innerHeight/2);composer.addPass(bl);
 composer.addPass(new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);vec3 x=c.rgb*vec3(1.05,1.0,.9);float l=dot(x,vec3(.2126,.7152,.0722));x=mix(vec3(l),x,1.02);x+=vec3(.012,.006,0.)*(1.-l);vec2 d=vUv-.5;x*=1.-dot(d,d)*.55;gl_FragColor=vec4(x,c.a);}'}));
 composer.addPass(new OutputPass());}
const clock=new THREE.Clock();let lastNow=performance.now();
renderer.setAnimationLoop(()=>{const dt=Math.min(0.1,clock.getDelta());simT+=dt;frames++;
 const now=performance.now();fpsHist.push(Math.max(1e-3,(now-lastNow)/1000));lastNow=now;if(fpsHist.length>60)fpsHist.shift();fpsAvg=fpsHist.length/fpsHist.reduce((a,b)=>a+b,0);
 updatePlayer(dt);stepSmoke(dt,simT);
 for(let i=0;i<people.length;i++){const p=people[i];updatePerson(p,dt,simT);const d=Math.hypot(p.x-P.x,p.z-P.z);
  // LOD: far people animate at a lower rate
  const every=d>30?4:d>16?2:1;p.acc=(p.acc||0)+dt;if((frames+i)%every===0){p.mixer.update(p.acc);p.acc=0;if(d<30)applyPose(p,simT);}}
 if(window.__w&&window.__w.cam){const c=window.__w.cam;camera.position.set(c[0],c[1],c[2]);camera.lookAt(c[3],c[5]??0,c[4]);}
 if(composer)composer.render();else renderer.render(scene,camera);if(snapReq){snapReq=false;takeSnap();}});
window.__w={state:()=>({ready,build:BUILD,x:P.x,z:P.z,yaw:P.yaw,fps:fpsAvg,frames,people:people.length,maxStuck,blocked:blocked(P.x,P.z,0.01),
 all:people.map(p=>[+p.x.toFixed(2),+p.z.toFixed(2),+p.yaw.toFixed(2),p.clip,p.state]),sample:people.slice(0,6).map(p=>({x:+p.x.toFixed(3),z:+p.z.toFixed(3),clip:p.clip,state:p.state})),clips:people.reduce((m,p)=>{m[p.clip]=(m[p.clip]||0)+1;return m;},{}),
 avatars:[...new Set(people.map(p=>p.av))].length,calls:renderer.info.render.calls,tris:renderer.info.render.triangles}),
 force:(i,clip,x,z,yaw)=>{const p=people[i];if(!p)return;if(x!==undefined){p.x=x;p.z=z;p.yaw=p.faceTo=yaw;}if(p.slot){p.slot.busy=null;p.slot=null;}p.state='do';p.route=[];p.doUntil=1e9;p.thenClip=null;play(p,clip,0);setProp(p,clip==='Interact'||clip==='Idle_Torch_Loop'?'incense':clip==='Spell_Simple_Idle_Loop'||clip==='Phone'?'phone':null);},
 dbg:i=>{const p=people[i];let r=null;p.obj.traverse(n=>{if(n.name==="RBRoot")r=n;});return {av:p.av,clip:p.clip,ry:r&&r.position.y,acts:p.mixer._actions.filter(a=>a.isRunning()).map(a=>[a.getClip().name,a.getEffectiveWeight().toFixed(2)])};},
 cam:null,set:(x,z,yaw)=>{P.x=x;P.z=z;if(yaw!==undefined)P.yaw=yaw;P.vx=P.vz=0;}};

// ---------- trip: passport stamp on arrival + camera photo mode (trip album) ----------
const LSg=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
const TRIP=LSg('teTrip');let snapReq=false;
function stampCanvas(){const c=document.createElement('canvas');c.width=c.height=360;const x=c.getContext('2d');x.translate(180,180);x.rotate(-0.18);x.strokeStyle=x.fillStyle='#b3221a';
 x.lineWidth=10;x.beginPath();x.arc(0,0,160,0,7);x.stroke();x.lineWidth=4;x.beginPath();x.arc(0,0,136,0,7);x.stroke();
 x.textAlign='center';x.font='900 66px serif';x.fillText('龍山寺',0,-18);x.font='800 26px system-ui';x.fillText('LONGSHAN TEMPLE',0,26);
 x.font='700 22px system-ui';x.fillText('TAIPEI · TPE',0,62);x.font='700 20px ui-monospace,monospace';x.fillText(new Date().toLocaleDateString([], {year:'numeric',month:'short',day:'numeric'}).toUpperCase(),0,100);
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2;x.fillRect(Math.cos(a)*148-3,Math.sin(a)*148-3,6,6);}return c;}
function showStamp(){const pp=LSg('tePassport')||[];if(!pp.some(s=>s.place==='Longshan Temple'))pp.push({place:'Longshan Temple',city:'Taipei',at:Date.now(),flight:TRIP&&TRIP.flight});localStorage.setItem('tePassport',JSON.stringify(pp));
 const d=document.createElement('div');d.id='stamp';d.style.cssText='position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,12,8,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:opacity .6s';
 const im=new Image();im.src=stampCanvas().toDataURL();im.style.cssText='width:220px;height:220px;transform:scale(2.4) rotate(-12deg);opacity:0;transition:transform .35s cubic-bezier(.3,1.6,.5,1),opacity .2s';
 const t=document.createElement('div');t.style.cssText='margin-top:18px;text-align:center;font:700 20px system-ui;color:#fbf6ee';t.innerHTML=`Welcome to Taipei${TRIP?', '+TRIP.name.replace(/[<>&]/g,''):''}<br><small style="font:600 12px system-ui;letter-spacing:.12em;color:#e8b55a">PASSPORT STAMPED · TAP TO EXPLORE</small>`;
 d.append(im,t);document.body.append(d);setTimeout(()=>{im.style.transform='scale(1) rotate(-12deg)';im.style.opacity=1;try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}},500);
 const close=()=>{d.style.opacity=0;setTimeout(()=>d.remove(),600);};d.onclick=close;setTimeout(close,5000);window.__stamped=true;}
function takeSnap(){const c=renderer.domElement;const w=480,h=Math.round(w*c.height/c.width);const o=document.createElement('canvas');o.width=w;o.height=h;const x=o.getContext('2d');x.drawImage(c,0,0,w,h);
 x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,h-34,w,34);x.fillStyle='#fbf6ee';x.font='600 15px system-ui';x.fillText('Longshan Temple · Taipei · '+new Date().toLocaleDateString(),12,h-12);
 const img=o.toDataURL('image/jpeg',0.72);const al=LSg('teAlbum')||[];al.unshift({img,at:Date.now(),place:'Longshan Temple'});while(al.length>12)al.pop();
 try{localStorage.setItem('teAlbum',JSON.stringify(al));}catch(e){al.pop();try{localStorage.setItem('teAlbum',JSON.stringify(al));}catch(e2){}}
 const f=document.createElement('div');f.style.cssText='position:fixed;inset:0;z-index:19;background:#fff;opacity:.85;transition:opacity .4s;pointer-events:none';document.body.append(f);requestAnimationFrame(()=>requestAnimationFrame(()=>f.style.opacity=0));setTimeout(()=>f.remove(),500);
 const th=document.getElementById('thumb');th.src=img;th.style.display='block';document.getElementById('albumN').textContent=al.length;window.__photos=al.length;}
if(TRIP&&TRIP.bag&&TRIP.bag.includes('camera')){const b=document.createElement('button');b.id='photo';b.setAttribute('aria-label','Take photo');
 b.style.cssText='position:fixed;z-index:7;right:calc(var(--sa-r) + 48px);bottom:calc(var(--sa-b) + 178px);width:58px;height:58px;border-radius:50%;border:3px solid rgba(251,246,238,.9);background:rgba(22,18,14,.42);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-size:24px;color:#fff';b.textContent='📷';
 b.onclick=e=>{e.stopPropagation();snapReq=true;};document.body.append(b);
 const th=document.createElement('a');th.href='trip.html#album';th.style.cssText='position:fixed;z-index:7;right:calc(var(--sa-r) + 116px);bottom:calc(var(--sa-b) + 186px);text-decoration:none;color:#fff;font:700 11px system-ui;text-align:center';
 th.innerHTML='<img id="thumb" style="display:none;width:44px;height:44px;object-fit:cover;border-radius:10px;border:2px solid #fbf6ee"><span id="albumN"></span>';document.body.append(th);}
if(Q.get('arrive')){const wait=()=>ready?showStamp():setTimeout(wait,200);wait();}
if(TRIP){const a=document.createElement('a');a.href='trip.html';a.textContent='My trip';a.className='glass';a.style.cssText='position:fixed;z-index:6;top:calc(var(--sa-t) + 10px);right:calc(var(--sa-r) + 12px);border-radius:999px;padding:8px 14px;color:#fbf6ee;text-decoration:none;font:600 13px system-ui';document.body.append(a);}
