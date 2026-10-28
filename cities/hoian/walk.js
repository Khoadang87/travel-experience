// Flat-video walk: video time = position. Joystick forward/back; freeze on stop; 2nd-finger drag pans a little.
(function(){
const v=document.getElementById('v'),joy=document.getElementById('joy'),knob=document.getElementById('knob'),msg=document.getElementById('msg');
const Q=new URLSearchParams(location.search);
const OVER=1.3, SPEED=1.0; // video drawn 30% larger than the screen -> room to pan; SPEED = playback rate at full stick
let pos=0,dur=0,stick=0,yaw=0,pitch=0,gyro=Q.get('gyro')==='1',gBase=null,walkOverride=null,lastSeek=0;
function layout(){const W=innerWidth,H=innerHeight,ar=16/9;let w=Math.max(W,H*ar)*OVER;let h=w/ar;if(h<H*OVER){h=H*OVER;w=h*ar}v.style.width=w+'px';v.style.height=h+'px';v._mx=(w-W)/2;v._my=(h-H)/2;apply()}
function apply(){const mx=v._mx||0,my=v._my||0;yaw=Math.max(-1,Math.min(1,yaw));pitch=Math.max(-1,Math.min(1,pitch));v.style.transform=`translate(calc(-50% + ${-yaw*mx}px), calc(-50% + ${pitch*my}px))`}
addEventListener('resize',layout);layout();
v.addEventListener('loadedmetadata',()=>{dur=v.duration;msg.remove();v.currentTime=0.05});
v.addEventListener('error',()=>{msg.textContent='Video failed to load. Please reload.'});
// touch: finger on joystick = move; any other finger = look
let joyId=null,lookId=null,lx=0,ly=0;
function joyMove(x,y){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy;const d=Math.hypot(dx,dy),m=45;if(d>m){dx*=m/d;dy*=m/d}knob.style.transform=`translate(${dx}px,${dy}px)`;stick=Math.abs(dy)<8?0:-dy/m}
function joyEnd(){joyId=null;stick=0;knob.style.transform=''}
addEventListener('pointerdown',e=>{if(joy.contains(e.target)&&joyId===null){joyId=e.pointerId;joyMove(e.clientX,e.clientY)}else if(lookId===null){lookId=e.pointerId;lx=e.clientX;ly=e.clientY}});
addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e.clientX,e.clientY);else if(e.pointerId===lookId){yaw-=(e.clientX-lx)/(v._mx||1)*0.9;pitch+=(e.clientY-ly)/(v._my||1)*0.9;lx=e.clientX;ly=e.clientY;apply()}});
function up(e){if(e.pointerId===joyId)joyEnd();if(e.pointerId===lookId)lookId=null}
addEventListener('pointerup',up);addEventListener('pointercancel',up);
// keyboard (desktop)
const keys={};addEventListener('keydown',e=>keys[e.key]=1);addEventListener('keyup',e=>keys[e.key]=0);
// optional gyro
function onOri(e){if(!gyro||e.gamma==null)return;if(!gBase)gBase=[e.gamma,e.beta];yaw=(e.gamma-gBase[0])/25;pitch=-(e.beta-gBase[1])/25;apply()}
function setGyro(on){gyro=!!on;gBase=null;if(on&&window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission)DeviceOrientationEvent.requestPermission().catch(()=>{});}
addEventListener('deviceorientation',onOri);if(gyro)addEventListener('pointerdown',()=>setGyro(true),{once:true});
let last=performance.now();
function tick(now){const dt=Math.min(0.1,(now-last)/1000);last=now;
 let s=walkOverride!==null?walkOverride:stick;if(keys.ArrowUp||keys.w)s=1;if(keys.ArrowDown||keys.s)s=-1;
 if(keys.ArrowLeft||keys.a){yaw-=dt;apply()}if(keys.ArrowRight||keys.d){yaw+=dt;apply()}
 if(dur){if(s>0.05){const r=Math.max(0.25,Math.min(2,s*SPEED*1.5));if(Math.abs(v.playbackRate-r)>0.05)v.playbackRate=r;if(v.paused)v.play().catch(()=>{});pos=v.currentTime}
  else if(s<-0.05){if(!v.paused)v.pause();pos=Math.max(0,pos+s*SPEED*1.5*dt);if(!v.seeking&&now-lastSeek>80){v.currentTime=pos;lastSeek=now}}
  else{if(!v.paused)v.pause();pos=v.currentTime}
  if(v.currentTime>=dur-0.2)v.pause();}
 requestAnimationFrame(tick)}
requestAnimationFrame(tick);
window.HoianWalk={setWalk:x=>{walkOverride=x==null?null:+x},turnAround:()=>{yaw=-yaw;apply()},faceAhead:()=>{yaw=0;pitch=0;apply()},
 state:()=>({t:v.currentTime,duration:dur,moving:!v.paused||walkOverride<0,yaw,pitch,gyro}),setGyro,get gyro(){return gyro}};
})();
