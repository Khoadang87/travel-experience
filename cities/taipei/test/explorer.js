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
  function tick() {
    const w = W(); if (w.relYaw) { const r = -w.relYaw() * 180 / Math.PI; /* look right = positive */ for (const s of sp) { const x = (+s.dataset.d - r) * PX; s.style.left = x + 'px'; s.style.display = Math.abs(x) < 130 ? '' : 'none'; } }
    const walking = (knob && knob.style.transform && knob.style.transform !== 'none') || keyUp; document.body.classList.toggle('xwalk', !!walking);
    const ht = document.getElementById('hunt-t'); if (ht && w.huntState && !ht.querySelector('.ring')) { const h = w.huntState(); ht.insertAdjacentHTML('afterbegin', ring(h.found.length, h.total)); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
