import test from 'node:test';
import assert from 'node:assert/strict';
import {Software360Renderer} from './software-360-w63.mjs';

test('paused picture is reused, while changed footage, view and output still redraw', () => {
  const previousDocument=globalThis.document;
  let reads=0, presentations=0;
  const pixels=new Uint8ClampedArray(1024*512*4).fill(80);
  globalThis.document={createElement:()=>({style:{},getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    drawImage:()=>{reads++;},getImageData:()=>({data:pixels}),
    putImageData:()=>{presentations++;}
  })})};
  try {
    const renderer=new Software360Renderer({nadir:false});renderer.setSize(4,4);
    const video={readyState:4,currentTime:5};
    const mesh={material:{map:{isVideoTexture:true,image:video}}};
    const scene={children:[mesh]};
    const camera={quaternion:{x:0,y:0,z:0,w:1},fov:75,aspect:1};
    const render=()=>{renderer.last=-Infinity;renderer.render(scene,camera);};
    render();assert.equal(reads,1);assert.equal(presentations,1);
    for(let i=0;i<100;i++)render();
    assert.equal(reads,1,'unchanged paused picture must not be sampled again');
    assert.equal(presentations,1);
    camera.quaternion.y=.1;render();assert.equal(presentations,2,'view drag redraws while paused');
    video.currentTime=6;render();assert.equal(presentations,3,'new filmed frame redraws');
    mesh.material.map.image={...video};render();assert.equal(presentations,4,'source change redraws even at same time');
    renderer.setSize(6,4);render();assert.equal(presentations,5,'resize invalidates picture');
    camera.fov=80;render();assert.equal(presentations,6,'FOV change redraws');
    mesh.material.map.image.currentTime=7;mesh.material.map.image.seeking=true;
    render();assert.equal(presentations,6,'pending seek retains previous picture');
    mesh.material.map.image.seeking=false;
    render();assert.equal(presentations,7,'settled seek must not reuse the old picture');
  } finally {globalThis.document=previousDocument;}
});
