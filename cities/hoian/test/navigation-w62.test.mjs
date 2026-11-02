import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {boundedTime, movement, dragDelta, tableHeading, FRONT} from './navigation-w62.mjs';
import {SourceSession} from './source-session-w62.mjs';
const network = JSON.parse(fs.readFileSync(new URL('./route-network-w62.json', import.meta.url)));

test('actual route end stops even while looking forward', () => {
  assert.equal(movement(network, 'bridge_bound', 1201.9, 1, 1, 'forward').kind, 'blocked');
  assert.equal(movement(network, 'street_bound', 34.9, 1, 1, 'forward').kind, 'blocked');
});
test('return request proposes a disclosed edit only inside the captured anchor window', () => {
  for (const time of [1102, 1104, 1106]) {
    const choice = movement(network, 'bridge_bound', time, 1, 1, 'return');
    assert.equal(choice.kind, 'edit_proposal'); assert.equal(choice.automatic, false);
    assert.equal(choice.spatiallyVerified, false); assert.equal(choice.path, 'street_bound'); assert.equal(choice.time, 5);
  }
  for (const time of [1101.9, 1106.01, 1150, 1201]) assert.equal(movement(network, 'bridge_bound', time, 1, 1, 'return').kind, 'blocked');
});
test('forward while viewing behind requests an edit instead of playing away from the view', () => {
  assert.equal(movement(network, 'bridge_bound', 1103, Math.PI, 0, 'forward').kind, 'edit_proposal');
  assert.equal(movement(network, 'bridge_bound', 1110, Math.PI, 0, 'forward').kind, 'blocked');
});
test('side-facing forward is blocked; sidebar or idle never invents movement', () => {
  assert.equal(movement(network, 'bridge_bound', 1103, FRONT + .01, 0, 'forward').kind, 'blocked');
  assert.equal(movement(network, 'bridge_bound', 1103, 0, 0, 'sideways').kind, 'blocked');
  assert.equal(movement(network, 'bridge_bound', 1103, Math.PI, 0, 'idle').kind, 'idle');
});
test('return clip has no return outside junction windows and all play is positive-time', () => {
  assert.equal(movement(network, 'street_bound', 15, 0, 0, 'return').kind, 'blocked');
  assert.deepEqual(movement(network, 'street_bound', 15, 0, 0, 'forward'), {kind:'play', playbackRate:1});
});
test('invalid/missing coordinates block; bounded seek never escapes the chosen clip', () => {
  for (const time of [NaN, Infinity, -2]) assert.equal(movement(network, 'bridge_bound', time, 0, 0, 'forward').kind, 'blocked');
  assert.equal(movement(network, 'missing', 1, 0, 0, 'forward').kind, 'blocked');
  assert.equal(boundedTime(network.paths.street_bound, -100), 5);
  assert.equal(boundedTime(network.paths.street_bound, 100), 34.8);
  assert.throws(() => boundedTime(network.paths.street_bound, NaN));
});
test('accepted horizontal picture drag mapping stays positive; heading wraps across zero', () => {
  assert.ok(dragDelta(20, 0, 75, 800).yaw > 0);
  assert.ok(dragDelta(-20, 0, 75, 800).yaw < 0);
  assert.equal(movement(network, 'bridge_bound', 1110, -Math.PI + .1, Math.PI - .1, 'forward').kind, 'play');
  assert.ok(Number.isNaN(tableHeading(null, 1102)));
  assert.ok(Number.isNaN(tableHeading({h:[0,null],dt:1}, .5)));
  assert.equal(tableHeading({h:[0,1],dt:1}, .5), Math.PI / 2 - .5);
});

function adapter({reject = false, deferred = false, decoded = true, offset = 0} = {}) {
  let resolve, rejectPrepare;
  const pending = new Promise((yes,no) => {resolve = yes; rejectPrepare = no;});
  const result = {paused:0, disposed:0, time:null,
    pause() {this.paused++;}, dispose() {this.disposed++;},
    async prepare(time) {this.time = time; if (reject) throw new Error('Missing test media'); if (deferred) await pending; return {decoded,time:time + offset};},
    resolve, rejectPrepare};
  return result;
}
test('replacement decode commits once, paused old adapter survives until then', async () => {
  const first = adapter(), next = adapter({deferred:true}), list = [first,next], committed = [];
  const session = new SourceSession(() => list.shift(), next => committed.push(next.routeId));
  await session.open('bridge_bound', network.paths.bridge_bound, 1102);
  const changing = session.open('street_bound', network.paths.street_bound, 5);
  assert.equal(session.active.routeId, 'bridge_bound'); assert.equal(first.disposed, 0); assert.equal(first.paused, 1);
  next.resolve(); assert.equal((await changing).ok, true);
  assert.equal(session.active.routeId, 'street_bound'); assert.equal(first.disposed, 1);
  assert.deepEqual(committed, ['bridge_bound','street_bound']);
});
test('missing return media preserves the old selection and releases failed resources', async () => {
  const first = adapter(), next = adapter({reject:true}), list = [first,next];
  const session = new SourceSession(() => list.shift());
  await session.open('bridge_bound', network.paths.bridge_bound, 1102);
  const result = await session.open('street_bound', network.paths.street_bound, 5);
  assert.equal(result.ok, false); assert.match(result.error, /Missing/);
  assert.equal(session.active.adapter, first); assert.equal(first.disposed, 0); assert.equal(next.disposed, 1);
});
test('undecoded or wrong-timeline frame never replaces existing scenery', async () => {
  for (const options of [{decoded:false}, {offset:2}]) {
    const first = adapter(), next = adapter(options), list = [first,next];
    const session = new SourceSession(() => list.shift());
    await session.open('bridge_bound', network.paths.bridge_bound, 1102);
    assert.equal((await session.open('street_bound', network.paths.street_bound, 5)).ok, false);
    assert.equal(session.active.adapter, first);
  }
});
test('cancel during load prevents a late frame replacing the player', async () => {
  const first = adapter(), next = adapter({deferred:true}), list = [first,next];
  const session = new SourceSession(() => list.shift());
  await session.open('bridge_bound', network.paths.bridge_bound, 1102);
  const pending = session.open('street_bound', network.paths.street_bound, 5); session.cancel(); next.resolve();
  assert.equal((await pending).cancelled, true); assert.equal(session.active.adapter, first);
});
test('newest request wins when prior media resolves after it', async () => {
  const first = adapter(), slow = adapter({deferred:true}), quick = adapter(), list = [first, slow, quick];
  const session = new SourceSession(() => list.shift());
  await session.open('bridge_bound', network.paths.bridge_bound, 1102);
  const oldRequest = session.open('street_bound', network.paths.street_bound, 5);
  assert.equal((await session.open('bridge_bound', network.paths.bridge_bound, 1110)).ok, true);
  slow.resolve(); assert.equal((await oldRequest).cancelled, true);
  assert.equal(session.active.adapter, quick); assert.equal(quick.time, 1110);
});

test('second disclosed edit is restricted to assembly-hall return endpoint', () => {
  for (const time of [31,32,34.7,34.8,35]) {
    const choice = movement(network, 'street_bound', time, 0, 0, 'return');
    assert.equal(choice.kind, 'edit_proposal'); assert.equal(choice.automatic,false);
    assert.equal(choice.path,'bridge_bound'); assert.equal(choice.time,1066.2);
    assert.equal(choice.spatiallyVerified,false);
  }
  for (const time of [30.9,35.01]) assert.equal(movement(network,'street_bound',time,0,0,'return').kind,'blocked');
});
test('assembly start follows footage forward; edit is never triggered by idle or ordinary forward', () => {
  assert.equal(movement(network,'bridge_bound',1066.2,0,0,'forward').kind,'play');
  assert.equal(movement(network,'street_bound',32,0,0,'forward').kind,'play');
  assert.equal(movement(network,'street_bound',32,0,0,'idle').kind,'idle');
});

test('media allocation failure is reported and retains the previous panorama selection', async () => {
 const first = adapter(); let count = 0;
 const session = new SourceSession(() => { if (count++) throw new Error('Media allocation failed'); return first; });
 await session.open('bridge_bound', network.paths.bridge_bound, 1066.2);
 const result = await session.open('street_bound', network.paths.street_bound, 5);
 assert.equal(result.ok,false); assert.match(result.error,/allocation/);
 assert.equal(session.active.adapter,first); assert.equal(first.disposed,0); assert.equal(session.pending,null);
});
test('startup media allocation failure returns an error rather than rejecting out of the player', async () => {
 const session = new SourceSession(() => { throw new Error('No media resources'); });
 const result = await session.open('bridge_bound',network.paths.bridge_bound,1066.2);
 assert.equal(result.ok,false); assert.equal(session.active,null);
});
