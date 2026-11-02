import test from 'node:test';import assert from 'node:assert/strict';
import {panoramaUV} from './software-360-w59.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('forward ray matches existing sphere longitude .75',()=>{const [u,v]=panoramaUV(0,0,-1);near(u,.75);near(v,.5)});
test('positive yaw decreases longitude, preserving accepted picture drag mapping',()=>{const yaw=.4;const [u]=panoramaUV(-Math.sin(yaw),0,-Math.cos(yaw));near(u,.75-yaw/(2*Math.PI))});
test('up maps to sky and down to nadir',()=>{near(panoramaUV(0,1,0)[1],0);near(panoramaUV(0,-1,0)[1],1)});
test('texture seam wraps instead of creating a dark border',()=>{near(panoramaUV(1,0,0)[0],0);assert.ok(panoramaUV(1,0,-.0001)[0]>.99)});
test('ray length does not change projected picture',()=>{const a=panoramaUV(1,2,-3),b=panoramaUV(2,4,-6);near(a[0],b[0]);near(a[1],b[1])});
