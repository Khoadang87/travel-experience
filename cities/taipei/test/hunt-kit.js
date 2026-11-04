// Shared spot hunt + tap-to-learn fact markers + passport stamp (t1j). Same rules as Longshan ls3 (walk-ls1.js keeps its inline copy, unchanged):
// v = measured pitch (rad, + up) of the item, used to anchor the hint ring (t1m). targets are real things in the walk footage (u = image position 0..1 in the walk frame at walk time t). Found when held within 10 deg of the
// middle of the view for 0.4 s (or tapped within 12 deg). All found, or reaching the end of the clip = stamp in the shared passport
// localStorage 'tePassport' = { v: 1, stamps: { id: { name, city, at, why } } }. Markers sit mid-screen, never over the stick; nothing stops the walk.
export function initHunt(A, C) {
  const { $, D2R } = A, W = window.__w;
  const uAt = (q, p) => { if (p <= q[0][0]) return q[0][1]; for (let k = 1; k < q.length; k++) if (p <= q[k][0]) { const [a, x] = q[k - 1], [b, y] = q[k]; return x + (y - x) * (p - a) / (b - a); } return q[q.length - 1][1]; };
  const spotDir = (x, p) => x.fwd ? A.headAt(p) : Math.PI / 2 - (uAt(x.u, p) - 0.5) * 2 * Math.PI;
  const inClip = () => { const c = A.clip(); return c && c.id === C.clip; };
  // facts
  const factEl = document.createElement('section'); factEl.id = 'fact'; factEl.className = 'glass'; factEl.hidden = true; factEl.setAttribute('role', 'dialog'); factEl.setAttribute('aria-live', 'polite'); document.body.appendChild(factEl);
  function showFact(x) { const [sn, su] = C.src[x.src]; factEl.innerHTML = `<button class="x" type="button" aria-label="Close">✕</button><small>${x.label}</small><b>${x.title}</b><p>${x.body}</p><a href="${su}" target="_blank" rel="noopener">Source: ${sn}</a>`; factEl.querySelector('.x').onclick = e => { e.stopPropagation(); factEl.hidden = true; }; factEl.hidden = false; factEl.dataset.id = x.id; factEl.dataset.t = A.pos(); factEl.dataset.end = x.t1; W.fact = x.id; A.act('fact ' + x.id); }
  const spEls = C.spots.map(x => A.mkMarker(x, 'spot', '<i>i</i><span>' + x.label + '</span>', e => { e && e.stopPropagation(); showFact(x); }));
  W.spots = () => C.spots.map((x, i) => ({ id: x.id, shown: !spEls[i].hidden }));
  setInterval(() => { if (!A.ready() || !A.clip()) return; const p = A.pos(), card = A.card();
    C.spots.forEach((x, i) => { const el = spEls[i], on = inClip() && p >= x.t0 && p <= x.t1 && !card; if (!on) { el.hidden = true; return; } const s = A.scr(spotDir(x, p)); el.hidden = !s.on; if (s.on) { el.style.left = Math.max(70, Math.min(innerWidth - 70, s.x)) + 'px'; el.style.top = innerHeight * 0.36 + 'px'; } });
    if (!factEl.hidden && (Math.abs(A.pos() - +factEl.dataset.t) > 25 || A.pos() > +factEl.dataset.end + 4)) factEl.hidden = true; /* card goes once you walk past its spot, so it never sits over the next marker */ }, 80);
  // hunt + passport
  const H = C.hunt, ST = C.stamp, PK = 'tePassport', HK = C.key;
  const pp = () => { try { return JSON.parse(localStorage.getItem(PK)) || { v: 1, stamps: {} }; } catch (e) { return { v: 1, stamps: {} }; } };
  const found = new Set((() => { try { return JSON.parse(localStorage.getItem(HK)) || []; } catch (e) { return []; } })());
  const huntEl = document.createElement('div'); huntEl.id = 'hunt'; huntEl.className = 'glass'; document.body.appendChild(huntEl);
  const passEl = document.createElement('section'); passEl.id = 'passport'; passEl.className = 'sheet'; passEl.hidden = true; passEl.setAttribute('role', 'dialog'); passEl.setAttribute('aria-label', 'Passport'); document.body.appendChild(passEl);
  let open = false;
  function draw() { const st = pp().stamps[ST.id]; huntEl.innerHTML = `<button type="button" id="hunt-t">Find ${found.size}/${H.length}${st ? ' · ' + ST.icon + ' stamped' : ''}</button>` + (open ? '<ul>' + H.map(h => `<li class="${found.has(h.id) ? 'ok' : ''}">${found.has(h.id) ? '✓' : '○'} Find ${h.label}</li>`).join('') + '</ul><button type="button" id="pass-b">Passport</button>' : '');
    $('hunt-t').onclick = e => { e.stopPropagation(); open = !open; draw(); }; if (open) $('pass-b').onclick = e => { e.stopPropagation(); openPass(); }; }
  function openPass() { const S = Object.entries(pp().stamps); passEl.innerHTML = `<button class="x" type="button" aria-label="Close">✕</button><header><div class="eyebrow">Travel passport</div><h2>Your stamps</h2></header><div class="stamps">${S.length ? S.map(([id, x]) => `<div class="stamp" data-stamp="${id}"><b>${x.name}</b><small>${x.city} · ${new Date(x.at).toLocaleDateString()}</small></div>`).join('') : '<p>No stamps yet. Find everything on the hunt list, or walk to the end, to earn this one.</p>'}</div>`; passEl.querySelector('.x').onclick = () => { passEl.hidden = true; }; passEl.hidden = false; A.joyEnd(); }
  function award(why) { const P = pp(); if (P.stamps[ST.id]) return; P.stamps[ST.id] = { name: ST.name, city: ST.city, at: Date.now(), why }; try { localStorage.setItem(PK, JSON.stringify(P)); } catch (e) {} W.stamp = why; A.log('stamp ' + why);
    const t = document.createElement('div'); t.id = 'stamp-toast'; t.innerHTML = `<b>${ST.icon} ${ST.name}</b><small>Stamp added to your passport</small>`; t.onclick = () => { t.remove(); openPass(); }; document.body.appendChild(t); setTimeout(() => t.remove(), 4500); draw(); }
  function markFound(h, how) { if (found.has(h.id)) return; found.add(h.id); try { localStorage.setItem(HK, JSON.stringify([...found])); } catch (e) {} W.hunt = { last: h.id, how, n: found.size }; A.log('found ' + h.id + ' ' + how);
    huntEl.classList.remove('pop'); void huntEl.offsetWidth; huntEl.classList.add('pop'); $('status').textContent = '✓ Found ' + h.label + ' (' + found.size + '/' + H.length + ')'; setTimeout(() => { if (/Found /.test($('status').textContent)) $('status').textContent = ''; }, 2500); draw(); if (found.size === H.length) award('hunt'); }
  const live = p => inClip() ? H.filter(h => !found.has(h.id) && p >= h.t0 && p <= h.t1) : [];
  let aim = null;
  setInterval(() => { if (!A.ready() || !A.clip()) return; const p = A.pos(), cy = A.camYaw(), pitch = A.pitch(); let hit = null;
    for (const h of live(p)) if (Math.abs(A.wrap(cy - spotDir(h, p))) < 10 * D2R && pitch < (h.pmax ?? 0.45) && pitch > (h.pmin ?? -0.45)) hit = h;
    if (hit) { if (!aim || aim.h !== hit) aim = { h: hit, s: performance.now() }; else if (performance.now() - aim.s > 400) { markFound(hit, 'look'); aim = null; } } else aim = null;
    if (C.endAt != null ? p >= C.endAt : (inClip() && p >= A.clip().hi - 20)) award('visit'); }, 100);
  { let dn = null; A.cv.addEventListener('pointerdown', e => { dn = { x: e.clientX, y: e.clientY, t: performance.now() }; }); A.cv.addEventListener('pointerup', e => { if (!dn || Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 10 || performance.now() - dn.t > 500) return; dn = null; if (!A.ready()) return; const f = innerHeight / 2 / Math.tan(A.fov() * D2R / 2), a = A.camYaw() - Math.atan((e.clientX - innerWidth / 2) / f), p = A.pos(); for (const h of live(p)) if (Math.abs(A.wrap(a - spotDir(h, p))) < 12 * D2R) { markFound(h, 'tap'); break; } }); }
  draw();
  W.huntState = () => ({ found: [...found], total: H.length, stamp: !!pp().stamps[ST.id], passport: pp() });
  W.hunts = H; W.spotDir = (id, p) => spotDir(H.concat(C.spots).find(x => x.id === id), p);
}
