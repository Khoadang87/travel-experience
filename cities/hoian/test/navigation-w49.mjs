export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export function pathGuidance(viewYaw, travelYaw) {
  const correction = wrapAngle(travelYaw - viewYaw);
  const degrees = Math.round(Math.abs(correction) * 180 / Math.PI);
  const side = correction > 0 ? 'left' : 'right';
  return {
    correction, degrees,
    message: degrees >= 150
      ? 'The estimated recorded travel direction is behind you. This player has no continuous return route.'
      : `The estimated recorded travel direction is ${degrees}° to your ${side}. Forward playback cannot follow this view using the current route.`
  };
}
