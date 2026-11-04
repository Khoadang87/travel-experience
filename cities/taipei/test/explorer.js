// Direction C HUD helpers: heading tape (relative to the filmed path: "Ahead" = the way the footage walks, "Back" = behind you; no fake compass north),
// hunt progress ring, and body.xwalk while the stick or the up key is in use (fades non-essential UI). Reads window.__w.relYaw only.
(() => {
  const W = () => window.__w || {}, xc = document.createElement('div'); xc.id = 'xc'; xc.className = 'glass'; xc.setAttribute('aria-hidden', 'true');
  const marks = [[0, 'Ahead', 'a'], [45, '·'], [90, 'Right'], [135, '·'], [180, 'Back'], [225, '·'], [270, 'Left'], [315, '·']];
  xc.innerHTML = '<div class="tape">' + [-1, 0, 1].map(k => marks.map(([d, s, c]) => `<span data-d="${d + k * 360}" class="${c || ''}">${s}</span>`).join('')).join('') + '</div>';
  document.body.appendChild(xc); const sp = [...xc.querySelectorAll('span')], PX = 1.6; /* px per degree: ~±70 deg visible */
  const knob = document.getElementById('knob'); let keyUp = false;
  addEventListener('keydown', e => { if (e.key === 'ArrowUp') keyUp = true; }); addEventListener('keyup', e => { if (e.key === 'ArrowUp') keyUp = false; });
  const ring = (n, t) => { const c = 2 * Math.PI * 14, f = t ? n / t : 0; return `<svg class="ring" viewBox="0 0 34 34"><circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="3"/><circle cx="17" cy="17" r="14" fill="none" stroke="#e8b55a" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 17 17)"/></svg>`; };
  const xj = document.createElement('div'); xj.id = 'xj'; xj.className = 'glass'; xj.hidden = true; xj.textContent = '● Junction · pick a path'; document.body.appendChild(xj);
  let fwd = null, plain = null;
  function junc() { const side = [...document.querySelectorAll('.mk.filmed')].some(e => !e.hidden); fwd = fwd || document.querySelector('.mk.ahead');
    if (fwd && plain == null) plain = fwd.innerHTML; document.body.classList.toggle('xjunc', side); xj.hidden = !side || document.body.classList.contains('xwalk');
    const sv = [...document.querySelectorAll('.mk.filmed')].filter(e => !e.hidden);
    if (fwd) { fwd.style.translate = ''; sv.forEach(e => e.style.translate = ''); }
    if (fwd && side && !fwd.hidden && sv.length) { /* keep the two cards side by side on one row, never overlapping */ const s0 = sv[0], fx = parseFloat(fwd.style.left), sx = parseFloat(s0.style.left), fy = parseFloat(fwd.style.top), sy = parseFloat(s0.style.top);
      const lr = sx < fx || (sx === fx && 1), mid = Math.max(140, Math.min(innerWidth - 140, (fx + sx) / 2)), y = Math.min(fy, sy);
      s0.style.translate = ((lr ? mid - 72 : mid + 72) - sx) + 'px ' + (y - sy) + 'px'; fwd.style.translate = ((lr ? mid + 72 : mid - 72) - fx) + 'px ' + (y - fy) + 'px'; }
    if (fwd) { const want = side ? '<span><b>Main walk</b><small>Keep going straight</small></span>' : plain; if (fwd.innerHTML !== want) fwd.innerHTML = want; } }
  /* hunt hint: a soft pulsing ring on each not-yet-found target while it is in view (x anchored on the item, height at eye level / ground) */
  const rings = {};
  function hunts() { const w = W(); if (!w.hunts || !w.spotDir || !w.proj || !w.state || !w.huntState) return; let st; try { st = w.state(); } catch (e) { return; } const p = st.pos, got = new Set(w.huntState().found);
    for (const h of w.hunts) { let r = rings[h.id]; if (!r) { r = rings[h.id] = document.createElement('div'); r.className = 'xring'; r.dataset.hunt = h.id; r.hidden = true; document.body.appendChild(r); }
      let show = !got.has(h.id) && p >= h.t0 && p <= h.t1 && !document.body.classList.contains('picking');
      if (show) { const q = w.proj(w.spotDir(h.id, p), (h.pmin ?? -0.45) < -0.6 ? -0.35 : 0.05); show = q.on; if (show) { r.style.left = q.x + 'px'; r.style.top = q.y + 'px'; } }
      r.hidden = !show; } }
  function tick() { junc(); hunts();
    const w = W(); if (w.relYaw) { const r = -w.relYaw() * 180 / Math.PI; /* look right = positive */ for (const s of sp) { const x = (+s.dataset.d - r) * PX; s.style.left = x + 'px'; s.style.display = Math.abs(x) < 130 ? '' : 'none'; } }
    const walking = (knob && knob.style.transform && knob.style.transform !== 'none') || keyUp; document.body.classList.toggle('xwalk', !!walking);
    const ht = document.getElementById('hunt-t'); if (ht && w.huntState && !ht.querySelector('.ring')) { const h = w.huntState(); ht.insertAdjacentHTML('afterbegin', ring(h.found.length, h.total)); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
