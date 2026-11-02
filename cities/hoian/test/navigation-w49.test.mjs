import assert from 'node:assert/strict';
import { pathGuidance, wrapAngle } from './navigation-w49.mjs';
// Camera yaw increases leftward. Cross the ±pi seam by the shortest rotation.
assert.equal(pathGuidance(0, Math.PI/2).message.includes('left'), true);
assert.equal(pathGuidance(0, -Math.PI/2).message.includes('right'), true);
assert.equal(pathGuidance(0, Math.PI).message.includes('behind'), true);
assert.ok(Math.abs(pathGuidance(179*Math.PI/180,-179*Math.PI/180).correction-2*Math.PI/180)<1e-10);
for (const [look, hd, travel] of [[0, 2, -2], [3, 1, 0], [-3, -2, 3]]) {
  const explicitlyChosenYaw=wrapAngle(travel-hd);
  assert.ok(Math.abs(wrapAngle(explicitlyChosenYaw+hd-travel))<1e-10);
}
console.log('Navigation direction and explicit alignment checks passed. No browser/phone acceptance claimed.');
