import test from 'node:test';
import assert from 'node:assert/strict';
import {Software360Renderer} from './software-360-w71.mjs';

test('picture timing ignores clock-only and off-view source changes',()=>{
  const previousDocument=globalThis.document, previousInfo=console.info;
  const data=new Uint8ClampedArray(2048*1024*4).fill(20),logs=[];
  globalThis.document={createElement:()=>({style:{},getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    drawImage:()=>{},getImageData:()=>({data}),putImageData:()=>{}
  })})};
  console.info=(tag,value)=>{if(tag==='Hoian input picture')logs.push(JSON.parse(value));};
  try {
    const renderer=new Software360Renderer({nadir:false});renderer.setSize(1,1);
    const video={currentTime:5,readyState:4,dataset:{}};
    const scene={children:[{material:{map:{isVideoTexture:true,image:video}}}]};
    const camera={quaternion:{x:0,y:0,z:0,w:1},fov:75,aspect:1};
    const render=()=>{renderer.last=-Infinity;renderer.render(scene,camera);};
    render();
    video.dataset={timing:'1',inputSequence:'1',inputStarted:String(performance.now()),inputMediaTime:'5'};
    video.currentTime=5.1;render();assert.equal(logs.length,0,'clock advance is not a changed picture');
    data[0]=99;video.currentTime=5.2;render();assert.equal(logs.length,0,'off-view source pixel must not count');
    for(const y of [511,512])for(const x of [1535,1536])for(let c=0;c<3;c++)data[(y*2048+x)*4+c]=80;
    video.currentTime=5.3;render();assert.equal(logs.length,1);assert.equal(logs[0].pixelsChanged,true);
    assert.equal(logs[0].time,5.3);assert.ok(Number.isInteger(logs[0].projectedFingerprint));
  } finally {globalThis.document=previousDocument;console.info=previousInfo;}
});
