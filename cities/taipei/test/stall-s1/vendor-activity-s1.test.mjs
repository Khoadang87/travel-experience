import assert from 'node:assert/strict';
import {VendorActivity} from './vendor-activity-s1.mjs';
const vendor=new VendorActivity();const activities=new Set();
// The visitor remains motionless for 30 seconds: work must continue.
for(let i=0;i<1800;i++)activities.add(vendor.update(1/60,{distance:4}).activity);
assert.deepEqual([...activities].sort(),['prepare','serve']);
assert.ok(Math.abs(vendor.time-30)<1e-8);
assert.equal(vendor.update(1/60,{distance:2}).activity,'acknowledge');
for(let i=0;i<120;i++)vendor.update(1/60,{distance:2});
assert.notEqual(vendor.update(1/60,{distance:2}).activity,'acknowledge');
// Staying nearby does not retrigger a greeting every frame.
vendor.update(.05,{distance:4});
assert.notEqual(vendor.update(.05,{distance:2}).activity,'acknowledge');
const before=vendor.time;vendor.update(20,{distance:2,visible:false});
assert.equal(vendor.time,before);
vendor.update(20,{distance:2});assert.ok(vendor.time-before<.101);
assert.throws(()=>vendor.update(-1),RangeError);
console.log('PASS: stationary activity, greeting, cooldown, hidden-tab/resume, invalid time');
