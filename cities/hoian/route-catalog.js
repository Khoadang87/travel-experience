let catalogPromise;
export function loadCatalog() {
  return catalogPromise ||= fetch('routes.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) })
    .then(r => { if (!r.ok) throw new Error('The route list could not load.'); return r.json(); })
    .then(catalog => {
      if (!Array.isArray(catalog.routes) || !catalog.routes.length) throw new Error('No walks are available.');
      const ids = new Set();
      for (const route of catalog.routes) {
        if (!/^[a-z0-9-]+$/.test(route.id) || ids.has(route.id) || !route.name || !Number.isFinite(route.duration) || route.duration <= 0) throw new Error('Invalid route details.');
        ids.add(route.id);
        const url = new URL(route.manifest, location.href);
        if (url.origin !== location.origin || !url.pathname.endsWith('.json')) throw new Error('Invalid route address.');
        route.connections ||= [];
      }
      if (!ids.has(catalog.defaultRoute)) throw new Error('The starting route is unavailable.');
      for (const route of catalog.routes) for (const connection of route.connections) {
        const target = catalog.routes.find(r => r.id === connection.route);
        if (!target || !Number.isFinite(connection.at) || connection.at < 0 || connection.at > route.duration || !Number.isFinite(connection.entry) || connection.entry < 0 || connection.entry >= target.duration || (connection.radius != null && (!Number.isFinite(connection.radius) || connection.radius <= 0 || connection.radius > 30))) throw new Error('Invalid route connection.');
      }
      return catalog;
    });
}
