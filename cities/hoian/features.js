// w17: side-street junctions, points of interest and a schematic mini-map, layered on walk.js through window.__walkAPI.
// Bearings are degrees right of the footage frame centre at that moment; elevation is degrees above the horizon.
import { loadCatalog } from './route-catalog.js?v=w9';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const wait = () => new Promise(r => { const t = setInterval(() => { if (window.__walkAPI?.loaded()) { clearInterval(t); r(window.__walkAPI); } }, 200); });
const angd = (a, b) => ((a - b + 540) % 360) - 180;
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

(async () => {
  const [catalog, W] = await Promise.all([loadCatalog(), wait()]);
  const route = catalog.routes.find(r => r.id === (params.get('route') || catalog.defaultRoute));
  const { THREE } = W;
  const R = W.range();
  /* clips = time ranges inside the one stitched stream; the main walk is the first */
  const clips = route.clips?.length ? route.clips : [{ id: 'main', lo: R.lo, hi: R.hi }];
  if (clips[0].hi > R.d) clips[0].hi = R.hi; /* Pages fallback stream is shorter */
  const mode = params.get('junctions'); // off by default; ?junctions=mock or ?junctions=1
  const junctions = mode === 'mock' ? (route.mockJunctions || []) : mode === '1' || route.junctionsEnabled ? (route.junctions || []) : [];
  if (mode === 'mock') for (const c of route.mockClips || []) clips.push(c);
  let clip = clips[0];
  const clipAt = id => clips.find(c => c.id === id);
  const creditEl = $('credit'), baseCredit = creditEl?.innerHTML;
  function enterClip(c) { clip = c; W.setRange(c.lo, c.hi); if (creditEl) creditEl.innerHTML = c.credit ? `${c.generated ? '<b>Generated</b> · ' : ''}${c.credit}` : baseCredit; window.__feat.clip = c.id; }
  window.__feat = { clip: clip.id, junctions: junctions.length, switches: 0 };

  /* times in routes.json / pois.json are on the full R2 timeline (source seconds); the Pages fallback stream starts at walk.json sourceStart */
  const OFF = window.__src === 'r2' && window.__walkJ?.cdn?.duration ? 0 : (window.__walkJ?.sourceStart || 0);
  window.__feat.off = OFF;
  for (const c of clips.slice(1)) { c.lo -= OFF; c.hi -= OFF; if (c.mapAt != null) c.mapAt -= OFF; }
  for (const j of junctions) { j.at -= OFF; j.toTime -= OFF; }
  if (OFF) { clips.splice(1); junctions.length = 0; } /* test branch ranges are not in the short fallback stream */
  /* ---------- 3D labels (junction hints and POI markers) ---------- */
  const mkLabel = (text, kind) => { const c = document.createElement('canvas'), x = c.getContext('2d'), f = 30; x.font = `500 ${f}px system-ui,sans-serif`;
    const w = Math.ceil(x.measureText(text).width) + 44; c.width = w; c.height = 52; x.font = `500 ${f}px system-ui,sans-serif`;
    x.fillStyle = 'rgba(10,10,10,0.42)'; x.beginPath(); x.roundRect(1, 1, w - 2, 50, 25); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = kind === 'poi' ? '#ffd88a' : '#fff'; x.beginPath(); x.arc(24, 26, 6, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.92)'; x.textBaseline = 'middle'; x.fillText(text, 38, 27);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, opacity: 0 }));
    const k = 0.045; s.scale.set(w * k, 52 * k, 1); s.renderOrder = 20; W.scene.add(s); return s; };
  const place = (s, bearing, elev, r = 40) => { const y = -THREE.MathUtils.degToRad(bearing), e = THREE.MathUtils.degToRad(elev); s.position.set(-Math.sin(y) * Math.cos(e) * r, Math.sin(e) * r, -Math.cos(y) * Math.cos(e) * r); };
  const fadeTo = (s, goal, dt) => { s.material.opacity += (goal - s.material.opacity) * Math.min(1, dt * 3); s.visible = s.material.opacity > 0.01; };

  /* ---------- POIs ---------- */
  let pois = [];
  try { const j = await (await fetch('pois.json', { cache: 'no-cache' })).json(); pois = (j.pois || []).filter(p => (p.clip || 'main') && Number.isFinite(p.from) && Number.isFinite(p.to)); } catch (_) {}
  if (params.get('pois') === '0') pois = [];
  for (const p of pois) { p.from -= OFF; p.to -= OFF; }
  pois = pois.filter(p => p.to > 0 && p.from < R.d);
  for (const p of pois) { p.s = mkLabel(p.name, 'poi'); p.s.userData.poi = p; place(p.s, p.bearing, p.elevation ?? 0, 36); }
  const card = $('poicard');
  function openCard(p) { $('poiname').textContent = p.name; $('poidesc').textContent = p.description || ''; $('poinote').textContent = p.approximate ? 'Approximate placeholder: position and label are estimated from the footage.' : ''; const im = $('poiimg'); if (p.photo) { im.src = p.photo; im.hidden = false; } else im.hidden = true; card.hidden = false; window.__feat.card = p.id; }
  $('poiclose').onclick = () => { card.hidden = true; window.__feat.card = null; };
  /* tap (not drag) on the scene picks a marker */
  const ray = new THREE.Raycaster(); let down = null;
  W.canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  W.canvas.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 450; down = null; if (moved > 8 || !quick) return;
    const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(v, W.camera);
    const hit = ray.intersectObjects(pois.filter(p => p.s.visible && p.s.material.opacity > 0.3).map(p => p.s))[0]; if (hit) openCard(hit.object.userData.poi); });
  window.__feat.tapPoi = id => { const p = pois.find(q => q.id === id); if (p) openCard(p); };
  window.__feat.poiScreen = id => { const p = pois.find(q => q.id === id); if (!p) return null; const v = p.s.position.clone().project(W.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, front: v.z < 1, vis: p.s.visible, op: +p.s.material.opacity.toFixed(2) }; };

  /* ---------- junctions ---------- */
  for (const j of junctions) { j.s = mkLabel(j.label || 'Side street', 'junction'); place(j.s, j.bearing, j.elevation ?? -4, 38); }
  /* preload: warm the target's HLS segments by seeking the parked other-direction stream is not possible for a jump, so we prefetch the playlist window */
  let cool = 0, busy = false;
  /* preload: fetch the first segments of the target time range into the HTTP cache (same stream, so this only warms the CDN/browser cache) */
  async function preload(j) { try { const m = window.__walkJ?.cdn; if (!m || window.__src !== 'r2') return; const base = new URL(m.hls, m.base).href, master = await (await fetch(base)).text();
      const lv = master.split(/\n/).find(l => l && !l.startsWith('#')), pl = new URL(lv, base).href, txt = (await (await fetch(pl)).text()).split(/\n/); let t = 0;
      for (let i = 0; i < txt.length; i++) if (txt[i].startsWith('#EXTINF')) { const d = parseFloat(txt[i].slice(8)); if (t + d > j.toTime - 1 && t < j.toTime + 8) fetch(new URL(txt[i + 1], pl).href).catch(() => {}); t += d; }
      window.__feat.preloaded = j.id; } catch (_) {} }
  async function take(j) { busy = true; try { const to = clipAt(j.toClip) || clips[0];
      const keep = (j.targetBearing ?? 0) + angd(W.lookBearing(), j.bearing); /* keep the compass heading: same offset from the street direction */
      enterClip(to); await W.jump(j.toTime, keep); window.__feat.switches++; window.__feat.last = { from: j.id, to: to.id, t: j.toTime, look: +keep.toFixed(1) }; cool = performance.now() + 2500; } catch (e) { console.warn('junction', e); } finally { busy = false; } }

  /* ---------- mini-map (schematic: heading.json is relative to the camera, not the compass) ---------- */
  const mm = $('minimap'), mx = mm.getContext('2d'); let path = null;
  const mmOn = () => localStorage.getItem('hoian.minimap') !== '0' && params.get('minimap') !== '0';
  function buildPath() { const H = W.head(); if (!H) return; const n = H.h.length, pts = []; let x = 0, y = 0, a = 0; const k = 1 / 0.5;
    /* integrate the direction of travel; a slow drift term follows the camera's own rotation, so this is a schematic, not a survey */
    for (let i = 0; i < n; i++) { a = a * 0.995 + H.h[i] * 0.005 * k * 0.5; const d = a + H.h[i] * 0.6; x += Math.sin(d); y -= Math.cos(d); pts.push([x, y]); }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const s = Math.min(100 / (x1 - x0 || 1), 100 / (y1 - y0 || 1)); path = { pts: pts.map(([px, py]) => [10 + (px - x0) * s + (100 - (x1 - x0) * s) / 2, 10 + (py - y0) * s + (100 - (y1 - y0) * s) / 2]), dt: H.dt }; }
  const at = t => path.pts[Math.max(0, Math.min(path.pts.length - 1, Math.round(t / path.dt)))];
  function drawMap() { mm.hidden = !mmOn(); if (mm.hidden) return; if (!path) { buildPath(); if (!path) return; }
    mx.clearRect(0, 0, 120, 120); const m = clips[0]; mx.lineWidth = 2; mx.strokeStyle = 'rgba(255,255,255,0.55)'; mx.beginPath();
    for (let t = m.lo; t <= m.hi; t += 2) { const [px, py] = at(t); t === m.lo ? mx.moveTo(px, py) : mx.lineTo(px, py); } mx.stroke();
    mx.fillStyle = 'rgba(255,216,138,0.85)'; for (const p of pois) { const [px, py] = at((p.from + p.to) / 2); mx.fillRect(px - 1.5, py - 1.5, 3, 3); }
    mx.strokeStyle = 'rgba(140,200,255,0.9)'; for (const j of junctions) { const [px, py] = at(j.at); mx.beginPath(); mx.arc(px, py, 3.5, 0, 7); mx.stroke(); }
    const p = W.pos(), [cx, cy] = at(clip === clips[0] ? p : (clip.mapAt ?? p)); mx.fillStyle = '#ff5a4f'; mx.beginPath(); mx.arc(cx, cy, 4, 0, 7); mx.fill(); mx.strokeStyle = '#fff'; mx.lineWidth = 1.5; mx.stroke(); }
  const tog = $('minimap-toggle'); if (tog) { tog.checked = mmOn(); tog.onchange = () => { localStorage.setItem('hoian.minimap', tog.checked ? '1' : '0'); drawMap(); }; }

  /* ---------- per-frame loop ---------- */
  let last = performance.now(), mapT = 0;
  const loop = () => { requestAnimationFrame(loop); const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; const p = W.pos(), look = W.lookBearing(), clipId = clip.id;
    for (const q of pois) { const on = (q.clip || 'main') === clipId && p >= q.from && p <= q.to; fadeTo(q.s, on ? 0.85 : 0, dt); }
    let hint = null;
    for (const j of junctions) { const here = (j.clip || 'main') === clipId && Math.abs(p - j.at) < (j.window ?? 6); fadeTo(j.s, here ? 0.5 : 0, dt);
      if (!here) continue; const facing = Math.abs(angd(look, j.bearing)) <= (j.cone ?? 35); hint = facing ? ((j.dir ?? 1) < 0 ? 'Walk back to return here' : 'Keep walking to turn here') : null;
      const push = (j.dir ?? 1) * W.intent() > 0.3, close = Math.abs(p - j.at) < (j.trigger ?? 2.5);
      if (facing && push && close && !busy && !W.swapping() && now > cool) take(j);
      if (!j.pre && Math.abs(p - j.at) < 12) { j.pre = true; preload(j); } }
    const h = $('junction-hint'); if (h) { h.textContent = hint || ''; h.classList.toggle('on', !!hint); }
    if ((mapT += dt) > 0.25) { mapT = 0; drawMap(); } };
  loop();
})();
