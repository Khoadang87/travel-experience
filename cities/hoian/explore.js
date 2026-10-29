import { loadCatalog } from './route-catalog.js?v=w9';
const $ = id => document.getElementById(id);
const panel = $('explore'), toggle = $('explore-toggle'), slider = $('route-position');
let catalog, current, previousFocus, opening = false;
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function routeLink(route, entry = 0) {
  const url = new URL(location.href);
  const mode = window.__state?.loaded && window.HoianWalk?.state().quality;
  if (mode) url.searchParams.set('quality', mode);
  url.searchParams.set('route', route.id); url.searchParams.set('t', entry.toFixed(3));
  return url.href;
}
function close() {
  panel.hidden = true; $('explore-shade').hidden = true; toggle.setAttribute('aria-expanded', 'false');
  window.HoianWalk?.pauseNavigation(false); previousFocus?.focus();
}
async function open() {
  if (opening) return;
  opening = true;
  try {
    catalog ||= await loadCatalog();
    const id = new URLSearchParams(location.search).get('route') || catalog.defaultRoute;
    current = catalog.routes.find(r => r.id === id);
    if (!current) throw new Error('This route is unavailable.');
    if (!window.__state?.loaded) throw new Error('The walk is still loading. Try again shortly.');
    previousFocus = document.activeElement;
    window.HoianWalk.pauseNavigation(true);
    const state = window.HoianWalk.state();
    $('route-name').textContent = current.name; $('route-description').textContent = current.description || 'Explore this recorded route.';
    slider.min = state.lo; slider.max = Math.max(state.lo, state.hi - .1); slider.value = state.pos;
    $('route-time').textContent = `${time(state.pos)} / ${time(state.hi)}`;
    const list = $('route-list'); list.replaceChildren();
    for (const route of catalog.routes) {
      const link = document.createElement('a'); link.href = routeLink(route); link.textContent = route.name;
      if (route.id === current.id) { link.setAttribute('aria-current', 'page'); link.textContent += ' · current walk'; }
      list.appendChild(link);
    }
    const connections = $('route-connections'); connections.replaceChildren();
    for (const connection of current.connections) {
      const target = catalog.routes.find(r => r.id === connection.route);
      const link = document.createElement('a'); link.href = routeLink(target, connection.entry);
      link.textContent = `${connection.label || target.name} · entrance at ${time(connection.at)}`;
      connections.appendChild(link);
    }
    $('no-connections').hidden = current.connections.length > 0;
    $('explore-message').textContent = '';
    $('junctions').hidden = true;
    panel.hidden = false; $('explore-shade').hidden = false; toggle.setAttribute('aria-expanded', 'true'); $('explore-close').focus();
  } catch (error) { $('navigation-note').textContent = error.message; $('navigation-note').hidden = false; }
  finally { opening = false; }
}
toggle.addEventListener('click', open);
$('explore-close').addEventListener('click', close);
$('explore-shade').addEventListener('click', close);
slider.addEventListener('input', () => { $('route-time').textContent = `${time(+slider.value)} / ${time(+slider.max)}`; });
$('route-go').addEventListener('click', async () => {
  const button = $('route-go'); button.disabled = true; $('explore-message').textContent = 'Loading this part of the walk…';
  try { await window.HoianWalk.goTo(+slider.value); close(); }
  catch (error) { $('explore-message').textContent = error.message; }
  finally { button.disabled = false; }
});
panel.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); close(); }
  if (event.key === 'Tab') {
    const elements = [...panel.querySelectorAll('button:not(:disabled),a,input')];
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
loadCatalog().then(data => {
  catalog = data;
  current = data.routes.find(route => route.id === (new URLSearchParams(location.search).get('route') || data.defaultRoute));
}).catch(() => {}); // The player reports catalog failures; do not duplicate them here.
let junctionKey = '';
setInterval(() => {
  if (!window.__state?.loaded || !panel.hidden) return;
  const state = window.HoianWalk.state(), atEnd = state.pos >= state.hi - .5, atStart = state.pos <= state.lo + .1;
  const nearby = (current?.connections || []).filter(connection => Math.abs(state.pos - connection.at) <= (connection.radius ?? 6));
  const key = nearby.map(connection => `${connection.route}:${connection.at}:${state.quality}`).join('|');
  const junctions = $('junctions');
  if (key !== junctionKey) {
    junctionKey = key; junctions.replaceChildren();
    for (const connection of nearby) {
      const target = catalog.routes.find(route => route.id === connection.route);
      const link = document.createElement('a'); link.href = routeLink(target, connection.entry);
      link.textContent = connection.label || (target.kind === 'interior' ? 'Enter ' : 'Turn here: ') + target.name;
      link.addEventListener('click', () => { link.href = routeLink(target, connection.entry); });
      junctions.appendChild(link);
    }
  }
  junctions.hidden = nearby.length === 0;
  $('navigation-note').hidden = !(atEnd || atStart);
  $('navigation-note').textContent = atEnd ? 'End of this recorded street. Walk back or choose another point in Explore.' : 'Start of this recorded street. Walk forward or choose a point in Explore.';
}, 500);
