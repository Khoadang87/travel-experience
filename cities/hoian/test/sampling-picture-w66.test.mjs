import test from 'node:test';
import assert from 'node:assert/strict';
import {Software360Renderer} from './software-360-w66.mjs';

test('actual projection blends four source pixels and wraps the panorama seam',()=>{
  const previousDocument=globalThis.document;
  const data=new Uint8ClampedArray(2048*1024*4);
  const put=(x,y,value)=>{for(let c=0;c<3;c++)data[(y*2048+x)*4+c]=value;};
  for(const left of [1535,2047]) {
    put(left,511,20);put((left+1)%2048,511,40);
    put(left,512,80);put((left+1)%2048,512,100);
  }
  let result;
  globalThis.document={createElement:()=>({style:{},getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    drawImage:()=>{},getImageData:()=>({data}),putImageData:value=>{result=value.data;}
  })})};
  try {
    const renderer=new Software360Renderer({nadir:false});renderer.setSize(1,1);
    const scene={children:[{material:{map:{isVideoTexture:true,image:{currentTime:5,readyState:4}}}}]};
    const camera={quaternion:{x:0,y:0,z:0,w:1},fov:75,aspect:1};
    renderer.last=-Infinity;renderer.render(scene,camera);
    assert.deepEqual([...result],[60,60,60,255]);
    camera.quaternion={x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2};
    renderer.last=-Infinity;renderer.render(scene,camera);
    assert.deepEqual([...result],[60,60,60,255],'seam blends last/first columns without a black edge');
  } finally {globalThis.document=previousDocument;}
});
