import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('/workspace/scratch/a7d4ca2c1f7e/hoian-player-w73/walk-w73.js','utf8');
test('post-reset keyboard repeat must not create a fresh movement request',()=>{
 const keys={},handlers={},calls=[];const start=source.indexOf("addEventListener('keydown'");const snippet=source.slice(start,source.indexOf('\nfunction openModal',start));
 vm.runInNewContext(snippet,{keys,addEventListener:(name,fn)=>handlers[name]=fn,busy:false,modalOpen:()=>false,session:{active:{adapter:{video:{}}}},performance:{now:()=>100},traceInput:()=>{},inputSequence:0,inputStarted:0,playFailed:false,controlTick:()=>calls.push('movement')});
 handlers.keydown({code:'KeyW',repeat:true,target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(calls.length,0);assert.notEqual(keys.KeyW,true);
});
