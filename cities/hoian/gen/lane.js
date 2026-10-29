import * as THREE from 'three';
/* w13 generated branch: a fictional Hội An-style lane built in 3D from AI-generated facade and ground images.
   Joystick up = walk where you look, down = walk back; drag (any finger outside the stick) = look. No auto-walk.
   Walking back out of the lane mouth returns to the recorded walk at the junction. */
const P = new URLSearchParams(location.search), BACK_T = +(P.get('from') || 655), $ = id => document.getElementById(id);
const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(innerWidth, innerHeight);
r.outputColorSpace = THREE.SRGBColorSpace; document.body.prepend(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfd3d6); scene.fog = new THREE.Fog(0xcfd3d6, 18, 70);
const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200); cam.rotation.order = 'YXZ';
addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
const TL = new THREE.TextureLoader(), tex = (f, rx = 1, ry = 1) => { const t = TL.load(f); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = r.capabilities.getMaxAnisotropy(); if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); } return t; };
const F = ['facade1.jpg', 'facade2.jpg', 'facade3.jpg'].map(f => tex(f)), FM = F.map(t => { const m = t.clone(); m.wrapS = THREE.RepeatWrapping; m.repeat.x = -1; m.offset.x = 1; return m; });
const W = 4.4, L = 64, HW = 6.4, HH = 4.8; /* lane width, length; house facade width/height (4:3) */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, L + 8), new THREE.MeshBasicMaterial({ map: tex('ground.jpg', 2, (L + 8) / 3) }));
ground.rotation.x = -Math.PI / 2; ground.position.z = -L / 2 + 2; scene.add(ground);
const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
let k = 0; const seq = [0, 2, 1, 0, 2, 1, 2, 0, 1, 2];
for (const side of [-1, 1]) for (let z = -1, i = 0; z > -L; z -= HW + 0.35, i++) {
  const n = seq[(i + (side > 0 ? 1 : 0)) % seq.length], flip = (i + k++) % 2 === 1, sc = 0.95 + ((i * 7 + side) % 3) * 0.05;
  const m = plane(HW + 0.36, HH * sc, new THREE.MeshBasicMaterial({ map: flip ? FM[n] : F[n] }));
  m.position.set(side * W / 2, HH * sc / 2, z - HW / 2); m.rotation.y = -side * Math.PI / 2; scene.add(m);
  const gap = plane(0.35, HH * 0.9, new THREE.MeshBasicMaterial({ color: 0x8f7a4e })); gap.position.set(side * (W / 2 + 0.02), HH * 0.45, z - HW - 0.17); gap.rotation.y = -side * Math.PI / 2; scene.add(gap);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, HW + 0.4), new THREE.MeshBasicMaterial({ color: 0x5e3a2a })); roof.position.set(side * (W / 2 - 0.3), HH * sc + 0.04, z - HW / 2); roof.rotation.z = side * 0.12; scene.add(roof);
}
const end = plane(HW, HH, new THREE.MeshBasicMaterial({ map: F[1] })); end.position.set(0, HH / 2, -L - 1); scene.add(end);
/* lantern strings across the lane */
const lmat = [0xc8352a, 0xe2b13c, 0xd8662a].map(c => new THREE.MeshBasicMaterial({ color: c })), cord = new THREE.LineBasicMaterial({ color: 0x333333 });
for (let z = -5; z > -L + 2; z -= 7) { const y = 3.7; scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-W / 2, y + 0.3, z), new THREE.Vector3(0, y, z), new THREE.Vector3(W / 2, y + 0.3, z)]), cord));
  for (let j = -1; j <= 1; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), lmat[(j + 1 + Math.abs(z)) % 3 | 0]); s.scale.y = 1.25; s.position.set(j * 1.2, y - 0.25 + Math.abs(j) * 0.1, z); scene.add(s); } }
/* controls */
const st = { x: 0, z: 1.5, yaw: +P.get('yaw') || 0, pitch: 0, v: 0, bob: 0 }; const joy = { y: 0, id: null }, keys = {}, looks = new Map();
const joyEl = $('joy'), knob = $('knob');
joyEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); joy.id = e.pointerId; const b = joyEl.getBoundingClientRect(); joy.ox = b.left + b.width / 2; joy.oy = b.top + b.height / 2; joyEl.setPointerCapture(e.pointerId); move(e); });
const move = e => { if (e.pointerId !== joy.id) return; let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), m = Math.min(1, 45 / (l || 1)); dx *= m; dy *= m; knob.style.transform = `translate(${dx}px,${dy}px)`; joy.y = -dy / 45; };
joyEl.addEventListener('pointermove', move);
const up = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.y = 0; knob.style.transform = ''; }; joyEl.addEventListener('pointerup', up); joyEl.addEventListener('pointercancel', up);
r.domElement.addEventListener('pointerdown', e => { looks.set(e.pointerId, [e.clientX, e.clientY]); r.domElement.setPointerCapture(e.pointerId); unlock(); });
r.domElement.addEventListener('pointermove', e => { const p = looks.get(e.pointerId); if (!p) return; st.yaw += (e.clientX - p[0]) * 0.004; st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + (e.clientY - p[1]) * 0.004)); looks.set(e.pointerId, [e.clientX, e.clientY]); });
for (const ev of ['pointerup', 'pointercancel']) r.domElement.addEventListener(ev, e => looks.delete(e.pointerId));
addEventListener('keydown', e => { keys[e.code] = true; unlock(); }); addEventListener('keyup', e => keys[e.code] = false);
const audio = new Audio('../assets/walk/ambience.m4a'); audio.loop = true; audio.volume = 0; let unlocked = false;
function unlock() { if (unlocked) return; unlocked = true; audio.play().then(() => audio.pause()).catch(() => { unlocked = false; }); }
let last = performance.now(), leaving = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let t = joy.y; if (keys.KeyW || keys.ArrowUp) t = 1; else if (keys.KeyS || keys.ArrowDown) t = -1; if (Math.abs(t) < 0.2) t = 0;
  if (keys.ArrowLeft || keys.KeyA) st.yaw += dt * 1.6; if (keys.ArrowRight || keys.KeyD) st.yaw -= dt * 1.6;
  st.v += (t * 1.4 - st.v) * Math.min(1, dt * 5);
  st.x -= Math.sin(st.yaw) * st.v * dt; st.z -= Math.cos(st.yaw) * st.v * dt;
  st.x = Math.max(-W / 2 + 0.5, Math.min(W / 2 - 0.5, st.x)); st.z = Math.min(2.2, Math.max(-L + 0.2, st.z));
  st.bob += Math.abs(st.v) * dt * 6.5;
  cam.position.set(st.x, 1.6 + Math.sin(st.bob) * 0.025 * Math.min(1, Math.abs(st.v)), st.z); cam.rotation.set(st.pitch, st.yaw, 0);
  const moving = Math.abs(st.v) > 0.15; if (unlocked) { if (moving && audio.paused) audio.play().catch(() => {}); audio.volume = Math.max(0, Math.min(0.6, audio.volume + (moving ? 1 : -1) * dt * 1.5)); if (!moving && audio.volume === 0 && !audio.paused) audio.pause(); }
  const note = $('note'); if (st.z > 1.6) { note.hidden = false; note.textContent = '⬇ Back to the recorded street'; } else if (st.z < -L + 1.5) { note.hidden = false; note.textContent = 'End of this lane'; } else note.hidden = true;
  if (!leaving && st.z >= 2.15 && -Math.cos(st.yaw) * st.v > 0.3) { leaving = true; const u = new URL('../', location.href); u.searchParams.set('t', String(BACK_T)); u.searchParams.set('face', '-1'); for (const q of ['quality']) if (P.get(q)) u.searchParams.set(q, P.get(q)); location.replace(u.href); }
  r.render(scene, cam); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__lane = { st, joy, keys };
