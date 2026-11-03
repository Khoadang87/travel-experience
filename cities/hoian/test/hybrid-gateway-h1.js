// Hybrid test h1: World Labs Marble 1.1 world (from our cleaned 360 frame at t=1111s) + real cut-out people from the same footage.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const BASE = 'https://pub-ea3274d70651434b8581144229d8b102.r2.dev/hoian/hybrid/gateway/';
const META = { metric_scale_factor: 1.7228739, ground_plane_offset: 2.2586439 }; // from the World API response
const EYE = 1.6, RADIUS = 4.0, SPEED = 1.3, BODY = 0.3;
const Q = new URLSearchParams(location.search);
// People: packed side-by-side (left RGB, right alpha) H.264 MP4 so iPhone Safari works too.
const PEOPLE = [ { f: 'h1', at: [ -1.6, -2.2 ] } ]; // only 1 clean cut-out so far (see report)

const $ = id => document.getElementById(id);
const dbg = $('dbg'); if (Q.has('debug')) dbg.style.display = 'block';
const setP = (p, t) => { $('bar').firstElementChild.style.width = (p * 100).toFixed(0) + '%'; if (t) $('ltxt').textContent = t; };

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb3c2);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(new SparkRenderer({ renderer }));
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// Marble raw (OpenCV) -> metric, ground at y=0, Three.js axes (180° about X)
const world = new THREE.Group();
world.scale.setScalar(META.metric_scale_factor);
world.rotation.x = Math.PI;
world.position.y = META.ground_plane_offset;
scene.add(world);

async function fetchBytes(url, onp) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(); const parts = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onp(total ? got / total : 0, got); }
  const out = new Uint8Array(got); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

let collider = null;
const ray = new THREE.Raycaster();
function groundAt(x, z, fromY) {
  if (!collider) return 0;
  ray.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0)); ray.far = 6;
  const h = ray.intersectObject(collider, true); return h.length ? h[0].point.y : null;
}
function blocked(pos, dir, dist) {
  if (!collider) return false;
  for (const hgt of [0.6, 1.2]) {
    ray.set(new THREE.Vector3(pos.x, pos.y - EYE + hgt, pos.z), dir); ray.far = dist + BODY;
    if (ray.intersectObject(collider, true).length) return true;
  }
  return false;
}

// cut-out billboards
const peopleMeshes = [];
function makePerson(p) {
  const v = document.createElement('video');
  Object.assign(v, { src: BASE + 'people/' + p.f + '_packed.mp4', muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto' });
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  const tex = new THREE.VideoTexture(v);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D map; varying vec2 vUv;
      void main(){ vec3 c=texture2D(map,vec2(vUv.x*0.5,vUv.y)).rgb; float a=texture2D(map,vec2(0.5+vUv.x*0.5,vUv.y)).r;
      a=smoothstep(0.15,0.85,a); if(a<0.02) discard; gl_FragColor=vec4(c,a); }`,
  });
  const H = 1.68, W = H * 0.5;
  const g = new THREE.PlaneGeometry(W, H); g.translate(0, H / 2 - H * 0.02, 0);
  const m = new THREE.Mesh(g, mat); m.userData.video = v; m.renderOrder = 10;
  scene.add(m); peopleMeshes.push(m); p.mesh = m; return v;
}

async function load() {
  let sp = 0, cp = 0; const upd = () => setP(sp * 0.8 + cp * 0.2);
  const [spz, glbBytes] = await Promise.all([
    fetchBytes(BASE + 'gateway_500k.spz', (p, g) => { sp = p; upd(); $('ltxt').textContent = `Loading 3D scene… ${(g / 1e6).toFixed(1)} / 7.9 MB`; }),
    fetchBytes(BASE + 'collider.glb', p => { cp = p; upd(); }),
  ]);
  $('ltxt').textContent = 'Preparing scene…';
  const splat = new SplatMesh({ fileBytes: spz });
  world.add(splat); await splat.initialized;
  const gltf = await new GLTFLoader().parseAsync(glbBytes.buffer, '');
  collider = gltf.scene; collider.traverse(o => { if (o.isMesh) { o.material.visible = false; } });
  world.add(collider); world.updateMatrixWorld(true);
  for (const p of PEOPLE) {
    const v = makePerson(p); const y = groundAt(p.at[0], p.at[1], 2.0);
    p.mesh.position.set(p.at[0], y ?? 0, p.at[1]);
  }
  const g0 = groundAt(0, 0, 2.0); camera.position.set(0, (g0 ?? 0) + EYE, 0);
  setP(1, 'Ready');
  window.__ready = { ground0: g0 };
  const start = () => { $('load').style.display = 'none'; peopleMeshes.forEach(m => m.userData.video.play().catch(() => {})); setTimeout(() => $('hint').style.opacity = 0, 4000); };
  if (Q.has('auto')) start(); else { $('go').style.display = 'block'; $('go').onclick = start; }
}
load().catch(e => { $('ltxt').textContent = 'Could not load: ' + e.message; console.error(e); });

// controls
let yaw = Number(Q.get('yaw') || 0) * Math.PI / 180, pitch = 0; const mv = { x: 0, y: 0 }; const keys = {};
const joy = $('joy'), knob = $('knob'); let joyId = null, lookId = null, lx = 0, ly = 0;
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; mv.x = mv.y = 0; knob.style.transform = ''; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
function joyMove(e) { const r = joy.getBoundingClientRect(); let dx = e.clientX - r.left - 60, dy = e.clientY - r.top - 60; const d = Math.hypot(dx, dy), m = 45; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; mv.x = dx / m; mv.y = -dy / m; }
renderer.domElement.addEventListener('pointerdown', e => { if (lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => { if (e.pointerId !== lookId) return; yaw += (e.clientX - lx) * 0.005; pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - ly) * 0.005)); lx = e.clientX; ly = e.clientY; });
const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
renderer.domElement.addEventListener('pointerup', lookEnd); renderer.domElement.addEventListener('pointercancel', lookEnd);
addEventListener('keydown', e => keys[e.code] = true); addEventListener('keyup', e => keys[e.code] = false);

// test hook for headless screenshots
window.__place = (x, z, yawDeg, pitchDeg = 0) => { const g = groundAt(x, z, 2.0); camera.position.set(x, (g ?? 0) + EYE, z); yaw = yawDeg * Math.PI / 180; pitch = pitchDeg * Math.PI / 180; };

const clock = new THREE.Clock(); const tmp = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  let fx = mv.y + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let sx = mv.x + (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (keys.ArrowLeft) yaw -= dt * 1.5; if (keys.ArrowRight) yaw += dt * 1.5;
  camera.rotation.set(-pitch, -yaw, 0);
  if (fx || sx) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const r = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    tmp.copy(f).multiplyScalar(fx).addScaledVector(r, sx); const len = Math.min(tmp.length(), 1); tmp.normalize();
    const step = SPEED * len * dt; const nx = camera.position.x + tmp.x * step, nz = camera.position.z + tmp.z * step;
    const rr = Math.hypot(nx, nz);
    if (!blocked(camera.position, tmp, step)) {
      let px = nx, pz = nz; if (rr > RADIUS) { px *= RADIUS / rr; pz *= RADIUS / rr; }
      const g = groundAt(px, pz, camera.position.y);
      if (g !== null && Math.abs(g - (camera.position.y - EYE)) < 0.45) camera.position.set(px, g + EYE, pz);
      else if (!collider) camera.position.set(px, EYE, pz);
    }
  }
  const rNow = Math.hypot(camera.position.x, camera.position.z), edge = Math.max(0, (rNow - RADIUS * 0.75) / (RADIUS * 0.25));
  $('edge').style.opacity = edge.toFixed(2); $('edgemsg').style.opacity = edge > 0.9 ? 1 : 0;
  for (const m of peopleMeshes) { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); }
  if (Q.has('debug')) dbg.textContent = `x ${camera.position.x.toFixed(2)} z ${camera.position.z.toFixed(2)} y ${camera.position.y.toFixed(2)} r ${rNow.toFixed(2)} yaw ${(yaw * 180 / Math.PI).toFixed(0)}`;
  renderer.render(scene, camera);
});
