// Actual captured paths only. Edits are proposals, never simulated travel.
export const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export const FRONT = 80 * Math.PI / 180;
export function boundedTime(path, time) {
  if (!path || !Number.isFinite(time) || !(path.end > path.start)) throw new Error('Invalid route position');
  return Math.max(path.start, Math.min(path.end - 0.2, time));
}
export function movement(network, routeId, time, viewYaw, travelYaw, intent) {
  const path = network.paths[routeId];
  if (!path || ![time, viewYaw, travelYaw].every(Number.isFinite)) return {kind:'blocked', reason:'Route direction is not ready.'};
  if (intent === 'idle') return {kind:'idle'};
  if (intent === 'sideways') return {kind:'blocked', reason:'No sideways walking was filmed here. Drag or move the stick sideways to look around.'};
  if (time < path.start - 0.05 || time > path.end) return {kind:'blocked', reason:'Outside this recorded route.'};
  const relative = Math.abs(wrap(viewYaw - travelYaw));
  if (intent === 'return' || (intent === 'forward' && relative > 100 * Math.PI / 180)) {
    const junction = network.junctions.find(j => j.from === routeId && time >= j.window[0] && time <= j.window[1]);
    if (!junction) return {kind:'blocked', reason:'No filmed return connection at this point. Routes lets you choose a separate starting point.'};
    return {kind:'edit_proposal', junctionId:junction.id, path:junction.to, time:junction.to_time,
      notice:junction.notice, automatic:false, spatiallyVerified:junction.spatial_alignment_verified === true};
  }
  if (intent !== 'forward') return {kind:'blocked', reason:'Unsupported movement.'};
  if (relative >= FRONT) return {kind:'blocked', reason:'That direction has no walking footage. Face the recorded path to continue.'};
  if (time >= path.end - 0.2) return {kind:'blocked', reason:'End of the filmed route. Choose another starting point in Routes.'};
  return {kind:'play', playbackRate:1};
}
// Preserve the accepted picture-drag direction: dragging right increases yaw.
export function dragDelta(dx, dy, fov, height) {
  const k = 1.6 * fov * Math.PI / 180 / Math.max(1, height);
  return {yaw:dx * k, pitch:dy * k};
}
export function tableHeading(table, time) {
  if (!table || !Array.isArray(table.h) || !table.h.length || !(table.dt > 0)) return NaN;
  const p = Math.max(0, Math.min(table.h.length - 1, time / table.dt));
  const a = Math.floor(p), b = Math.min(a + 1, table.h.length - 1);
  if (![table.h[a], table.h[b]].every(Number.isFinite)) return NaN;
  return Math.PI / 2 - (table.h[a] * (1 - (p - a)) + table.h[b] * (p - a));
}
