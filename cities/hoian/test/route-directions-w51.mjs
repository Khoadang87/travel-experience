// Pure route selection. A candidate edit is never treated as continuous walking.
export function directionChoice(network, path, time, request) {
  if (!Number.isFinite(time) || !network.paths[path]) return { kind: 'blocked', reason: 'Invalid route position' };
  if (request === 'forward') {
    const current = network.paths[path];
    return time >= current.start && time < current.end
      ? { kind: 'play', path, time, playbackRate: 1 }
      : { kind: 'blocked', reason: 'End of recorded coverage' };
  }
  if (request === 'return') {
    const junction = network.junctions.find(j => j.from === path && time >= j.window[0] && time <= j.window[1]);
    if (!junction) return { kind: 'blocked', reason: 'No filmed return connection at this point' };
    // Prepare a reviewable proposal; the player must explicitly disclose and
    // confirm the edit. Missing visual alignment blocks automatic switching.
    return { kind: 'edit_proposal', path: junction.to, time: junction.to_time,
      notice: junction.notice, automatic: false,
      reviewed: junction.spatial_alignment_verified === true };
  }
  return { kind: 'blocked', reason: 'No captured sideways route' };
}
