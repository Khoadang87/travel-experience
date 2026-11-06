// Camera input never controls the recording's timeline or playback state.
export const LIMIT = .10; // reconstruction units, not verified metres
export function advanceCamera(p, keys, dt, yaw=0) {
  const forward=Number(keys.has('w')||keys.has('ArrowUp'))-Number(keys.has('s')||keys.has('ArrowDown'));
  const side=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'));
  const length=Math.hypot(forward,side)||1,step=.06*Math.max(0,Math.min(dt,.05))/length;
  const x=p.x+step*(side*Math.cos(yaw)-forward*Math.sin(yaw));
  const z=p.z-step*(forward*Math.cos(yaw)+side*Math.sin(yaw));
  return {x:Math.max(-LIMIT,Math.min(LIMIT,x)),z:Math.max(-LIMIT,Math.min(LIMIT,z))};
}
